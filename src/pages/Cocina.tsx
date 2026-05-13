import { useState } from "react";
import { useOrders } from "@/context/OrderContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ChefHat,
  CheckCheck,
  Clock,
  Loader2,
  CheckCircle,
  ListChecks,
  Flame,
  BellRing,
  Utensils,
} from "lucide-react";
import type { OrderStatus } from "@/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

export default function Cocina() {
  const { getOrdersByStatus, updateOrderStatus, toggleOrderItem } = useOrders();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const confirmados = getOrdersByStatus("confirmado") || [];
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

  return (
    <div className="section-container min-h-[calc(100vh-6rem)] pb-32 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 lg:gap-12 mb-10 lg:mb-20 bg-white/40 backdrop-blur-xl p-6 lg:p-12 rounded-[2.5rem] lg:rounded-[3.5rem] border border-white shadow-strong relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />

        <div className="relative space-y-4">
          <div className="flex items-center gap-3 text-primary/60 font-black uppercase tracking-[0.4em] text-[10px]">
            <div className="h-[2px] w-12 bg-primary/30 rounded-full" />
            OPERACIONES DE COCINA
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter flex items-center gap-4 sm:gap-6 text-foreground">
            <div className="bg-primary/10 p-2 lg:p-4 rounded-xl lg:rounded-3xl">
              <ChefHat
                className="h-8 w-8 lg:h-14 lg:w-14 text-primary"
                strokeWidth={2.5}
              />
            </div>
            Kitchen KDS
          </h1>
          <p className="text-muted-foreground font-medium text-lg sm:text-xl max-w-lg leading-relaxed">
            Gestión de alta eficiencia para tu equipo de producción.
          </p>
        </div>

        <div className="relative flex flex-wrap gap-4 sm:gap-8">
          {[
            {
              label: "RECIBIDOS",
              count: confirmados.length,
              icon: Clock,
              color: "bg-accent/10 text-primary",
              border: "border-accent/10",
            },
            {
              label: "EN FUEGO",
              count: enPreparacion.length,
              icon: Flame,
              color: "bg-preparing/10 text-preparing",
              border: "border-preparing/20",
              animate: "animate-pulse",
            },
            {
              label: "POR ENTREGAR",
              count: listos.length,
              icon: BellRing,
              color: "bg-green-500/10 text-green-600",
              border: "border-green-500/20",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className={cn(
                "bg-white/60 backdrop-blur-md px-4 py-3 sm:px-10 sm:py-8 rounded-3xl sm:rounded-[3rem] border-2 shadow-soft flex items-center gap-3 sm:gap-8 transition-all hover:scale-105 duration-500 group flex-1 min-w-[120px]",
                stat.border,
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12",
                  stat.color,
                  stat.animate,
                )}
              >
                <stat.icon
                  className="h-5 w-5 sm:h-8 sm:w-8"
                  strokeWidth={2.5}
                />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground/40 tracking-[0.2em] leading-none">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    "text-xl sm:text-4xl font-black leading-none tracking-tighter",
                    stat.color.split(" ")[1],
                  )}
                >
                  {stat.count}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ErrorBoundary>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
          {/* Confirmed orders - Por Hacer */}
          <div className="space-y-8">
            <div className="flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <div className="h-4 w-4 rounded-full bg-accent shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">
                  COLA DE ENTRADA
                </h3>
              </div>
              <span className="bg-accent/10 text-primary font-black px-3 py-1 rounded-full text-xs">
                {confirmados.length}
              </span>
            </div>
            <div className="space-y-8">
              {confirmados.map((order, idx) => (
                <div
                  key={order.id}
                  className="pos-card overflow-hidden border-2 border-l-8 lg:border-l-12 border-l-accent p-6 lg:p-10 group animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-both"
                  style={{ animationDelay: `${idx * 150}ms` }}
                >
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-6">
                      <div className="h-14 w-14 lg:h-20 lg:w-20 rounded-2xl lg:rounded-4xl bg-accent/10 flex items-center justify-center text-primary font-black text-2xl lg:text-4xl shadow-inner group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
                        {order.locator}
                      </div>
                      <div className="space-y-1.5">
                        <StatusBadge status={order.status} />
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/40 tracking-[0.15em] uppercase">
                          <Clock className="h-3 w-3" />
                          Hace 5 min
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 lg:space-y-5 mb-8 lg:mb-12 bg-accent/5 p-5 lg:p-8 rounded-2xl lg:rounded-[2.5rem] border-2 border-accent/10 shadow-inner">
                    <div className="flex items-center gap-3 mb-2 opacity-40">
                      <ListChecks className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        DETALLE DE PRODUCCIÓN
                      </span>
                    </div>
                    {(order.order_items || []).map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-5 text-lg items-start"
                      >
                        <span className="font-black text-primary bg-white h-10 min-w-10 px-2 rounded-xl flex items-center justify-center shadow-soft border border-accent/10 text-base mt-0.5">
                          {item.quantity}
                        </span>
                        <div className="space-y-2 flex-1">
                          <p className="font-black leading-tight text-xl tracking-tight text-foreground/90">
                            {item.products?.name}
                          </p>
                          {item.notes && (
                            <div className="bg-primary/5 px-4 py-3 rounded-2xl border-l-4 border-primary/40 shadow-sm">
                              <p className="text-[12px] text-primary italic font-bold leading-relaxed">
                                "{item.notes}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="xl"
                    className="w-full rounded-2xl lg:rounded-4xl h-14 lg:h-20 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-strong shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() =>
                      handleUpdateStatus(order.id, "en_preparacion")
                    }
                    disabled={updatingIds.has(order.id)}
                  >
                    {updatingIds.has(order.id) ? (
                      <Loader2 className="h-7 w-7 mr-4 animate-spin" />
                    ) : (
                      <ChefHat className="h-7 w-7 mr-4 group-hover:rotate-12 transition-transform" />
                    )}
                    EMPEZAR PREPARACIÓN
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* In preparation - Preparando */}
          <div className="space-y-8">
            <div className="flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <div className="h-4 w-4 rounded-full bg-preparing animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-preparing/80">
                  ESTACIÓN DE CALOR
                </h3>
              </div>
              <span className="bg-preparing/10 text-preparing font-black px-3 py-1 rounded-full text-xs">
                {enPreparacion.length}
              </span>
            </div>
            <div className="space-y-8">
              {enPreparacion.map((order, idx) => {
                const validItems = (order.order_items ?? []).filter(
                  (item) => item != null && item.products != null,
                );
                const allChecked =
                  validItems.length > 0 &&
                  validItems.every((item) => item.is_completed);

                return (
                  <div
                    key={order.id}
                    className="pos-card overflow-hidden border-2 border-l-8 lg:border-l-12 border-l-preparing p-6 lg:p-10 group animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-both"
                    style={{ animationDelay: `${idx * 150}ms` }}
                  >
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-6">
                        <div className="h-14 w-14 lg:h-20 lg:w-20 rounded-2xl lg:rounded-4xl bg-preparing/10 flex items-center justify-center text-preparing font-black text-2xl lg:text-4xl border-2 border-preparing/20 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          {order.locator}
                        </div>
                        <div className="space-y-1.5">
                          <StatusBadge status={order.status} />
                          <div className="flex items-center gap-2 text-[10px] font-black text-preparing/40 tracking-[0.15em] uppercase">
                            <Flame className="h-3 w-3 animate-pulse" />
                            En proceso
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 lg:space-y-5 mb-8 lg:mb-12 bg-preparing/5 p-5 lg:p-8 rounded-2xl lg:rounded-[2.5rem] border-2 border-preparing/10 shadow-inner">
                      <div className="flex items-center gap-3 mb-2 opacity-40">
                        <Utensils className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          CHECKLIST DE CONTROL
                        </span>
                      </div>
                      {validItems.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex gap-4 lg:gap-5 text-base lg:text-lg items-center p-3 lg:p-5 rounded-2xl lg:rounded-3xl transition-all cursor-pointer border-2 border-transparent",
                            item.is_completed
                              ? "bg-preparing/5 border-preparing/10 opacity-50"
                              : "hover:border-preparing/20 bg-white shadow-soft hover:shadow-lg",
                          )}
                          onClick={() =>
                            toggleOrderItem(item.id, !item.is_completed)
                          }
                        >
                          <div className="relative flex items-center justify-center shrink-0">
                            <div
                              className={cn(
                                "h-10 w-10 rounded-2xl border-2 transition-all duration-500 flex items-center justify-center shadow-soft",
                                item.is_completed
                                  ? "bg-preparing border-transparent rotate-0 scale-100"
                                  : "bg-white border-preparing/20 rotate-12 group-hover:rotate-0",
                              )}
                            >
                              {item.is_completed && (
                                <CheckCheck
                                  className="h-6 w-6 text-white"
                                  strokeWidth={3}
                                />
                              )}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "flex-1 transition-all",
                              item.is_completed &&
                                "line-through text-muted-foreground",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-black text-preparing text-xl">
                                {item.quantity}x
                              </span>
                              <span className="font-black text-xl tracking-tight text-foreground/90">
                                {item.products?.name}
                              </span>
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-preparing/70 italic font-bold mt-1.5 leading-relaxed">
                                "{item.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      size="xl"
                      className={cn(
                        "w-full rounded-4xl h-20 font-black text-xs uppercase tracking-widest shadow-xl transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]",
                        allChecked
                          ? "bg-green-500 hover:bg-green-600 text-white shadow-green-500/30"
                          : "bg-accent/20 text-muted-foreground/30 cursor-not-allowed grayscale",
                      )}
                      onClick={() => handleUpdateStatus(order.id, "listo")}
                      disabled={updatingIds.has(order.id) || !allChecked}
                    >
                      {updatingIds.has(order.id) ? (
                        <Loader2 className="h-7 w-7 mr-4 animate-spin" />
                      ) : (
                        <CheckCircle
                          className="h-7 w-7 mr-4"
                          strokeWidth={2.5}
                        />
                      )}
                      MARCAR COMO LISTO
                    </Button>
                    {!allChecked && (
                      <p className="text-[10px] font-black text-center mt-6 text-muted-foreground/20 uppercase tracking-[0.3em]">
                        COMPLETA EL CHECKLIST PRIMERO
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Listos - Entregar */}
          <div className="space-y-8">
            <div className="flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <div className="h-4 w-4 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
                <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-green-600">
                  ESTACIÓN DE SALIDA
                </h3>
              </div>
              <span className="bg-green-500/10 text-green-600 font-black px-3 py-1 rounded-full text-xs">
                {listos.length}
              </span>
            </div>
            <div className="space-y-8">
              {listos.map((order, idx) => (
                <div
                  key={order.id}
                  className="pos-card overflow-hidden border-2 border-l-12 border-l-green-500 p-10 group bg-green-50/10 animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-both"
                  style={{ animationDelay: `${idx * 150}ms` }}
                >
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-6">
                      <div className="h-20 w-20 rounded-4xl bg-green-500 text-white flex items-center justify-center font-black text-4xl shadow-strong shadow-green-500/30 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
                        {order.locator}
                      </div>
                      <div className="space-y-1.5">
                        <StatusBadge status={order.status} />
                        <div className="flex items-center gap-2 text-[10px] font-black text-green-600/40 tracking-[0.15em] uppercase">
                          <BellRing className="h-3 w-3" />
                          LISTO PARA ENTREGA
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center py-10 px-8 bg-white/60 rounded-[2.5rem] border-2 border-green-500/10 mb-12 shadow-inner group">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse scale-75" />
                      <BellRing
                        className="h-14 w-14 text-green-500 mx-auto relative transition-transform group-hover:rotate-12 duration-500"
                        strokeWidth={2.5}
                      />
                    </div>
                    <p className="text-green-600 font-black text-2xl tracking-tighter uppercase mb-2">
                      PEDIDO FINALIZADO
                    </p>
                    <p className="text-[10px] text-green-600/40 font-black tracking-[0.3em] uppercase">
                      NOTIFICAR AL CLIENTE
                    </p>
                  </div>

                  <Button
                    size="xl"
                    className="w-full rounded-4xl h-20 bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-strong shadow-green-500/20"
                    onClick={() => handleUpdateStatus(order.id, "entregado")}
                    disabled={updatingIds.has(order.id)}
                  >
                    {updatingIds.has(order.id) ? (
                      <Loader2 className="h-7 w-7 mr-4 animate-spin" />
                    ) : (
                      <CheckCheck className="h-7 w-7 mr-4" strokeWidth={2.5} />
                    )}
                    CONFIRMAR ENTREGA
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {confirmados.length === 0 &&
            enPreparacion.length === 0 &&
            listos.length === 0 && (
              <div className="col-span-full py-60 flex flex-col items-center justify-center space-y-12 animate-in fade-in zoom-in duration-1000">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
                  <div className="relative h-48 w-48 rounded-[4rem] border-12 border-dashed border-primary/20 flex items-center justify-center rotate-12">
                    <ChefHat
                      className="h-24 w-24 text-primary/20"
                      strokeWidth={1}
                    />
                  </div>
                </div>
                <div className="text-center space-y-4 relative">
                  <p className="text-6xl font-black uppercase tracking-[0.2em] text-foreground/10">
                    KITCHEN FREE
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-muted-foreground/40">
                    No hay órdenes en cola por ahora.
                  </p>
                </div>
              </div>
            )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
