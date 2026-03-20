import type { OrderStatus } from "@/types";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<
  OrderStatus,
  {
    label: string;
    variant:
      | "pending"
      | "default"
      | "preparing"
      | "success"
      | "secondary"
      | "destructive";
  }
> = {
  pendiente: { label: "Pendiente", variant: "pending" },
  confirmado: { label: "Confirmado", variant: "default" },
  en_preparacion: { label: "En preparación", variant: "preparing" },
  listo: { label: "Listo", variant: "success" },
  entregado: { label: "Entregado", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
