import type { Order } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatPrice } from "@/data/mock";
import { Clock, MapPin } from "lucide-react";

function timeAgo(date: Date): string {
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

      {!compact && (
        <div className="space-y-1.5 mb-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                <span className="font-medium">{item.quantity}x</span>{" "}
                {item.product.name}
                {item.notes && (
                  <span className="text-muted-foreground ml-1">
                    ({item.notes})
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {formatPrice(item.product.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {timeAgo(order.createdAt)}
        </div>
        <span className="font-display font-bold text-lg">
          {formatPrice(order.total)}
        </span>
      </div>

      {actions && <div className="flex gap-2 mt-3">{actions}</div>}
    </div>
  );
}
