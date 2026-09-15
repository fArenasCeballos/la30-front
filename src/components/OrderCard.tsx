import type { Order } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";
import { Clock, ShoppingCart, MessageSquare } from "lucide-react";

function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface OrderCardProps {
  order: Order;
  actions?: React.ReactNode;
  compact?: boolean;
  checkable?: boolean;
  onToggleItem?: (itemId: string, completed: boolean) => void;
}

export function OrderCard({
  order,
  actions,
  compact,
  checkable,
  onToggleItem,
  className,
}: OrderCardProps & { className?: string }) {
  const validItems = (order.order_items ?? []).filter(
    (item) => item != null && item.products != null,
  );

  const previouslyPaid =
    order.payments?.reduce(
      (sum, p) =>
        sum +
        (Number(p.amount_total) ||
          (Number(p.amount_efectivo) || 0) +
            (Number(p.amount_tarjeta) || 0) +
            (Number(p.amount_nequi) || 0) ||
          0),
      0,
    ) || 0;
  const orderTotal = Number(order.total) || Number(order.total_amount) || 0;
  const baseRemaining = Math.max(0, orderTotal - previouslyPaid);
  const isPartiallyPaid = previouslyPaid > 0 && baseRemaining > 0;
  const isKitchenOrReady = order.status === "en_preparacion" || order.status === "listo";
  const isFullyPaid =
    (previouslyPaid >= orderTotal && orderTotal > 0) ||
    order.is_paid ||
    isKitchenOrReady ||
    order.status === "entregado";

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-slate-300 transition-all duration-300 p-3 sm:p-3.5 select-none overflow-hidden",
        className,
      )}
    >
      {/* Cabecera de la Tarjeta: Localizador, Metadatos y Estado */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Badge de Localizador Destacado */}
            <div className="flex flex-col items-center justify-center size-11 sm:size-12 rounded-2xl bg-slate-900 text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-[7px] font-black leading-none text-slate-400 uppercase tracking-widest mb-0.5">
                #LOC
              </span>
              <span className="font-display font-black text-lg sm:text-xl tracking-tighter text-white">
                {order.locator}
              </span>
            </div>

            {/* Metadatos: Tiempo y Origen */}
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                <Clock className="size-3 text-slate-400" />
                <span>{timeAgo(order.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black text-slate-700 bg-slate-100 border border-slate-200/70 px-2 py-0.5 rounded-full uppercase tracking-wider truncate max-w-28 sm:max-w-32">
                  {order.profiles?.name
                    ? `Mesero: ${order.profiles.name}`
                    : "Kiosko"}
                </span>
                {order.isOfflinePending && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse shrink-0">
                    📶 Offline
                  </span>
                )}
              </div>
            </div>
          </div>

          <StatusBadge status={order.status} className="scale-90 origin-right shrink-0" />
        </div>

        {/* Lista de Productos del Pedido */}
        {!compact && validItems.length > 0 && (
          <div className="space-y-1.5 my-2 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
            {validItems.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-start gap-2 border-b border-slate-100/80 pb-1.5 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {checkable && onToggleItem && (
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={!!item.is_completed}
                        onChange={(e) => onToggleItem(item.id, e.target.checked)}
                        className="size-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer transition-all checked:scale-110"
                      />
                    </div>
                  )}
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-xs font-bold leading-tight tracking-tight",
                        item.is_completed && checkable
                          ? "line-through text-slate-400"
                          : "text-slate-800",
                      )}
                    >
                      <span className="text-primary font-black mr-1">
                        {item.quantity}x
                      </span>{" "}
                      {item.products?.name ?? "Producto"}
                    </p>

                    {/* Notas especiales destacadas */}
                    {item.notes && (
                      <div className="flex items-center gap-1 text-[9px] font-medium text-amber-900 bg-amber-50/90 border border-amber-200/60 rounded-md px-1.5 py-0.5 mt-0.5">
                        <MessageSquare className="size-2.5 shrink-0 text-amber-600" />
                        <span className="truncate italic">"{item.notes}"</span>
                      </div>
                    )}

                    {/* Opciones y Modificadores */}
                    {item.choices && Object.keys(item.choices).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.values(item.choices).map(
                          (
                            choice: { label: string; icon?: string },
                            idx: number,
                          ) => (
                            <span
                              key={idx}
                              className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs"
                            >
                              {choice.icon} {choice.label}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {!checkable && !isKitchenOrReady && (
                  <span className="font-bold text-xs text-slate-500 tracking-tight shrink-0 pt-0.5">
                    {formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pie de Tarjeta: Totales y Botones de Acción */}
      <div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col">
            {isPartiallyPaid ? (
              <>
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-600">
                  TOTAL RESTANTE
                </span>
                <span className="font-display font-black text-base sm:text-lg tracking-tight text-slate-900 group-hover:text-primary transition-colors">
                  {formatPrice(baseRemaining)}
                </span>
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 mt-0.5 w-fit">
                  Abonado: {formatPrice(previouslyPaid)}
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    TOTAL
                  </span>
                  {isFullyPaid && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                      PAGADO
                    </span>
                  )}
                </div>
                <span className="font-display font-black text-base sm:text-lg tracking-tight text-slate-900 group-hover:text-primary transition-colors">
                  {formatPrice(orderTotal > 0 ? orderTotal : previouslyPaid)}
                </span>
              </>
            )}
          </div>
          {compact && (
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              <ShoppingCart className="size-3" />
              <span>{validItems.length} items</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        {actions && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 w-full">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

