import React, { createContext, useContext, useState, useCallback } from "react";
import type { Order, OrderItem, OrderStatus } from "@/types";
import { MOCK_ORDERS } from "@/data/mock";
import { toast } from "sonner";

interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning";
  timestamp: Date;
  read: boolean;
  orderId?: string;
}

interface OrderContextType {
  orders: Order[];
  addOrder: (locator: string, items: OrderItem[], createdBy: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  getOrdersByStatus: (...statuses: OrderStatus[]) => Order[];
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;
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
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (
      message: string,
      type: Notification["type"] = "info",
      orderId?: string,
    ) => {
      const notif: Notification = {
        id: `notif-${Date.now()}-${Math.random()}`,
        message,
        type,
        timestamp: new Date(),
        read: false,
        orderId,
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      playNotificationSound();
    },
    [],
  );

  const addOrder = useCallback(
    (locator: string, items: OrderItem[], createdBy: string) => {
      const total = items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      );
      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        locator,
        items,
        status: "pendiente",
        total,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
      };
      setOrders((prev) => [newOrder, ...prev]);
      toast.success(`Pedido ${locator} enviado a caja`);
      addNotification(
        `🆕 Nuevo pedido ${locator} recibido en caja`,
        "info",
        newOrder.id,
      );
    },
    [addNotification],
  );

  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderStatus) => {
      let locator = "";
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            locator = o.locator;
            return { ...o, status, updatedAt: new Date() };
          }
          return o;
        }),
      );
      toast.success(`Pedido actualizado: ${STATUS_LABELS[status]}`);

      const messages: Partial<Record<OrderStatus, string>> = {
        confirmado: `✅ Pedido ${locator} confirmado por caja`,
        en_preparacion: `👨‍🍳 Pedido ${locator} en preparación`,
        listo: `🔔 Pedido ${locator} ¡LISTO! Llamar cliente`,
        entregado: `💰 Pedido ${locator} entregado y cobrado`,
        cancelado: `❌ Pedido ${locator} cancelado`,
      };
      const msg = messages[status];
      if (msg) {
        const type =
          status === "cancelado"
            ? "warning"
            : status === "listo"
              ? "success"
              : "info";
        addNotification(msg, type, orderId);
      }
    },
    [addNotification],
  );

  const getOrdersByStatus = useCallback(
    (...statuses: OrderStatus[]) => {
      return orders.filter((o) => statuses.includes(o.status));
    },
    [orders],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <OrderContext.Provider
      value={{
        orders,
        addOrder,
        updateOrderStatus,
        getOrdersByStatus,
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
