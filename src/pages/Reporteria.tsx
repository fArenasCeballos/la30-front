import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import type { OrderStatus } from "@/types";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import {
  FileText,
  Download,
  Filter,
  CalendarIcon,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Clock,
  Banknote,
  CreditCard,
  Smartphone,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  format,
  startOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { getCalendarShiftRange } from "@/lib/shiftUtils";
import type { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const QUICK_RANGES = [
  {
    label: "Hoy",
    getValue: () => ({
      from: startOfDay(new Date()),
      to: startOfDay(new Date()),
    }),
  },
  {
    label: "Ayer",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: startOfDay(subDays(new Date(), 1)),
    }),
  },
  {
    label: "Últimos 7 días",
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: startOfDay(new Date()),
    }),
  },
  {
    label: "Este mes",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: startOfDay(endOfMonth(new Date())),
    }),
  },
  {
    label: "Mes pasado",
    getValue: () => {
      const d = subDays(startOfMonth(new Date()), 1);
      return { from: startOfMonth(d), to: startOfDay(endOfMonth(d)) };
    },
  },
];

interface ReportOrder {
  id: string;
  locator: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  created_by: string;
  profiles?: { name: string };
  order_items?: {
    id: string;
    quantity: number;
    unit_price: number;
    extras_total: number;
    notes: string | null;
    selected_options: Record<string, string> | null;
    selected_extras: string[] | null;
    products: {
      name: string;
      categories: { name: string } | null;
    };
  }[];
}

interface ReportPayment {
  id: string;
  order_id: string;
  method: "efectivo" | "tarjeta" | "nequi" | "mixto";
  amount_total: number;
  amount_efectivo: number;
  amount_tarjeta: number;
  amount_nequi: number;
  created_at: string;
}

export default function Reporteria() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: startOfDay(new Date()),
  });
  const [activeQuick, setActiveQuick] = useState("Hoy");
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);

  const shiftRange = useMemo(() => {
    if (!dateRange?.from) return null;
    return getCalendarShiftRange(dateRange.from, dateRange.to);
  }, [dateRange]);

  const { data: reportOrders = [], isLoading } = useQuery({
    queryKey: ["report-orders", user?.id, dateRange],
    queryFn: async () => {
      if (!shiftRange) return [];
      const from = shiftRange.from.toISOString();
      const to = shiftRange.to.toISOString();

      // Fetch orders with nested profile and items
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, profiles:profiles!orders_created_by_fkey(name), order_items(*, products(*))",
        )
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as ReportOrder[]) || [];
    },
    enabled: !!user && !!shiftRange,
  });

  // Query de pagos para el desglose por método
  const { data: reportPayments = [] } = useQuery({
    queryKey: ["report-payments", user?.id, dateRange],
    queryFn: async () => {
      if (!shiftRange) return [];
      const from = shiftRange.from.toISOString();
      const to = shiftRange.to.toISOString();

      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, order_id, method, amount_total, amount_efectivo, amount_tarjeta, amount_nequi, created_at",
        )
        .gte("created_at", from)
        .lte("created_at", to);

      if (error) throw error;
      return (data as unknown as ReportPayment[]) || [];
    },
    enabled: !!user && !!shiftRange,
  });

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return reportOrders;
    return reportOrders.filter((o) => o.status === statusFilter);
  }, [reportOrders, statusFilter]);

  const summary = useMemo(() => {
    // Solo pedidos entregados cuentan para ventas reales
    const delivered = filteredOrders.filter((o) => o.status === "entregado");
    const cancelled = filteredOrders.filter((o) => o.status === "cancelado");
    const total = delivered.reduce((sum, o) => sum + o.total, 0);
    const avgTicket = delivered.length > 0 ? total / delivered.length : 0;
    const itemsSold = delivered.reduce(
      (sum, o) =>
        sum + (o.order_items?.reduce((s: number, i) => s + i.quantity, 0) || 0),
      0,
    );
    return {
      total,
      avgTicket,
      count: filteredOrders.length,
      itemsSold,
      delivered: delivered.length,
      cancelled: cancelled.length,
    };
  }, [filteredOrders]);

  const cashSummary = useMemo(() => {
    const delivered = reportOrders.filter((o) => o.status === "entregado");
    const pending = reportOrders.filter(
      (o) => !["entregado", "cancelado"].includes(o.status),
    );
    const cancelled = reportOrders.filter((o) => o.status === "cancelado");
    return {
      totalSales: delivered.reduce((s, o) => s + o.total, 0),
      deliveredCount: delivered.length,
      pendingCount: pending.length,
      pendingTotal: pending.reduce((s, o) => s + o.total, 0),
      cancelledCount: cancelled.length,
      cancelledTotal: cancelled.reduce((s, o) => s + o.total, 0),
      totalOrders: reportOrders.length,
    };
  }, [reportOrders]);

  // Desglose por método de pago
  // SOLO pagos de pedidos ENTREGADOS
  // NO mixto: method indica el método → amount_total es el monto real del pedido
  // Mixto: los sub-montos indican cómo se dividió el total entre métodos
  // (amount_efectivo guarda amount_received en pagos simples, NO sirve para el desglose)
  const paymentSummary = useMemo(() => {
    let efectivo = 0;
    let tarjeta = 0;
    let nequi = 0;

    // Solo contar pagos de pedidos entregados
    const deliveredOrderIds = new Set(
      reportOrders.filter((o) => o.status === "entregado").map((o) => o.id),
    );

    reportPayments
      .filter((p) => deliveredOrderIds.has(p.order_id))
      .forEach((p) => {
        if (p.method === "mixto") {
          // Pago mixto: usar sub-montos (representan la división real)
          efectivo += p.amount_efectivo || 0;
          tarjeta += p.amount_tarjeta || 0;
          nequi += p.amount_nequi || 0;
        } else {
          // Pago simple: usar method + amount_total (el total real del pedido)
          switch (p.method) {
            case "efectivo":
              efectivo += p.amount_total;
              break;
            case "tarjeta":
              tarjeta += p.amount_total;
              break;
            case "nequi":
              nequi += p.amount_total;
              break;
            default:
              efectivo += p.amount_total;
              break;
          }
        }
      });

    return { efectivo, tarjeta, nequi, total: efectivo + tarjeta + nequi };
  }, [reportPayments, reportOrders]);

  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    // Solo pedidos entregados en el gráfico de ventas por hora
    reportOrders
      .filter((o) => o.status === "entregado")
      .forEach((o) => {
        const h = new Date(o.created_at).getHours();
        hours[h] = (hours[h] || 0) + o.total;
      });
    return Array.from({ length: 24 }, (_, i) => ({
      hora: `${i}:00`,
      ventas: hours[i] || 0,
    })).filter((d) => d.ventas > 0);
  }, [reportOrders]);

  const waiterData = useMemo(() => {
    const map: Record<string, { name: string; orders: number; total: number }> =
      {};
    // Solo pedidos entregados cuentan como ventas reales por mesero
    reportOrders
      .filter((o) => o.status === "entregado")
      .forEach((o) => {
        const key = o.created_by;
        const name = o.profiles?.name || "Sistema";
        if (!map[key]) {
          map[key] = { name, orders: 0, total: 0 };
        }
        map[key].orders++;
        map[key].total += o.total;
      });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [reportOrders]);

  const handleQuickRange = (label: string) => {
    const range = QUICK_RANGES.find((r) => r.label === label);
    if (range) {
      setDateRange(range.getValue());
      setActiveQuick(label);
    }
  };

  const exportCSV = () => {
    const header = "Localizador,Estado,Items,Total,Fecha,Creado Por\n";
    const rows = filteredOrders
      .map(
        (o) =>
          `${o.locator},${o.status},${o.order_items?.length || 0},${o.total},${new Date(o.created_at).toLocaleString("es-CO")},${o.profiles?.name || "Sistema"}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_la30_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl font-bold">Reportería</h1>
        </div>
        <Button
          variant="outline"
          onClick={exportCSV}
          disabled={isLoading || reportOrders.length === 0}
        >
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Date range quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_RANGES.map((r) => (
          <Button
            key={r.label}
            variant={activeQuick === r.label ? "default" : "outline"}
            size="sm"
            onClick={() => handleQuickRange(r.label)}
          >
            {r.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(!dateRange && "text-muted-foreground")}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              {dateRange?.from
                ? dateRange.to
                  ? `${format(dateRange.from, "dd MMM", { locale: es })} - ${format(dateRange.to, "dd MMM", { locale: es })}`
                  : format(dateRange.from, "dd MMM yyyy", { locale: es })
                : "Rango personalizado"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                setActiveQuick("");
              }}
              numberOfMonths={2}
              locale={es}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="en_preparacion">En preparación</SelectItem>
            <SelectItem value="listo">Listo</SelectItem>
            <SelectItem value="entregado">Entregado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="caja">Cierre de Caja</TabsTrigger>
          <TabsTrigger value="meseros">Por Mesero</TabsTrigger>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
        </TabsList>

        {/* ===== RESUMEN ===== */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="pos-card">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Total ventas</p>
              </div>
              <p className="font-display text-xl font-bold">
                {formatPrice(summary.total)}
              </p>
            </div>
            <div className="pos-card">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Pedidos</p>
              </div>
              <p className="font-display text-xl font-bold">{summary.count}</p>
            </div>
            <div className="pos-card">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Ticket promedio</p>
              </div>
              <p className="font-display text-xl font-bold">
                {formatPrice(summary.avgTicket)}
              </p>
            </div>
            <div className="pos-card">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Items vendidos</p>
              </div>
              <p className="font-display text-xl font-bold">
                {summary.itemsSold}
              </p>
            </div>
          </div>

          {/* Desglose por método de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="h-5 w-5 text-emerald-500" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Efectivo
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-emerald-600">
                {formatPrice(paymentSummary.efectivo)}
              </p>
            </div>
            <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-blue-500" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Tarjeta
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-blue-600">
                {formatPrice(paymentSummary.tarjeta)}
              </p>
            </div>
            <div className="rounded-xl border-2 border-purple-500/30 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-5 w-5 text-purple-500" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Nequi / Transferencia
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-purple-600">
                {formatPrice(paymentSummary.nequi)}
              </p>
            </div>
          </div>

          <div className="pos-card">
            <h3 className="font-display font-bold mb-4">Ventas por hora</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="hora"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => formatPrice(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [
                      formatPrice(value),
                      "Ventas",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* ===== CIERRE DE CAJA ===== */}
        <TabsContent value="caja" className="space-y-4">
          <div className="pos-card">
            <h3 className="font-display font-bold text-lg mb-1">
              Cierre de Caja —{" "}
              {dateRange?.from
                ? format(dateRange.from, "dd MMMM yyyy", { locale: es })
                : "Hoy"}
              {dateRange?.to &&
                dateRange.from?.getTime() !== dateRange.to?.getTime() &&
                ` al ${format(dateRange.to, "dd MMMM yyyy", { locale: es })}`}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Resumen de operaciones del período seleccionado
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Ventas completadas
                </p>
                <p className="font-display text-2xl font-bold text-green-600">
                  {formatPrice(cashSummary.totalSales)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cashSummary.deliveredCount} pedidos entregados
                </p>
              </div>
              <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Pedidos en proceso
                </p>
                <p className="font-display text-2xl font-bold text-amber-600">
                  {formatPrice(cashSummary.pendingTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cashSummary.pendingCount} pedidos pendientes
                </p>
              </div>
              <div className="rounded-xl border-2 border-red-500/30 bg-red-500/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Cancelados</p>
                <p className="font-display text-2xl font-bold text-red-600">
                  {formatPrice(cashSummary.cancelledTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cashSummary.cancelledCount} pedidos cancelados
                </p>
              </div>
            </div>

            {/* Desglose por método de pago */}
            <div className="border-t pt-4 mb-4">
              <h4 className="font-display font-bold text-base mb-4">
                💰 Desglose por método de pago
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Banknote className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm text-muted-foreground">Efectivo</p>
                  </div>
                  <p className="font-display text-2xl font-bold text-emerald-600">
                    {formatPrice(paymentSummary.efectivo)}
                  </p>
                </div>
                <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    <p className="text-sm text-muted-foreground">Tarjeta</p>
                  </div>
                  <p className="font-display text-2xl font-bold text-blue-600">
                    {formatPrice(paymentSummary.tarjeta)}
                  </p>
                </div>
                <div className="rounded-xl border-2 border-purple-500/30 bg-purple-500/5 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Smartphone className="h-5 w-5 text-purple-500" />
                    <p className="text-sm text-muted-foreground">
                      Nequi / Transferencia
                    </p>
                  </div>
                  <p className="font-display text-2xl font-bold text-purple-600">
                    {formatPrice(paymentSummary.nequi)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 flex items-center justify-between">
              <span className="font-display font-bold text-lg">
                Total de órdenes del período
              </span>
              <span className="font-display font-bold text-2xl text-primary">
                {cashSummary.totalOrders}
              </span>
            </div>
          </div>
        </TabsContent>

        {/* ===== POR MESERO ===== */}
        <TabsContent value="meseros" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {waiterData.map((w) => (
              <div key={w.name} className="pos-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {w.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-display font-bold">{w.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.orders} pedidos
                    </p>
                  </div>
                </div>
                <p className="font-display text-xl font-bold text-primary">
                  {formatPrice(w.total)}
                </p>
              </div>
            ))}
            {waiterData.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                Sin datos en el rango seleccionado
              </p>
            )}
          </div>

          {waiterData.length > 0 && (
            <div className="pos-card">
              <h3 className="font-display font-bold mb-4">
                Ventas por operario
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waiterData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => formatPrice(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [
                        formatPrice(value),
                        "Ventas",
                      ]}
                    />
                    <Bar
                      dataKey="total"
                      fill="hsl(var(--primary))"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== DETALLE ===== */}
        <TabsContent value="detalle">
          <div className="space-y-2">
            {filteredOrders.length === 0 && (
              <p className="text-muted-foreground text-center py-12">
                Sin pedidos en el rango seleccionado
              </p>
            )}
            {filteredOrders.map((order) => {
              const isExpanded = expandedDetailId === order.id;
              const itemCount =
                order.order_items?.reduce(
                  (s: number, i) => s + i.quantity,
                  0,
                ) || 0;
              const hora = new Date(order.created_at).toLocaleTimeString(
                "es-CO",
                { hour: "2-digit", minute: "2-digit", hour12: true },
              );

              return (
                <div
                  key={order.id}
                  className={`pos-card overflow-hidden transition-all duration-200 ${isExpanded ? "ring-2 ring-primary/20" : "hover:bg-accent/50 cursor-pointer"}`}
                >
                  {/* Header — clickable */}
                  <button
                    onClick={() =>
                      setExpandedDetailId((prev) =>
                        prev === order.id ? null : order.id,
                      )
                    }
                    className="w-full flex items-center justify-between gap-3 p-0 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <span className="text-xl font-bold font-display">
                          #{order.locator}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {hora}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={order.status} />
                          <span className="text-xs text-muted-foreground">
                            {itemCount}{" "}
                            {itemCount === 1 ? "producto" : "productos"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-base font-bold">
                            {formatPrice(order.total)}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <User className="h-2.5 w-2.5" />
                            {order.profiles?.name || "Sistema"}
                          </span>
                        </div>
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
                                {item.quantity}x{" "}
                                {item.products?.name ?? "Producto"}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground ml-5.5 block">
                              {item.products?.categories?.name}
                            </span>
                            {item.selected_options &&
                              Object.keys(item.selected_options).length > 0 && (
                                <div className="ml-5.5 mt-0.5">
                                  {Object.entries(
                                    item.selected_options,
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
                            {item.selected_extras &&
                              item.selected_extras.length > 0 && (
                                <p className="text-[10px] text-muted-foreground ml-5.5 mt-0.5">
                                  +{" "}
                                  {item.selected_extras.join(
                                    ", ",
                                  )}
                                </p>
                              )}
                            {item.notes && (
                              <p className="text-[10px] text-amber-600 italic ml-5.5 mt-0.5">
                                "{item.notes}"
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-medium tabular-nums shrink-0">
                            {formatPrice(
                              item.unit_price * item.quantity +
                                (item.extras_total || 0),
                            )}
                          </span>
                        </div>
                      ))}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
