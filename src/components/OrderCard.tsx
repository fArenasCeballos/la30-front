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

  return (
    <div
      className={cn(
        "pos-card group animate-in fade-in slide-in-from-bottom-4 duration-500 border-2 border-transparent hover:border-primary/10 transition-all shadow-strong hover:shadow-2xl p-3 lg:p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center h-12 w-12 rounded-2xl bg-accent/20 border-2 border-accent/10 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
            <span className="text-[10px] font-black leading-none opacity-40 uppercase tracking-widest mb-1">
              #LOC
            </span>
            <span className="font-black text-xl tracking-tighter text-foreground">
              {order.locator}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground/40 font-black uppercase tracking-widest text-[9px]">
              <Clock className="h-3 w-3" />
              <span>RECIBIDO {timeAgo(order.created_at)}</span>
            </div>
            <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">
              MESERO: {order.profiles?.name || "Kiosko"}
            </p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {!compact && validItems.length > 0 && (
        <div className="space-y-1 mb-3 bg-accent/5 -mx-8 px-6 py-2 border-y-2 border-dashed border-accent/10">
          {validItems.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-start gap-4"
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                {checkable && onToggleItem && (
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={!!item.is_completed}
                      onChange={(e) => onToggleItem(item.id, e.target.checked)}
                      className="h-6 w-6 rounded-lg border-2 border-accent/30 text-primary focus:ring-primary/20 cursor-pointer transition-all checked:scale-110"
                    />
                  </div>
                )}
                <div className="space-y-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-bold leading-tight tracking-tight",
                      item.is_completed && checkable
                        ? "line-through text-muted-foreground/40"
                        : "text-foreground",
                    )}
                  >
                    <span className="text-primary font-black mr-2">
                      {item.quantity}x
                    </span>{" "}
                    {item.products?.name ?? "Producto"}
                  </p>
                  {item.notes && (
                    <p className="text-[10px] font-medium text-muted-foreground/60 italic bg-white/50 px-2 py-0.5 rounded-md border border-accent/10 inline-block">
                      "{item.notes}"
                    </p>
                  )}
                  {/* Variaciones si existen */}
                  {item.choices && Object.keys(item.choices).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.values(item.choices).map(
                        (choice: { label: string; icon?: string }, idx: number) => (
                          <span
                            key={idx}
                            className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-white border border-accent/10 text-muted-foreground/60 shadow-soft"
                          >
                            {choice.icon} {choice.label}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className="font-black text-sm text-muted-foreground/40 tracking-tighter shrink-0 pt-0.5">
                {formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t-2 border-accent/10">
        <div className="flex flex-col -space-y-1">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
            Total de Orden
          </span>
          <span className="font-black text-xl tracking-tighter text-primary group-hover:scale-110 origin-left transition-all duration-500">
            {formatPrice(order.total ?? 0)}
          </span>
        </div>
        {compact && (
          <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest bg-accent/10 px-3 py-1.5 rounded-full">
            <ShoppingCart className="h-3 w-3" />
            {validItems.length} items
          </div>
        )}
      </div>

      {actions && (
        <div className="flex gap-4 mt-4 pt-3 border-t-2 border-accent/5">
          {actions}
        </div>
      )}
    </div>
  );
}
