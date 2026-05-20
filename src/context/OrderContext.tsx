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
import { useStore } from "@/context/StoreContext";
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
  addDeliveryOrder: (
    locator: string,
    items: OrderItemInput[],
    deliveryInfo: { name: string; address: string; phone: string; fee: number },
    notes?: string,
  ) => Promise<void>;
  updateOrder: (
    orderId: string,
    locator: string,
    items: OrderItemInput[],
    notes?: string,
  ) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  dispatchOrder: (orderId: string) => Promise<void>;
  toggleOrderItem: (itemId: string, completed: boolean) => Promise<void>;
  processPayment: (
    orderId: string,
    method: string,
    amountReceived: number,
    breakdown?: {
      efectivo?: number;
      tarjeta?: number;
      nequi?: number;
      tarjeta_credito?: number;
      tarjeta_debito?: number;
      daviplata?: number;
    },
    targetStatus?: OrderStatus | null,
  ) => Promise<boolean>;
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

export interface OfflineOrderQueueItem {
  id: string;
  type: "standard" | "delivery";
  locator: string;
  items: OrderItemInput[];
  notes?: string;
  deliveryInfo?: { name: string; address: string; phone: string; fee: number };
  order: Order;
}

const OFFLINE_QUEUE_KEY = "la30_offline_orders_queue";

export function getOfflineQueue(): OfflineOrderQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineOrderQueueItem[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to save offline queue:", err);
  }
}


export function OrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeStore } = useStore();
  const queryClient = useQueryClient();
  const storeId = activeStore?.id;

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
    queryKey: ["orders", user?.id, storeId],
    queryFn: async () => {
      try {
        const shiftStart = getShiftStart().toISOString();
        let query = supabase
          .from("orders")
          .select("*, order_items(*, products(*, categories(*))), payments(*), siigo_invoices(*)")
          .gte("created_at", shiftStart)
          .order("created_at", { ascending: false });
        if (storeId) query = query.eq("store_id", storeId);
        const { data, error } = await query;
        if (error) throw error;
        const sanitized = sanitizeOrders((data as unknown[]) ?? []);
        localStorage.setItem(`la30_cached_orders_${user?.id}_${storeId}`, JSON.stringify(sanitized));
        return sanitized;
      } catch (err) {
        console.warn("Error fetching orders, falling back to cache:", err);
        const cached = localStorage.getItem(`la30_cached_orders_${user?.id}_${storeId}`);
        if (cached) return JSON.parse(cached) as Order[];
        return [];
      }
    },
    staleTime: 1000 * 60,
    enabled: !!user?.id,
  });

  // Query quirúrgica para Cocina/Caja (solo pedidos activos del turno actual)
  const { data: activeOrders = [], isLoading: loadingActive } = useQuery({
    queryKey: ["active-orders", user?.id, storeId],
    queryFn: async () => {
      try {
        const shiftStart = getShiftStart().toISOString();
        let query = supabase
          .from("orders")
          .select("*, order_items(*, products(*, categories(*))), payments(*), siigo_invoices(*)")
          .in("status", ["pendiente", "confirmado", "en_preparacion", "listo"])
          .gte("created_at", shiftStart)
          .order("created_at", { ascending: true });
        if (storeId) query = query.eq("store_id", storeId);
        const { data, error } = await query;
        if (error) throw error;
        const sanitized = sanitizeOrders((data as unknown[]) ?? []);
        localStorage.setItem(`la30_cached_active_orders_${user?.id}_${storeId}`, JSON.stringify(sanitized));
        return sanitized;
      } catch (err) {
        console.warn("Error fetching active orders, falling back to cache:", err);
        const cached = localStorage.getItem(`la30_cached_active_orders_${user?.id}_${storeId}`);
        const localActive = cached ? JSON.parse(cached) as Order[] : [];
        const queue = getOfflineQueue();
        const pendingLocalOrders = queue.map(q => q.order);
        return [...localActive, ...pendingLocalOrders];
      }
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
          try {
            if (payload.eventType === "UPDATE") {
              const updateFn = (old: Order[] | undefined) => {
                if (!old) return old;
                return old.map((o) =>
                  o.id === payload.new.id ? { ...o, ...payload.new } : o,
                );
              };
              queryClient.setQueryData(["orders", user.id, storeId], updateFn);
              queryClient.setQueryData(
                ["active-orders", user.id, storeId],
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
              queryClient.invalidateQueries({ queryKey: ["orders", user.id, storeId] });
              queryClient.invalidateQueries({
                queryKey: ["active-orders", user.id, storeId],
              });
            }
          } catch (err) {
            console.error("Error handling realtime order:", err);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          try {
            queryClient.invalidateQueries({ queryKey: ["orders", user.id, storeId] });
            queryClient.invalidateQueries({
              queryKey: ["active-orders", user.id, storeId],
            });
          } catch (err) {
            console.error("Error handling realtime order item:", err);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [queryClient, user?.id, storeId]);

  // Sincronización de pedidos guardados sin conexión
  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    if ((window as any)._isSyncingOrders) return;
    (window as any)._isSyncingOrders = true;

    const toastId = toast.loading("Sincronizando pedidos guardados sin internet...");

    const failedItems: OfflineOrderQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === "delivery" && item.deliveryInfo) {
          const { data, error } = await supabase.rpc("create_order", {
            p_locator: item.locator,
            p_items: item.items as unknown as Json,
            p_notes: item.notes || null,
            p_store_id: storeId || null,
          });
          if (error) throw error;

          const createdOrder = data as unknown as { order_id: string; locator: string };
          const itemsTotal = item.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
          const grandTotal = itemsTotal + item.deliveryInfo.fee;

          const { error: updateError } = await supabase
            .from("orders")
            .update({
              delivery_name: item.deliveryInfo.name,
              delivery_address: item.deliveryInfo.address,
              delivery_phone: item.deliveryInfo.phone,
              delivery_fee: item.deliveryInfo.fee,
              is_delivery: true,
              total: grandTotal,
            })
            .eq("id", createdOrder.order_id);

          if (updateError) throw updateError;
        } else {
          const { error } = await supabase.rpc("create_order", {
            p_locator: item.locator,
            p_items: item.items as unknown as Json,
            p_notes: item.notes || null,
            p_store_id: storeId || null,
          });
          if (error) throw error;
        }
      } catch (err) {
        console.error(`Error al sincronizar pedido sin conexión ${item.locator}:`, err);
        failedItems.push(item);
      }
    }

    saveOfflineQueue(failedItems);
    (window as any)._isSyncingOrders = false;

    if (failedItems.length === 0) {
      toast.success("¡Todos los pedidos sin conexión han sido sincronizados correctamente!", {
        id: toastId,
        duration: 4000,
      });
    } else {
      toast.error(`No se pudieron sincronizar ${failedItems.length} pedidos. Se reintentará después.`, {
        id: toastId,
        duration: 4000,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["orders", user?.id, storeId] });
    queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id, storeId] });
  }, [queryClient, user?.id, storeId]);

  // Escuchar cambio a estado online
  useEffect(() => {
    window.addEventListener("online", syncOfflineQueue);
    return () => {
      window.removeEventListener("online", syncOfflineQueue);
    };
  }, [syncOfflineQueue]);

  // Polling como plan de respaldo cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncOfflineQueue();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [syncOfflineQueue]);


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
        isOptimistic: false,
        isOfflinePending: true,
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
            name: "Cargando productos...",
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

      // Si no hay red, guardar en cola local de inmediato
      if (!navigator.onLine) {
        const queueItem: OfflineOrderQueueItem = {
          id: tempId,
          type: "standard",
          locator,
          items,
          notes,
          order: newOrderOptimistic
        };
        const queue = getOfflineQueue();
        queue.push(queueItem);
        saveOfflineQueue(queue);

        toast.warning(`Pedido ${locator} guardado localmente (sin internet). Se sincronizará automáticamente al restablecerse la red.`, {
          duration: 7000,
        });

        const updateList = (old: Order[] | undefined) => [
          newOrderOptimistic,
          ...(old || []),
        ];
        queryClient.setQueryData(["orders", user?.id, storeId], updateList);
        queryClient.setQueryData(["active-orders", user?.id, storeId], updateList);
        return;
      }

      // Flujo normal con soporte de fallo de internet imprevisto
      const updateList = (old: Order[] | undefined) => [
        { ...newOrderOptimistic, isOfflinePending: false, isOptimistic: true },
        ...(old || []),
      ];
      queryClient.setQueryData(["orders", user?.id, storeId], updateList);
      queryClient.setQueryData(["active-orders", user?.id, storeId], updateList);

      try {
        const { data, error } = await supabase.rpc("create_order", {
          p_locator: locator,
          p_items: items as unknown as Json,
          p_notes: notes || null,
          p_store_id: storeId || null,
        });

        if (error) throw error;

        const createdOrder = data as unknown as { locator: string };
        toast.success(`Pedido ${createdOrder?.locator || locator} enviado`);
        queryClient.invalidateQueries({ queryKey: ["orders", user?.id, storeId] });
        queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id, storeId] });
      } catch (err: any) {
        console.warn("Fallo al enviar pedido, analizando conexión:", err);
        const isNetworkError = !navigator.onLine || err.message?.includes("Failed to fetch") || err.status === 0;
        
        if (isNetworkError) {
          const queueItem: OfflineOrderQueueItem = {
            id: tempId,
            type: "standard",
            locator,
            items,
            notes,
            order: newOrderOptimistic
          };
          const queue = getOfflineQueue();
          queue.push(queueItem);
          saveOfflineQueue(queue);

          toast.warning(`Bajón de internet detectado. Pedido ${locator} guardado localmente y en espera de red.`, {
            duration: 7000,
          });

          const updateListOffline = (old: Order[] | undefined) => [
            newOrderOptimistic,
            ...(old || []).filter(o => o.id !== tempId),
          ];
          queryClient.setQueryData(["orders", user?.id, storeId], updateListOffline);
          queryClient.setQueryData(["active-orders", user?.id, storeId], updateListOffline);
        } else {
          toast.error(`Error: ${err.message || "Error al crear el pedido"}`);
          queryClient.invalidateQueries({ queryKey: ["orders", user?.id, storeId] });
          queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id, storeId] });
        }
      }
    },
    [queryClient, user?.id, storeId],
  );

  const addDeliveryOrder = useCallback(
    async (
      locator: string,
      items: OrderItemInput[],
      deliveryInfo: { name: string; address: string; phone: string; fee: number },
      notes?: string,
    ) => {
      const tempId = crypto.randomUUID();
      const itemsTotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const grandTotal = itemsTotal + deliveryInfo.fee;

      const newOrderOptimistic = {
        id: tempId,
        user_id: user?.id || null,
        locator,
        status: "pendiente" as OrderStatus,
        total_amount: grandTotal,
        total: grandTotal,
        notes: notes || null,
        isOptimistic: false,
        isOfflinePending: true,
        is_delivery: true,
        delivery_name: deliveryInfo.name,
        delivery_address: deliveryInfo.address,
        delivery_phone: deliveryInfo.phone,
        delivery_fee: deliveryInfo.fee,
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
            name: "Cargando productos...",
            description: null,
            price: i.unit_price,
            image_url: null,
            is_active: true,
            available: true,
            created_at: new Date().toISOString(),
          } as unknown as ProductWithCategory,
        })),
      } as Order;

      // Si no hay red, guardar en cola local de inmediato
      if (!navigator.onLine) {
        const queueItem: OfflineOrderQueueItem = {
          id: tempId,
          type: "delivery",
          locator,
          items,
          notes,
          deliveryInfo,
          order: newOrderOptimistic
        };
        const queue = getOfflineQueue();
        queue.push(queueItem);
        saveOfflineQueue(queue);

        toast.warning(`Domicilio ${locator} guardado localmente (sin internet). Se enviará al restablecerse la red.`, {
          duration: 7000,
        });

        const updateList = (old: Order[] | undefined) => [
          newOrderOptimistic,
          ...(old || []),
        ];
        queryClient.setQueryData(["orders", user?.id, storeId], updateList);
        queryClient.setQueryData(["active-orders", user?.id, storeId], updateList);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("create_order", {
          p_locator: locator,
          p_items: items as unknown as Json,
          p_notes: notes || null,
          p_store_id: storeId || null,
        });

        if (error) throw error;

        const createdOrder = data as unknown as { order_id: string; locator: string };

        const { error: updateError } = await supabase
          .from("orders")
          .update({
            delivery_name: deliveryInfo.name,
            delivery_address: deliveryInfo.address,
            delivery_phone: deliveryInfo.phone,
            delivery_fee: deliveryInfo.fee,
            is_delivery: true,
            total: grandTotal,
          })
          .eq("id", createdOrder.order_id);

        if (updateError) throw updateError;

        toast.success(`🛵 Domicilio ${createdOrder?.locator || locator} creado`);
        queryClient.invalidateQueries({ queryKey: ["orders", user?.id, storeId] });
        queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id, storeId] });
      } catch (err: any) {
        console.warn("Fallo al crear domicilio, analizando conexión:", err);
        const isNetworkError = !navigator.onLine || err.message?.includes("Failed to fetch") || err.status === 0;

        if (isNetworkError) {
          const queueItem: OfflineOrderQueueItem = {
            id: tempId,
            type: "delivery",
            locator,
            items,
            notes,
            deliveryInfo,
            order: newOrderOptimistic
          };
          const queue = getOfflineQueue();
          queue.push(queueItem);
          saveOfflineQueue(queue);

          toast.warning(`Bajón de internet. Domicilio ${locator} en cola local para sincronización.`, {
            duration: 7000,
          });

          const updateListOffline = (old: Order[] | undefined) => [
            newOrderOptimistic,
            ...(old || []),
          ];
          queryClient.setQueryData(["orders", user?.id, storeId], updateListOffline);
          queryClient.setQueryData(["active-orders", user?.id, storeId], updateListOffline);
        } else {
          toast.error(`Error: ${err.message || "Error al crear domicilio"}`);
        }
      }
    },
    [queryClient, user?.id, storeId],
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
      queryClient.invalidateQueries({ queryKey: ["orders", user?.id, storeId] });
      queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id, storeId] });
    },
    [queryClient, user?.id, storeId],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const previousOrders = queryClient.getQueryData(["orders", user?.id, storeId]);
      const previousActive = queryClient.getQueryData([
        "active-orders",
        user?.id,
        storeId,
      ]);

      const updateFn = (old: Order[] | undefined) => {
        if (!old) return old;
        if (["entregado", "cancelado"].includes(status))
          return old.filter((o) => o.id !== orderId);
        return old.map((o) => (o.id === orderId ? { ...o, status } : o));
      };

      queryClient.setQueryData(["active-orders", user?.id, storeId], updateFn);

      const { error } = await supabase.rpc("update_order_status", {
        p_order_id: orderId,
        p_status: status as string,
      });

      if (error) {
        toast.error(`Error: ${error.message}`);
        queryClient.setQueryData(["orders", user?.id, storeId], previousOrders);
        queryClient.setQueryData(["active-orders", user?.id, storeId], previousActive);
        return;
      }
      toast.success(`Pedido: ${STATUS_LABELS[status]}`);
    },
    [queryClient, user?.id, storeId],
  );

  const dispatchOrder = useCallback(
    async (orderId: string) => {
      const previousOrders = queryClient.getQueryData(["orders", user?.id, storeId]);
      const previousActive = queryClient.getQueryData([
        "active-orders",
        user?.id,
        storeId,
      ]);

      const updateFn = (old: Order[] | undefined) => {
        if (!old) return old;
        return old.map((o) => (o.id === orderId ? { ...o, is_dispatched: true } : o));
      };

      queryClient.setQueryData(["orders", user?.id, storeId], updateFn);
      queryClient.setQueryData(["active-orders", user?.id, storeId], updateFn);

      const { error } = await supabase
        .from("orders")
        .update({ is_dispatched: true })
        .eq("id", orderId);

      if (error) {
        toast.error(`Error al despachar: ${error.message}`);
        queryClient.setQueryData(["orders", user?.id, storeId], previousOrders);
        queryClient.setQueryData(["active-orders", user?.id, storeId], previousActive);
        return;
      }
      toast.success("Domicilio despachado (en camino) 🛵");
    },
    [queryClient, user?.id, storeId],
  );

  const toggleOrderItem = useCallback(
    async (itemId: string, completed: boolean) => {
      const previousOrders = queryClient.getQueryData(["orders", user?.id, storeId]);
      const previousActive = queryClient.getQueryData([
        "active-orders",
        user?.id,
        storeId,
      ]);

      const updateFn = (old: Order[] | undefined) => {
        if (!old) return old;
        return old.map((order) => {
          if (!order.order_items?.some(item => item.id === itemId)) return order;
          return {
            ...order,
            order_items: order.order_items.map((item) =>
              item.id === itemId ? { ...item, is_completed: completed } : item
            ),
          };
        });
      };

      queryClient.setQueryData(["orders", user?.id, storeId], updateFn);
      queryClient.setQueryData(["active-orders", user?.id, storeId], updateFn);

      const { error } = await supabase.rpc("toggle_order_item_completed", {
        p_item_id: itemId,
        p_completed: completed,
      });

      if (error) {
        toast.error(`Error: ${error.message}`);
        queryClient.setQueryData(["orders", user?.id, storeId], previousOrders);
        queryClient.setQueryData(["active-orders", user?.id, storeId], previousActive);
      }
    },
    [queryClient, user?.id, storeId],
  );

  const processPayment = useCallback(
    async (
      orderId: string, 
      method: string, 
      amountReceived: number,
      breakdown?: {
        efectivo?: number;
        tarjeta?: number;
        nequi?: number;
        tarjeta_credito?: number;
        tarjeta_debito?: number;
        daviplata?: number;
      },
      targetStatus: OrderStatus | null = "en_preparacion"
    ) => {
      const cardAmt = (breakdown?.tarjeta || 0) + (breakdown?.tarjeta_credito || 0) + (breakdown?.tarjeta_debito || 0);
      const transferAmt = (breakdown?.nequi || 0) + (breakdown?.daviplata || 0);

      const { error: paymentError } = await supabase.rpc("process_payment", {
        p_order_id: orderId,
        p_method: method,
        p_amount_received: amountReceived,
        p_amt_efectivo: breakdown?.efectivo || 0,
        p_amt_tarjeta: cardAmt,
        p_amt_nequi: transferAmt,
      });
      if (paymentError) {
        toast.error(`Error de pago: ${paymentError.message}`);
        return false;
      }
      if (targetStatus) {
        await supabase.rpc("update_order_status", {
          p_order_id: orderId,
          p_status: targetStatus,
        });
      }
      toast.success("Pago procesado");
      queryClient.invalidateQueries({ queryKey: ["active-orders", user?.id, storeId] });
      return true;
    },
    [queryClient, user?.id, storeId],
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
      addDeliveryOrder,
      updateOrder,
      updateOrderStatus,
      dispatchOrder,
      toggleOrderItem,
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
      addDeliveryOrder,
      updateOrder,
      updateOrderStatus,
      dispatchOrder,
      toggleOrderItem,
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
