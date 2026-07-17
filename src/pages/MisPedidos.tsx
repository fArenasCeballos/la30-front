import { useMemo, useState, useContext } from "react";
import { useAuth } from "@/context/AuthContext";
import { OrderContext } from "@/context/OrderContext";
import { formatPrice } from "@/lib/formatPrice";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ClipboardList,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Clock,
  Loader2,
  UtensilsCrossed,
} from "lucide-react";
import type { Order } from "@/types";

export default function MisPedidos() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const orderContext = useContext(OrderContext);
  const isLoading = orderContext?.loading || false;

  const orders = useMemo(() => {
    if (!user) return [];
    const rawOrders = orderContext?.orders || [];
    // Filtramos los pedidos del usuario (mesero) actual
    return rawOrders.filter(
      (o) =>
        o.user_id === user.id ||
        (o as Order & { created_by?: string }).created_by === user.id ||
        o.profiles?.id === user.id,
    );
  }, [orderContext?.orders, user]);

  const stats = useMemo(() => {
    const active = orders.filter(
      (o) => !["entregado", "cancelado"].includes(o.status),
    );
    const delivered = orders.filter((o) => o.status === "entregado");
    const cancelled = orders.filter((o) => o.status === "cancelado");
    return {
      total: orders.length,
      active: active.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      revenue: delivered.reduce((s, o) => s + o.total, 0),
    };
  }, [orders]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatTime = (dateStr: string) => {
    return new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(dateStr));
  };

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="font-display text-xl sm:text-2xl font-bold">
          Mis Pedidos
        </h1>
      </div>

      {/* Stats del mesero */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="pos-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Total</p>
          <p className="font-display text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="pos-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Activos</p>
          <p className="font-display text-2xl font-bold text-amber-500">
            {stats.active}
          </p>
        </div>
        <div className="pos-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Entregados</p>
          <p className="font-display text-2xl font-bold text-green-500">
            {stats.delivered}
          </p>
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="space-y-2">
        {orders.length === 0 && (
          <div className="py-16 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">
              No tienes pedidos en este turno
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Los pedidos aparecerán aquí cuando los crees desde el Kiosko
            </p>
          </div>
        )}

        {orders.map((order) => {
          const isExpanded = expandedId === order.id;
          const itemCount = order.order_items?.length ?? 0;

          return (
            <div
              key={order.id}
              className={`
                pos-card overflow-hidden transition-all duration-200
                ${isExpanded ? "ring-2 ring-primary/20" : "hover:bg-accent/50 cursor-pointer"}
              `}
            >
              {/* Header row — clickable */}
              <button
                onClick={() => toggleExpand(order.id)}
                className="w-full flex items-center justify-between gap-3 p-0 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <span className="text-xl font-bold font-display">
                      #{order.locator}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTime(order.created_at)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={order.status} />
                      <span className="text-xs text-muted-foreground">
                        {itemCount} {itemCount === 1 ? "producto" : "productos"}
                      </span>
                    </div>
                    <p className="text-base font-bold mt-0.5">
                      {formatPrice(order.total)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              </button>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  {(order.order_items ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-medium text-sm">
                            {item.quantity}x {item.products?.name ?? "Producto"}
                          </span>
                        </div>
                        {/* Categoría */}
                        <span className="text-[10px] text-muted-foreground ml-5.5 block">
                          {item.products?.categories?.name}
                        </span>
                        {/* Opciones seleccionadas */}
                        {item.customizations &&
                          Object.keys(item.customizations as object).length >
                            0 && (
                            <div className="ml-5.5 mt-0.5">
                              {Object.entries(
                                item.customizations as Record<string, string>,
                              ).map(([key, val]) => (
                                <span
                                  key={key}
                                  className="text-[10px] text-muted-foreground block"
                                >
                                  {key}: {val}
                                </span>
                              ))}
                            </div>
                          )}
                        {/* Extras */}
                        {item.extras &&
                          Array.isArray(item.extras) &&
                          item.extras.length > 0 && (
                            <p className="text-[10px] text-muted-foreground ml-5.5 mt-0.5">
                              + {(item.extras as string[]).join(", ")}
                            </p>
                          )}
                        {/* Notas */}
                        {item.notes && (
                          <p className="text-[10px] text-amber-600 italic ml-5.5 mt-0.5">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium tabular-nums shrink-0">
                        {formatPrice(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  {/* Total row */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-base font-bold text-primary">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
