import { useState } from "react";
import { useOrders } from "@/context/OrderContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ChefHat, Loader2, CheckCircle, Flame, BellRing } from "lucide-react";
import type { OrderStatus, Order } from "@/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

export default function Cocina() {
  const { getOrdersByStatus, updateOrderStatus, toggleOrderItem } = useOrders();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const enPreparacion = getOrdersByStatus("en_preparacion") || [];
  const listos = getOrdersByStatus("listo") || [];

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    if (updatingIds.has(orderId)) return;

    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });

    try {
      await updateOrderStatus(orderId, status);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const renderOrderCard = (order: Order, idx: number, isSalida = false) => {
    const validItems = (order.order_items ?? []).filter(
      (item) => item != null && item.products != null,
    );
    const allChecked =
      validItems.length > 0 && validItems.every((item) => item.is_completed);

    return (
      <div
        key={order.id}
        className={cn(
          "pos-card overflow-hidden border-2 p-2 lg:p-3 group animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both flex flex-col min-h-fit",
          isSalida
            ? "border-l-4 border-l-green-500 bg-green-50/10"
            : "border-l-4 border-l-preparing",
        )}
        style={{ animationDelay: `${idx * 50}ms` }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-8 w-8 lg:h-10 lg:w-10 rounded-lg flex items-center justify-center font-black text-sm lg:text-base shadow-inner",
                isSalida
                  ? "bg-green-500 text-white"
                  : "bg-preparing/10 text-preparing",
              )}
            >
              {order.locator}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[7px] font-black text-muted-foreground/40 tracking-widest uppercase">
                {isSalida ? (
                  <BellRing className="h-2 w-2" />
                ) : (
                  <Flame className="h-2 w-2 animate-pulse" />
                )}
                {isSalida ? "LISTO" : "PREPARANDO"}
              </div>
              <StatusBadge
                status={order.status}
                className="h-4 text-[8px] px-1.5"
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "space-y-1 mb-3 p-2 rounded-lg border shadow-inner flex-1",
            isSalida
              ? "bg-white/60 border-green-500/10"
              : "bg-preparing/5 border-preparing/10",
          )}
        >
          {validItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex gap-1.5 text-[10px] lg:text-[11px] items-start py-0.5 px-1 rounded transition-all",
                !isSalida && "cursor-pointer hover:bg-preparing/5",
                item.is_completed && "opacity-40",
              )}
              onClick={() => {
                if (!isSalida) {
                  toggleOrderItem(item.id, !item.is_completed);
                }
              }}
            >
              <span
                className={cn(
                  "font-black h-5 min-w-5 px-1 rounded flex items-center justify-center border text-[8px]",
                  item.is_completed
                    ? "bg-preparing text-white border-transparent"
                    : "bg-white text-primary border-accent/10",
                )}
              >
                {item.quantity}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-bold leading-tight truncate",
                    item.is_completed && "line-through",
                  )}
                >
                  {item.products?.name}
                </p>
                {item.notes && (
                  <p className="text-[8px] text-muted-foreground italic leading-tight mt-0.5 line-clamp-1">
                    "{item.notes}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button
          size="sm"
          className={cn(
            "w-full rounded-lg h-8 font-black text-[9px] uppercase tracking-widest shadow-sm transition-all active:scale-95",
            isSalida
              ? "bg-green-500 hover:bg-green-600 text-white"
              : allChecked
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-accent/20 text-muted-foreground/30 cursor-not-allowed",
          )}
          onClick={() => {
            if (isSalida) handleUpdateStatus(order.id, "entregado");
            else if (allChecked) handleUpdateStatus(order.id, "listo");
          }}
          disabled={updatingIds.has(order.id) || (!isSalida && !allChecked)}
        >
          {updatingIds.has(order.id) ? (
            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3 mr-2" />
          )}
          {isSalida ? "ENTREGAR" : "TERMINAR"}
        </Button>
      </div>
    );
  };

  return (
    <div className="section-container min-h-[calc(100vh-6rem)] pb-20 animate-in fade-in duration-300 space-y-4 max-w-[98vw] mx-auto">
      {/* Compact Header & Stats */}
      <div className="sticky top-18 z-30 bg-white/80 backdrop-blur-xl border border-white shadow-strong rounded-2xl p-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 px-2">
          <ChefHat className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-black tracking-tighter text-foreground">
            Kitchen KDS
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {[
            {
              label: "CALOR",
              count: enPreparacion.length,
              color: "text-preparing",
              bg: "bg-preparing/5",
            },
            {
              label: "SALIDA",
              count: listos.length,
              color: "text-green-600",
              bg: "bg-green-500/5",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-lg border border-accent/10 shadow-sm",
                stat.bg,
              )}
            >
              <span
                className={cn(
                  "text-xl font-black tracking-tighter",
                  stat.color,
                )}
              >
                {stat.count}
              </span>
              <span className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest hidden sm:block">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ErrorBoundary>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Column 1: Estación de Calor (3/4 of space) */}
          <div className="lg:col-span-9 space-y-3">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-preparing animate-pulse shadow-sm" />
                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-preparing/80">
                  ESTACIÓN DE CALOR
                </h3>
              </div>
              <span className="bg-preparing/5 text-preparing font-black px-2 py-0.5 rounded-full text-[9px]">
                {enPreparacion.length} EN COLA
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {enPreparacion.map((order, idx) => renderOrderCard(order, idx))}
              {enPreparacion.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-20 grayscale scale-75">
                  <Flame className="h-12 w-12 mb-2" />
                  <p className="text-xs font-black tracking-widest">
                    SIN PEDIDOS AL FUEGO
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Estación de Salida (1/4 of space) */}
          <div className="lg:col-span-3 space-y-3 border-l-2 border-dashed border-accent/10 pl-2 lg:pl-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 shadow-sm" />
                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-green-600">
                  ESTACIÓN DE SALIDA
                </h3>
              </div>
              <span className="bg-green-500/5 text-green-600 font-black px-2 py-0.5 rounded-full text-[9px]">
                {listos.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {listos.map((order, idx) => renderOrderCard(order, idx, true))}
              {listos.length === 0 && (
                <div className="py-10 flex flex-col items-center justify-center opacity-10">
                  <BellRing className="h-8 w-8 mb-2" />
                  <p className="text-[10px] font-black">NADA LISTO</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}
