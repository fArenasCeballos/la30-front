/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import type { Order, OrderStatus, ProductWithCategory } from "@/types";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database.types";
import { toast } from "sonner";

import { getShiftStart } from "@/lib/shiftUtils";
type OrderItemInput = {
  product_id: string;
  quantity: number;
  unit_price: number;
  notes?: string;
};

export interface OrderContextType {
  orders: Order[];
  activeOrders: Order[];
  loading: boolean;
  loadingActive: boolean;
  addOrder: (
    locator: string,
    items: OrderItemInput[],
    notes?: string,
  ) => Promise<void>;
  updateOrder: (
    orderId: string,
    locator: string,
    items: OrderItemInput[],
    notes?: string,
  ) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  processPayment: (
    orderId: string,
    method: string,
    amountReceived: number,
  ) => Promise<void>;
  getOrdersByStatus: (...statuses: OrderStatus[]) => Order[];
  getCompletedOrders: () => Order[];
  refreshOrders: () => Promise<void>;
}

export const OrderContext = createContext<OrderContextType | undefined>(
  undefined,
);

const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  en_preparacion: "En preparación",
  listo: "¡Listo!",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

function sanitizeOrders(raw: unknown[]): Order[] {
  return (raw ?? [])
    .filter(
      (o): o is Record<string, unknown> => o != null && typeof o === "object",
    )
    .map((o) => {
      const total_amount =
        (o.total_amount as number | null | undefined) ??
        (o.total as number | null | undefined) ??
        0;
      return {
        ...o,
        created_at: (o.created_at as string) ?? new Date().toISOString(),
        total_amount,
        total: total_amount,
        order_items: ((o.order_items as unknown[]) ?? [])
          .filter(
            (item): item is Record<string, unknown> =>
              item != null &&
              typeof item === "object" &&
              (item as Record<string, unknown>).products != null,
          )
          .map((item) => ({
            ...item,
            quantity: (item.quantity as number | null | undefined) ?? 1,
            unit_price: (item.unit_price as number | null | undefined) ?? 0,
            subtotal:
              (item.subtotal as number | null | undefined) ??
              (item.quantity as number) * (item.unit_price as number),
          })),
      };
    }) as unknown as Order[];
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const CLEANUP_KEY = "la30-last-cleanup";
    const today = new Date().toDateString();
    if (localStorage.getItem(CLEANUP_KEY) === today) return;
    supabase.rpc("cleanup_old_records").then(
      () => localStorage.setItem(CLEANUP_KEY, today),
      (err) => console.warn(err),
    );
  }, [user]);

  // Query global (historial del día para Dashboard/Reportería)
  const {
    data: orders = [],
    isLoading: loadingOrders,
    refetch: refreshOrders,
  } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const shiftStart = getShiftStart().toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(*, categories(*)))")
        .gte("created_at", shiftStart)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return sanitizeOrders((data as unknown[]) ?? []);
    },
    staleTime: 1000 * 60,
    enabled: !!user?.id,
  });

  // Query quirúrgica para Cocina/Caja (solo pedidos activos)
  const { data: activeOrders = [], isLoading: loadingActive } = useQuery({
    queryKey: ["active-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(*, categories(*)))")
        .in("status", ["pendiente", "confirmado", "en_preparacion", "listo"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return sanitizeOrders((data as unknown[]) ?? []);
    },
    staleTime: 1000 * 30,
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;
    const ordersChannel = supabase
      .channel("orders-realtime-speed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updateFn = (old: Order[] | undefined) => {
              if (!old) return old;
              return old.map((o) =>
                o.id === payload.new.id ? { ...o, ...payload.new } : o,
              );
            };
            queryClient.setQueryData(["orders", user.id], updateFn);
            queryClient.setQueryData(
              ["active-orders", user.id],
              (old: Order[] | undefined) => {
                if (!old) return old;
                if (
                  ["entregado", "cancelado"].includes(
                    payload.new.status as string,
                  )
                ) {
                  return old.filter((o) => o.id !== payload.new.id);
                }
                return old.map((o) =>
                  o.id === payload.new.id ? { ...o, ...payload.new } : o,
                );
              },
            );
          } else {
            queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
            queryClient.invalidateQueries({
              queryKey: ["active-orders", user.id],
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
          queryClient.invalidateQueries({
            queryKey: ["active-orders", user.id],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [queryClient, user?.id]);

  const addOrder = useCallback(
    async (locator: string, items: OrderItemInput[], notes?: string) => {
      const tempId = crypto.randomUUID();
      const total_amount = items.reduce(
        (sum, i) => sum + i.unit_price * i.quantity,
        0,
      );
      const newOrderOptimistic = {
        id: tempId,
        user_id: user?.id || null,
        locator,
        status: "pendiente" as OrderStatus,
        total_amount,
        total: total_amount,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        order_items: items.map((i) => ({
          id: crypto.randomUUID(),
          order_id: tempId,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          subtotal: i.unit_price * i.quantity,
          notes: i.notes || null,
          customizations: null,
          extras: null,
          created_at: new Date().toISOString(),
          products: {
            id: i.product_id,
            category_id: null,
            name: "Enviando...",
            description: null,
            price: i.unit_price,
            image_url: null,
            is_active: true,
            available: true,
            created_at: new Date().toISOString(),
            categories: {
              id: "",
              name: "",
              description: null,
              is_active: true,
              created_at: new Date().toISOString(),
            },
          } as unknown as ProductWithCategory,
        })),
      } as Order;

      const updateList = (old: Order[] | undefined) => [
        newOrderOptimistic,
        ...(old || []),
      ];
      queryClient.setQueryData(["orders", user?.id], updateList);
      queryClient.setQueryData(["active-orders", user?.id], updateList);

      const { data, error } = await supabase.rpc("create_order", {
        p_locator: locator,
        p_items: items as unknown as Json,
        p_notes: notes || null,
      });

      if (error) {
        toast.error(`Error: ${error.message}`);
        queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
        queryClient.invalidateQueries({
          queryKey: ["active-orders", user?.id],
        });
        return;
      }

      const createdOrder = data as unknown as { locator: string };
      toast.success(`Pedido ${createdOrder?.locator || locator} enviado`);
      queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id] });
    },
    [queryClient, user?.id],
  );

  const updateOrder = useCallback(
    async (
      orderId: string,
      locator: string,
      items: OrderItemInput[],
      notes?: string,
    ) => {
      const { error } = await supabase.rpc("update_order", {
        p_order_id: orderId,
        p_locator: locator,
        p_items: items as unknown as Json,
        p_notes: notes || null,
      });
      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }
      toast.success("Pedido actualizado");
      queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id] });
    },
    [queryClient, user?.id],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const previousOrders = queryClient.getQueryData(["orders", user?.id]);
      const previousActive = queryClient.getQueryData([
        "active-orders",
        user?.id,
      ]);

      const updateFn = (old: Order[] | undefined) => {
        if (!old) return old;
        if (["entregado", "cancelado"].includes(status))
          return old.filter((o) => o.id !== orderId);
        return old.map((o) => (o.id === orderId ? { ...o, status } : o));
      };

      queryClient.setQueryData(["active-orders", user?.id], updateFn);

      const { error } = await supabase.rpc("update_order_status", {
        p_order_id: orderId,
        p_status: status as string,
      });

      if (error) {
        toast.error(`Error: ${error.message}`);
        queryClient.setQueryData(["orders", user?.id], previousOrders);
        queryClient.setQueryData(["active-orders", user?.id], previousActive);
        return;
      }
      toast.success(`Pedido: ${STATUS_LABELS[status]}`);
    },
    [queryClient, user?.id],
  );

  const processPayment = useCallback(
    async (orderId: string, method: string, amountReceived: number) => {
      const { error: paymentError } = await supabase.rpc("process_payment", {
        p_order_id: orderId,
        p_method: method,
        p_amount_received: amountReceived,
      });
      if (paymentError) {
        toast.error(`Error de pago: ${paymentError.message}`);
        return;
      }
      await supabase.rpc("update_order_status", {
        p_order_id: orderId,
        p_status: "en_preparacion",
      });
      toast.success("Pago procesado");
      queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id] });
    },
    [queryClient, user?.id],
  );

  const getOrdersByStatus = useCallback(
    (...statuses: OrderStatus[]) =>
      activeOrders.filter((o) => statuses.includes(o.status)),
    [activeOrders],
  );

  const getCompletedOrders = useCallback(
    () => orders.filter((o) => ["entregado", "cancelado"].includes(o.status)),
    [orders],
  );

  const handleRefreshOrders = useCallback(async () => {
    await refreshOrders();
  }, [refreshOrders]);

  const value = useMemo(
    () => ({
      orders,
      activeOrders,
      loading: loadingOrders,
      loadingActive,
      addOrder,
      updateOrder,
      updateOrderStatus,
      processPayment,
      getOrdersByStatus,
      getCompletedOrders,
      refreshOrders: handleRefreshOrders,
    }),
    [
      orders,
      activeOrders,
      loadingOrders,
      loadingActive,
      addOrder,
      updateOrder,
      updateOrderStatus,
      processPayment,
      getOrdersByStatus,
      getCompletedOrders,
      handleRefreshOrders,
    ],
  );

  return (
    <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within OrderProvider");
  return ctx;
}
