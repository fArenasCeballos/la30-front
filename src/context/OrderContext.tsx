/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Order, OrderStatus, Notification } from "@/types";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database.types";
import { toast } from "sonner";

export interface OrderContextType {
  orders: Order[];
  loading: boolean;
  addOrder: (
    locator: string,
    items: {
      product_id: string;
      quantity: number;
      unit_price: number;
      notes?: string;
    }[],
    notes?: string
  ) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  processPayment: (
    orderId: string,
    method: string,
    amountReceived: number
  ) => Promise<void>;
  getOrdersByStatus: (...statuses: OrderStatus[]) => Order[];
  refreshOrders: () => Promise<void>;
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

export const OrderContext = createContext<OrderContextType | undefined>(
  undefined
);

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

/**
 * Sanitiza los datos crudos de Supabase antes de meterlos al estado.
 * Garantiza que:
 *  - order.created_at siempre existe
 *  - order.order_items siempre es un array
 *  - cada item tiene products válido (filtra los que llegaron incompletos
 *    por race condition entre INSERT y el refetch de Realtime)
 */
function sanitizeOrders(raw: unknown[]): Order[] {
  return (raw ?? [])
    .filter((o): o is Record<string, unknown> => o != null && typeof o === "object")
    .map((o) => ({
      ...o,
      created_at: o.created_at ?? new Date().toISOString(),
      total: o.total ?? 0,
      order_items: ((o.order_items as unknown[]) ?? [])
        .filter(
          (item): item is Record<string, unknown> =>
            item != null &&
            typeof item === "object" &&
            (item as Record<string, unknown>).products != null
        )
        .map((item) => ({
          ...item,
          quantity: (item.quantity as number) ?? 1,
          unit_price: (item.unit_price as number) ?? 0,
        })),
    })) as Order[];
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Sanitizar antes de guardar en estado
    setOrders(sanitizeOrders((data as unknown[]) ?? []));
    setLoading(false);
  }, []);

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

  useEffect(() => {
    fetchOrders();
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: órdenes — pequeño debounce para evitar refetches mientras
  // Supabase aún está insertando los order_items del mismo pedido
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;

    const ordersChannel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(fetchOrders, 300);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(fetchOrders, 300);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(ordersChannel);
    };
  }, [fetchOrders]);

  // Realtime: notificaciones
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

  const addOrder = useCallback(
    async (
      locator: string,
      items: { product_id: string; quantity: number; unit_price: number; notes?: string }[],
      notes?: string
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("create_order", {
        p_locator: locator,
        p_items: items as unknown as Json,
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

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("update_order_status", {
        p_order_id: orderId,
        p_status: status as string,
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

  const processPayment = useCallback(
    async (orderId: string, method: string, amountReceived: number) => {
      // 1. Registrar el pago
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: paymentError } = await (supabase.rpc as any)("process_payment", {
        p_order_id: orderId,
        p_method: method,
        p_amount_received: amountReceived,
      });

      if (paymentError) {
        toast.error(`Error al procesar pago: ${paymentError.message}`);
        return;
      }

      // 2. Cambiar estado a Cocina automáticamente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: statusError } = await (supabase.rpc as any)("update_order_status", {
        p_order_id: orderId,
        p_status: "en_preparacion",
      });

      if (statusError) {
        console.warn("Pago registrado pero falló cambio de estado:", statusError);
        toast.warning("Pago registrado, pero por favor mueve el pedido a Cocina manualmente");
      } else {
        toast.success("Pago procesado y pedido enviado a Cocina");
      }

      await fetchOrders();
    },
    [fetchOrders],
  );

  const getOrdersByStatus = useCallback(
    (...statuses: OrderStatus[]) =>
      orders.filter((o) => statuses.includes(o.status)),
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
