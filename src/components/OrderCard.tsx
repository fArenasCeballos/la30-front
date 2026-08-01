import type { Order } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";
import { Clock, ShoppingCart } from "lucide-react";

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
    order.payments?.reduce((sum, p) => sum + (Number(p.amount_total) || ((Number(p.amount_efectivo) || 0) + (Number(p.amount_tarjeta) || 0) + (Number(p.amount_nequi) || 0)) || 0), 0) || 0;
  const baseRemaining = Math.max(0, (order.total || 0) - previouslyPaid);

  return (
    <div
      className={cn(
        "pos-card group animate-in fade-in slide-in-from-bottom-4 duration-500 border-2 border-transparent hover:border-primary/10 transition-all shadow-md hover:shadow-xl p-2.5 lg:p-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-accent/20 border border-accent/10 shadow-inner group-hover:rotate-3 transition-all duration-500">
            <span className="text-[7px] font-black leading-none opacity-40 uppercase tracking-widest mb-0.5">
              #LOC
            </span>
            <span className="font-black text-lg tracking-tighter text-foreground">
              {order.locator}
            </span>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground/40 font-black uppercase tracking-widest text-[8px]">
              <Clock className="h-2.5 w-2.5" />
              <span>{timeAgo(order.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest truncate max-w-30">
                {order.profiles?.name
                  ? `Mesero: ${order.profiles.name}`
                  : "Kiosko"}
              </p>
              {order.isOfflinePending && (
                <span className="inline-flex items-center gap-0.5 text-[6px] font-black text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse shrink-0">
                  📶 Offline
                </span>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={order.status} className="scale-90 origin-right" />
      </div>

      {!compact && validItems.length > 0 && (
        <div className="space-y-1 mb-2 bg-accent/5 -mx-3 px-3 py-1.5 border-y border-dashed border-accent/10">
          {validItems.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-start gap-2"
            >
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {checkable && onToggleItem && (
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={!!item.is_completed}
                      onChange={(e) => onToggleItem(item.id, e.target.checked)}
                      className="h-4 w-4 rounded border-2 border-accent/30 text-primary focus:ring-primary/20 cursor-pointer transition-all checked:scale-110"
                    />
                  </div>
                )}
                <div className="space-y-0.5 min-w-0">
                  <p
                    className={cn(
                      "text-xs font-bold leading-tight tracking-tight",
                      item.is_completed && checkable
                        ? "line-through text-muted-foreground/40"
                        : "text-foreground",
                    )}
                  >
                    <span className="text-primary font-black mr-1">
                      {item.quantity}x
                    </span>{" "}
                    {item.products?.name ?? "Producto"}
                  </p>
                  {item.notes && (
                    <p className="text-[9px] font-medium text-muted-foreground/60 italic leading-none">
                      "{item.notes}"
                    </p>
                  )}
                  {/* Variaciones si existen */}
                  {item.choices && Object.keys(item.choices).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.values(item.choices).map(
                        (
                          choice: { label: string; icon?: string },
                          idx: number,
                        ) => (
                          <span
                            key={idx}
                            className="text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded-sm bg-white border border-accent/10 text-muted-foreground/60 shadow-sm"
                          >
                            {choice.icon} {choice.label}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className="font-black text-[11px] text-muted-foreground/40 tracking-tighter shrink-0 pt-0.5">
                {formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex flex-col -space-y-1">
          <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
            TOTAL
          </span>
          <span className="font-black text-base lg:text-lg tracking-tighter text-primary group-hover:scale-105 origin-left transition-all duration-500">
            {formatPrice(baseRemaining)}
          </span>
          {previouslyPaid > 0 && (
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 mt-1">
              RESTANTE (Pagado: {formatPrice(previouslyPaid)})
            </span>
          )}
        </div>
        {compact && (
          <div className="flex items-center gap-1.5 text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest bg-accent/10 px-2 py-1 rounded-full">
            <ShoppingCart className="h-2.5 w-2.5" />
            {validItems.length}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-accent/5">
          {actions}
        </div>
      )}
    </div>
  );
}
