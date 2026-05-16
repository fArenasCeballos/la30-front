import type { OrderStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  OrderStatus,
  {
    label: string;
    className: string;
  }
> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  en_preparacion: {
    label: "En preparación",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  listo: {
    label: "Listo",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  entregado: {
    label: "Entregado",
    className: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-black text-[10px] uppercase tracking-widest px-3 py-1 border-2 rounded-lg shadow-inner",
        config.className,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}
