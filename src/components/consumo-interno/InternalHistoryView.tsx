import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/formatPrice";
import { fetchConsumptions } from "@/lib/internalConsumptionService";
import {
  buildInternalConsumptionReceiptHTML,
} from "@/lib/internalReceiptUtils";
import { silentPrint } from "@/lib/receiptUtils";
import type { InternalConsumptionWithItems, InternalPaymentStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Printer,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthRange(monthStr: string): { start: string; end: string } {
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatMonthLabel(monthStr: string): string {
  const date = new Date(monthStr + "-01");
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "long" });
}

function navigateMonth(monthStr: string, delta: number): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_CONFIG: Record<
  InternalPaymentStatus,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  paid: {
    label: "Pagado",
    icon: CheckCircle,
    className: "bg-green-100 text-green-700 border-green-300",
  },
  pending: {
    label: "Pendiente",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-700 border-red-300",
  },
  partial: {
    label: "Parcial",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 border-amber-300",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function InternalHistoryView() {
  const { user } = useAuth();
  const { activeStore } = useStore();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { start, end } = getMonthRange(selectedMonth);

  const { data: consumptions = [], isLoading } = useQuery<
    InternalConsumptionWithItems[]
  >({
    queryKey: ["internal-history", selectedMonth, activeStore?.id],
    queryFn: () =>
      fetchConsumptions({
        storeId: activeStore?.id,
        monthStart: start,
        monthEnd: end,
      }),
    staleTime: 60 * 1000,
  });

  // ── Filtered ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = consumptions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.consumer_name.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter(
        (c) => c.payment_status === statusFilter,
      );
    }
    return result;
  }, [consumptions, searchQuery, statusFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReprint = async (consumption: InternalConsumptionWithItems) => {
    try {
      const html = buildInternalConsumptionReceiptHTML({
        consumption,
        storeName: activeStore?.name ?? "La 30",
        cashierName: user?.name ?? "Cajero",
      });
      await silentPrint(html, "Consumo Interno");
      toast.success("Tirilla reimpresa");
    } catch {
      toast.error("Error al reimprimir");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => setSelectedMonth(navigateMonth(selectedMonth, -1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-lg font-black capitalize">
            {formatMonthLabel(selectedMonth)}
          </p>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Historial de Consumos Internos
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => setSelectedMonth(navigateMonth(selectedMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 px-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <Input
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-2xl border-2 font-bold"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-12 w-full sm:w-48 rounded-2xl border-2 font-bold">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-strong p-2">
            <SelectItem
              value="all"
              className="rounded-xl font-bold py-2 px-3"
            >
              Todos
            </SelectItem>
            <SelectItem
              value="paid"
              className="rounded-xl font-bold py-2 px-3"
            >
              ✅ Pagado
            </SelectItem>
            <SelectItem
              value="pending"
              className="rounded-xl font-bold py-2 px-3"
            >
              🔴 Pendiente
            </SelectItem>
            <SelectItem
              value="partial"
              className="rounded-xl font-bold py-2 px-3"
            >
              ⚠️ Parcial
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Bar */}
      <div className="px-4">
        <div className="bg-accent/10 rounded-2xl p-4 flex flex-wrap items-center gap-6 text-xs font-bold">
          <span className="text-muted-foreground/60">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </span>
          <span>
            Total:{" "}
            <strong className="text-foreground">
              {formatPrice(
                filtered.reduce((sum, c) => sum + c.total, 0),
              )}
            </strong>
          </span>
          <span className="text-green-600">
            Pagados:{" "}
            {filtered.filter((c) => c.payment_status === "paid").length}
          </span>
          <span className="text-red-600">
            Pendientes:{" "}
            {filtered.filter((c) => c.payment_status === "pending").length}
          </span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-black uppercase tracking-[0.2em] text-[10px]">
            Cargando historial...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center space-y-4 opacity-20">
          <ClipboardList className="h-16 w-16 mx-auto" />
          <p className="font-black uppercase tracking-[0.3em] text-sm">
            Sin registros
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-10">
          {filtered.map((c) => {
            const date = new Date(c.created_at).toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            const statusCfg = STATUS_CONFIG[c.payment_status];
            const StatusIcon = statusCfg.icon;

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border-2 border-accent/20 p-5 space-y-3 hover:border-primary/10 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-black">{c.consumer_name}</p>
                    <p className="text-[10px] text-muted-foreground font-bold">
                      {c.consumer_type === "employee"
                        ? "Empleado"
                        : "Socio"}{" "}
                      · {date}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "text-[9px] font-black uppercase gap-1",
                      statusCfg.className,
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusCfg.label}
                  </Badge>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {(c.internal_consumption_items ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-xs"
                    >
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.product_name}
                        {item.is_beverage && (
                          <span className="text-amber-600 ml-1 text-[9px]">
                            (Bebida)
                          </span>
                        )}
                        {item.discount_percent > 0 && (
                          <span className="text-green-600 ml-1 text-[9px]">
                            (-{item.discount_percent}%)
                          </span>
                        )}
                      </span>
                      <span className="font-bold">
                        {formatPrice(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-accent/10">
                  <div className="text-xs text-muted-foreground">
                    Original:{" "}
                    <span className="line-through">
                      {formatPrice(c.total_original)}
                    </span>
                    <span className="text-green-600 ml-2">
                      Ahorro: {formatPrice(c.discount_total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black">
                      {formatPrice(c.total)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-[10px] font-black gap-1 h-8"
                      onClick={() => handleReprint(c)}
                    >
                      <Printer className="h-3 w-3" />
                      Reimprimir
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
