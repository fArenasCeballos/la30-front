import type { Order } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatPrice } from "@/lib/formatPrice";
import { Clock, MapPin } from "lucide-react";

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
}

export function OrderCard({ order, actions, compact }: OrderCardProps) {
  // Filtrar items que tengan producto válido (guard contra joins incompletos)
  const validItems = (order.order_items ?? []).filter(
    (item) => item != null && item.products != null
  );

  return (
    <div className="pos-card animate-slide-in">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="font-display text-xl font-bold">
            {order.locator}
          </span>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {!compact && validItems.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {validItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                <span className="font-medium">{item.quantity}x</span>{" "}
                {item.products?.name ?? "Producto"}
                {item.notes && (
                  <span className="text-muted-foreground ml-1">
                    ({item.notes})
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {timeAgo(order.created_at)}
        </div>
        <span className="font-display font-bold text-lg">
          {formatPrice(order.total ?? 0)}
        </span>
      </div>

      {actions && <div className="flex gap-2 mt-3">{actions}</div>}
    </div>
  );
}
