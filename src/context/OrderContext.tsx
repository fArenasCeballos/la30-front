import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Order, OrderStatus, Notification } from "@/types";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface OrderContextType {
  orders: Order[];
  loading: boolean;
  addOrder: (locator: string, items: { product_id: string; quantity: number; unit_price: number; notes?: string }[], notes?: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  processPayment: (orderId: string, method: string, amountReceived: number) => Promise<void>;
  getOrdersByStatus: (...statuses: OrderStatus[]) => Order[];
  refreshOrders: () => Promise<void>;
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | null>(null);

const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  en_preparacion: "En preparación",
  listo: "¡Listo!",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all active orders with their items and products
  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          *,
          products (
            *,
            categories (*)
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      return;
    }

    setOrders((data as unknown as Order[]) || []);
    setLoading(false);
  }, []);

  // Fetch notifications for current user
  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchOrders();
    fetchNotifications();
  }, [fetchOrders, fetchNotifications]);

  // Realtime: listen for order changes
  useEffect(() => {
    const ordersChannel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [fetchOrders]);

  // Realtime: listen for new notifications
  useEffect(() => {
    const notifChannel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, []);

  // Create order via RPC
  const addOrder = useCallback(
    async (
      locator: string,
      items: { product_id: string; quantity: number; unit_price: number; notes?: string }[],
      notes?: string
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("create_order", {
        p_locator: locator,
        p_items: items,
        p_notes: notes || null,
      });

      if (error) {
        toast.error(`Error al crear pedido: ${error.message}`);
        return;
      }

      const result = data as { locator: string } | null;
      toast.success(`Pedido ${result?.locator || locator} enviado a caja`);
      await fetchOrders();
    },
    [fetchOrders],
  );

  // Update order status via RPC
  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("update_order_status", {
        p_order_id: orderId,
        p_status: status,
      });

      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }

      toast.success(`Pedido actualizado: ${STATUS_LABELS[status]}`);
      await fetchOrders();
    },
    [fetchOrders],
  );

  // Process payment via RPC
  const processPayment = useCallback(
    async (orderId: string, method: string, amountReceived: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("process_payment", {
        p_order_id: orderId,
        p_method: method,
        p_amount_received: amountReceived,
      });

      if (error) {
        toast.error(`Error al procesar pago: ${error.message}`);
        return;
      }

      toast.success("Pago procesado, pedido enviado a cocina");
      await fetchOrders();
    },
    [fetchOrders],
  );

  const getOrdersByStatus = useCallback(
    (...statuses: OrderStatus[]) => {
      return orders.filter((o) => statuses.includes(o.status));
    },
    [orders],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(async () => {
    const { error } = await supabase.rpc("mark_notifications_read");
    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    const { error } = await supabase.rpc("clear_my_notifications");
    if (!error) {
      setNotifications([]);
    }
  }, []);

  return (
    <OrderContext.Provider
      value={{
        orders,
        loading,
        addOrder,
        updateOrderStatus,
        processPayment,
        getOrdersByStatus,
        refreshOrders: fetchOrders,
        notifications,
        unreadCount,
        markAllRead,
        clearNotifications,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within OrderProvider");
  return ctx;
}
