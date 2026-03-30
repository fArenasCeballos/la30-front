/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  // Query de Órdenes
  const { data: orders = [], isLoading: loadingOrders, refetch: refreshOrders } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
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

      if (error) throw error;
      return sanitizeOrders((data as unknown[]) ?? []);
    },
    staleTime: 1000 * 30, // 30 segundos de gracia
  });

  // Query de Notificaciones
  const { data: notifications = [], refetch: refreshNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: true, // Se habilita solo si hay un usuario (se maneja dentro con el if)
  });

  // Realtime optimizado
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;

    const ordersChannel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          // Actualización incremental de la caché para cambios en la tabla 'orders'
          if (payload.eventType === 'UPDATE') {
            queryClient.setQueryData(['orders'], (oldOrders: Order[] | undefined) => {
              if (!oldOrders) return oldOrders;
              return oldOrders.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o);
            });
          } else {
            // Para INSERT o DELETE, invalidamos para traer los items relacionados correctamente
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['orders'] }), 300);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          // Cambios en items requieren refetch total para mantener consistencia de relaciones
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['orders'] }), 500);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(ordersChannel);
    };
  }, [queryClient]);

  // Realtime de notificaciones
  useEffect(() => {
    const notifChannel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          queryClient.setQueryData(['notifications'], (old: Notification[] | undefined) => {
            const list = old || [];
            return [newNotif, ...list].slice(0, 50);
          });
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [queryClient]);

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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [queryClient],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      // Optmistic Update
      const previousOrders = queryClient.getQueryData(['orders']);
      queryClient.setQueryData(['orders'], (old: Order[] | undefined) => {
        if (!old) return old;
        return old.map(o => o.id === orderId ? { ...o, status } : o);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("update_order_status", {
        p_order_id: orderId,
        p_status: status as string,
      });

      if (error) {
        toast.error(`Error: ${error.message}`);
        queryClient.setQueryData(['orders'], previousOrders); // Rollback
        return;
      }

      toast.success(`Pedido actualizado: ${STATUS_LABELS[status]}`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [queryClient],
  );

  const processPayment = useCallback(
    async (orderId: string, method: string, amountReceived: number) => {
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: statusError } = await (supabase.rpc as any)("update_order_status", {
        p_order_id: orderId,
        p_status: "en_preparacion",
      });

      if (statusError) {
        toast.warning("Pago registrado, pero mueve el pedido manualmente");
      } else {
        toast.success("Pago procesado y enviado a Cocina");
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [queryClient],
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
      queryClient.setQueryData(['notifications'], (old: Notification[] | undefined) => {
        if (!old) return old;
        return old.map(n => ({ ...n, read: true }));
      });
    }
  }, [queryClient]);

  const clearNotifications = useCallback(async () => {
    const { error } = await supabase.rpc("clear_my_notifications");
    if (!error) {
      queryClient.setQueryData(['notifications'], []);
    }
  }, [queryClient]);

  return (
    <OrderContext.Provider
      value={{
        orders,
        loading: loadingOrders,
        addOrder,
        updateOrderStatus,
        processPayment,
        getOrdersByStatus,
        refreshOrders: async () => { refreshOrders(); refreshNotifications(); },
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
