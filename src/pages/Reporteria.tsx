import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { OrderStatus } from "@/types";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import {
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
  User,
  Activity,
  ShoppingBag,
  MapPin,
  Award,
  ListChecks,
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
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

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
  const { activeStore } = useStore();
  const storeId = activeStore?.id;
  const [activeQuick, setActiveQuick] = useState("Hoy");
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);

  const shiftRange = useMemo(() => {
    if (!dateRange?.from) return null;
    return getCalendarShiftRange(dateRange.from, dateRange.to);
  }, [dateRange]);

  const { data: reportOrders = [], isLoading } = useQuery({
    queryKey: ["report-orders", user?.id, dateRange, storeId],
    queryFn: async () => {
      if (!shiftRange) return [];
      const from = shiftRange.from.toISOString();
      const to = shiftRange.to.toISOString();

      // Fetch orders with nested profile and items
      let query = supabase
        .from("orders")
        .select(
          "*, profiles:profiles!orders_created_by_fkey(name), order_items(*, products(*))",
        )
        .gte("created_at", from)
        .lte("created_at", to);

      if (storeId) {
        query = query.eq("store_id", storeId);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      return (data as unknown as ReportOrder[]) || [];
    },
    enabled: !!user && !!shiftRange,
  });

  // Query de pagos para el desglose por método
  const { data: reportPayments = [] } = useQuery({
    queryKey: ["report-payments", user?.id, dateRange, storeId],
    queryFn: async () => {
      if (!shiftRange) return [];
      const from = shiftRange.from.toISOString();
      const to = shiftRange.to.toISOString();

      const query = supabase
        .from("payments")
        .select(
          "id, order_id, method, amount_total, amount_efectivo, amount_tarjeta, amount_nequi, created_at",
        )
        .gte("created_at", from)
        .lte("created_at", to);

      if (storeId) {
        // We filter payments by joining with orders store_id if possible,
        // but since we already filter orders above, and we filter payments here by deliveredOrderIds below,
        // it might be redundant but safer to filter here if the table had store_id.
        // Wait, does payments have store_id? Let me check database.types.ts
      }

      const { data, error } = await query;

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

  const exportToExcel = () => {
    // 1. Sheet for Orders Summary
    const ordersData = filteredOrders.map((o) => ({
      ID: o.id,
      Localizador: o.locator,
      Estado: o.status.toUpperCase(),
      Total: o.total,
      "Items Qty": o.order_items?.length || 0,
      Fecha: format(new Date(o.created_at), "PPP pp", { locale: es }),
      "Creado Por": o.profiles?.name || "Sistema",
    }));

    // 2. Sheet for Detailed Items
    interface ExcelItemRow {
      "Order Loc": string;
      Producto: string | undefined;
      Cantidad: number;
      "Precio Unit": number;
      Extras: number;
      "Total Item": number;
      Opciones: string;
      Adicionales: string;
      Notas: string;
      Fecha: string;
    }
    const itemsData: ExcelItemRow[] = [];
    filteredOrders.forEach((o) => {
      o.order_items?.forEach((item) => {
        itemsData.push({
          "Order Loc": o.locator,
          Producto: item.products?.name,
          Cantidad: item.quantity,
          "Precio Unit": item.unit_price,
          Extras: item.extras_total,
          "Total Item": (item.unit_price + item.extras_total) * item.quantity,
          Opciones: item.selected_options
            ? JSON.stringify(item.selected_options)
            : "",
          Adicionales: item.selected_extras
            ? item.selected_extras.join(", ")
            : "",
          Notas: item.notes || "",
          Fecha: format(new Date(o.created_at), "PPP pp", { locale: es }),
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    const wsItems = XLSX.utils.json_to_sheet(itemsData);

    XLSX.utils.book_append_sheet(wb, wsOrders, "Ordenes");
    XLSX.utils.book_append_sheet(wb, wsItems, "Detalle Productos");

    XLSX.writeFile(
      wb,
      `Reporte_La30_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`,
    );
  };

  return (
    <Tabs defaultValue="resumen" className="w-full">
      <div className="section-container space-y-4 pb-32 animate-in fade-in duration-700 relative">
        {/* Modern Integrated Header */}
        <div className="sticky top-14 lg:top-16 2xl:top-20 z-40 bg-white/80 backdrop-blur-xl -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 border-b border-accent/10 shadow-sm transition-all duration-300 rounded-b-4xl">
          <div className="flex flex-col gap-4">
            {/* Top Row: Brand & Main Actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-2xl shrink-0">
                  <Activity
                    className="h-6 w-6 text-primary"
                    strokeWidth={2.5}
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-black tracking-tight text-foreground leading-none">
                    Reportería
                  </h1>
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-1">
                    {activeStore?.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="rounded-xl h-10 px-6 font-black shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all group bg-primary border-0"
                  onClick={exportToExcel}
                  disabled={isLoading || reportOrders.length === 0}
                >
                  <Download
                    className="h-4 w-4 mr-2 group-hover:animate-bounce transition-transform"
                    strokeWidth={3}
                  />
                  <span className="text-[10px] tracking-widest uppercase">
                    Exportar XLSX
                  </span>
                </Button>
              </div>
            </div>

            {/* Bottom Row: Controls & Navigation */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-accent/5">
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Selection */}
                <div className="flex items-center gap-2 bg-accent/5 p-1 rounded-2xl border border-accent/10">
                  <div className="flex no-scrollbar overflow-x-auto">
                    {QUICK_RANGES.map((r) => (
                      <button
                        key={r.label}
                        onClick={() => handleQuickRange(r.label)}
                        className={cn(
                          "px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all whitespace-nowrap",
                          activeQuick === r.label
                            ? "bg-white text-primary shadow-sm"
                            : "text-muted-foreground/40 hover:text-primary",
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <div className="w-px h-4 bg-accent/20 mx-1" />

                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 px-4 py-2 hover:bg-white rounded-xl transition-all group">
                        <CalendarIcon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 group-hover:text-primary">
                          {dateRange?.from
                            ? dateRange.to
                              ? `${format(dateRange.from, "dd MMM", { locale: es })} - ${format(dateRange.to, "dd MMM", { locale: es })}`
                              : format(dateRange.from, "dd MMM", { locale: es })
                            : "Calendario"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-3xl border-none shadow-strong overflow-hidden"
                      align="start"
                    >
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={(range) => {
                          setDateRange(range);
                          setActiveQuick("");
                        }}
                        numberOfMonths={2}
                        locale={es}
                        className="p-4"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44 h-10 rounded-2xl border-none bg-accent/5 font-black text-[10px] tracking-widest uppercase shadow-none hover:bg-accent/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <Filter
                        className="h-4 w-4 text-primary/40"
                        strokeWidth={2.5}
                      />
                      <SelectValue placeholder="Estado" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-strong p-1">
                    <SelectItem
                      value="all"
                      className="font-black text-[10px] tracking-widest uppercase py-3 rounded-xl"
                    >
                      Todos los Estados
                    </SelectItem>
                    {[
                      "pendiente",
                      "confirmado",
                      "en_preparacion",
                      "listo",
                      "entregado",
                      "cancelado",
                    ].map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        className="font-black text-[10px] tracking-widest uppercase py-3 rounded-xl"
                      >
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tabs Integration */}
              <TabsList className="bg-accent/5 p-1 rounded-2xl border border-accent/10 h-auto gap-1">
                {[
                  { value: "resumen", label: "Resumen", icon: TrendingUp },
                  { value: "caja", label: "Caja", icon: Banknote },
                  { value: "meseros", label: "Personal", icon: User },
                  { value: "detalle", label: "Auditoría", icon: ListChecks },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-xl px-5 py-2 font-black uppercase tracking-widest text-[9px] transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm flex items-center gap-2"
                  >
                    <tab.icon className="h-3.5 w-3.5" strokeWidth={3} />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
        </div>

        {/* ===== CONTENT AREA ===== */}
        <div className="space-y-8">
          {/* ===== RESUMEN ===== */}
          <TabsContent
            value="resumen"
            className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both outline-none"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {[
                {
                  label: "VENTAS NETAS",
                  value: formatPrice(summary.total),
                  icon: DollarSign,
                  color: "text-primary",
                  bg: "bg-primary/10",
                  accent: "primary",
                },
                {
                  label: "ÓRDENES",
                  value: summary.count,
                  icon: ShoppingCart,
                  color: "text-amber-600",
                  bg: "bg-amber-500/10",
                  accent: "amber",
                },
                {
                  label: "PROMEDIO",
                  value: formatPrice(summary.avgTicket),
                  icon: Award,
                  color: "text-green-600",
                  bg: "bg-green-500/10",
                  accent: "green",
                },
                {
                  label: "ITEMS",
                  value: summary.itemsSold,
                  icon: ShoppingBag,
                  color: "text-purple-600",
                  bg: "bg-purple-500/10",
                  accent: "purple",
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="pos-card p-4 lg:p-6 group overflow-hidden relative border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-white/60"
                >
                  <div className="flex items-center gap-3 mb-3 relative z-10">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 shadow-soft shrink-0",
                        card.bg,
                        card.color,
                      )}
                    >
                      <card.icon className="h-5 w-5" strokeWidth={3} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 leading-none">
                        {card.label}
                      </p>
                      <div className="h-0.5 w-6 bg-accent/20 rounded-full" />
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-lg lg:text-2xl font-black tracking-tighter transition-all duration-500 origin-left group-hover:scale-105 relative z-10",
                      card.color,
                    )}
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Payment Methods Visual Breakdown */}
              <div className="lg:col-span-1 space-y-10">
                <div className="flex items-center gap-3 px-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
                    MIX DE PAGOS
                  </h3>
                </div>
                <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-4">
                  {[
                    {
                      label: "Efectivo",
                      amount: paymentSummary.efectivo,
                      icon: Banknote,
                      color: "emerald",
                    },
                    {
                      label: "Datáfono",
                      amount: paymentSummary.tarjeta,
                      icon: CreditCard,
                      color: "blue",
                    },
                    {
                      label: "Digital",
                      amount: paymentSummary.nequi,
                      icon: Smartphone,
                      color: "purple",
                    },
                  ].map((p) => (
                    <div
                      key={p.label}
                      className="pos-card p-3 lg:p-4 group border-2 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] bg-white/60"
                    >
                      <div className="flex flex-col lg:flex-row items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center transition-all group-hover:rotate-12 duration-500 shadow-soft shrink-0",
                              p.color === "emerald"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : p.color === "blue"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-purple-500/10 text-purple-600",
                            )}
                          >
                            <p.icon className="h-4 w-4" strokeWidth={2.5} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none truncate">
                              {p.label}
                            </p>
                            <p
                              className={cn(
                                "text-xs lg:text-xl font-black tracking-tighter truncate",
                                p.color === "emerald"
                                  ? "text-emerald-600"
                                  : p.color === "blue"
                                    ? "text-blue-600"
                                    : "text-purple-600",
                              )}
                            >
                              {formatPrice(p.amount)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right hidden xl:block">
                          <p className="text-xl font-black text-muted-foreground/20 italic">
                            {paymentSummary.total > 0
                              ? Math.round(
                                  (p.amount / paymentSummary.total) * 100,
                                )
                              : 0}
                            %
                          </p>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-accent/10 rounded-full overflow-hidden border border-white">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            p.color === "emerald"
                              ? "bg-emerald-500"
                              : p.color === "blue"
                                ? "bg-blue-500"
                                : "bg-purple-500",
                          )}
                          style={{
                            width: `${paymentSummary.total > 0 ? (p.amount / paymentSummary.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hourly Chart */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center gap-3 px-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
                    CURVA DE VENTAS
                  </h3>
                </div>
                <div className="pos-card p-6 lg:p-8 h-[380px] border-2 bg-white/80 backdrop-blur-xl relative overflow-hidden group shadow-md">
                  <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-primary/20 to-transparent" />

                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="text-xl font-black tracking-tight uppercase">
                        Distribución Horaria
                      </h4>
                    </div>
                    <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                      <p className="text-[8px] font-black text-primary tracking-widest">
                        REAL TIME
                      </p>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height="75%">
                    <LineChart
                      data={hourlyData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorSales"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="8 8"
                        stroke="hsl(var(--border))"
                        vertical={false}
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="hora"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        fontWeight={900}
                        axisLine={false}
                        tickLine={false}
                        dy={20}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        fontWeight={900}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${v / 1000}k`}
                        dx={-15}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255, 255, 255, 0.95)",
                          backdropFilter: "blur(20px)",
                          border: "1px solid white",
                          borderRadius: "32px",
                          boxShadow: "0 25px 60px -12px rgba(0,0,0,0.2)",
                          padding: "24px",
                        }}
                        itemStyle={{
                          color: "hsl(var(--primary))",
                          fontWeight: 900,
                          fontSize: "18px",
                        }}
                        labelStyle={{
                          fontWeight: 900,
                          color: "hsl(var(--muted-foreground))",
                          marginBottom: "8px",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.2em",
                        }}
                        formatter={(value: number) => [
                          formatPrice(value),
                          "Ventas",
                        ]}
                        cursor={{
                          stroke: "hsl(var(--primary))",
                          strokeWidth: 3,
                          strokeDasharray: "10 10",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ventas"
                        stroke="hsl(var(--primary))"
                        strokeWidth={8}
                        dot={{
                          r: 10,
                          fill: "white",
                          stroke: "hsl(var(--primary))",
                          strokeWidth: 4,
                        }}
                        activeDot={{
                          r: 14,
                          strokeWidth: 0,
                          fill: "hsl(var(--primary))",
                        }}
                        animationDuration={2500}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ===== CIERRE DE CAJA ===== */}
          <TabsContent
            value="caja"
            className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both outline-none"
          >
            <div className="pos-card bg-white/60 backdrop-blur-3xl p-6 lg:p-10 border-4 border-white rounded-3xl lg:rounded-[2.5rem] shadow-strong relative overflow-hidden group">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 relative">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tighter uppercase">
                    Estado de Caja
                  </h2>
                  <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Período:{" "}
                    {dateRange?.from
                      ? format(dateRange.from, "PPP", { locale: es })
                      : "Hoy"}
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-primary/5 p-4 lg:p-6 rounded-2xl border border-primary/10">
                  <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-md">
                    <DollarSign className="h-6 w-6" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-primary/40 tracking-[0.2em] uppercase leading-none mb-1">
                      VENTAS TOTALES
                    </p>
                    <p className="text-2xl lg:text-3xl font-black tracking-tighter text-primary leading-none">
                      {formatPrice(cashSummary.totalSales)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {[
                  {
                    label: "EFECTIVO",
                    amount: paymentSummary.efectivo,
                    icon: Banknote,
                    color: "emerald",
                  },
                  {
                    label: "DATÁFONO",
                    amount: paymentSummary.tarjeta,
                    icon: CreditCard,
                    color: "blue",
                  },
                  {
                    label: "DIGITAL",
                    amount: paymentSummary.nequi,
                    icon: Smartphone,
                    color: "purple",
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="bg-white/40 p-6 rounded-2xl border-2 border-white shadow-soft group hover:scale-[1.02] transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-12",
                          m.color === "blue"
                            ? "bg-blue-500/10 text-blue-600"
                            : m.color === "purple"
                              ? "bg-purple-500/10 text-purple-600"
                              : "bg-emerald-500/10 text-emerald-600",
                        )}
                      >
                        <m.icon className="h-5 w-5" strokeWidth={2.5} />
                      </div>
                      <span className="text-[9px] font-black text-muted-foreground/40 tracking-widest uppercase">
                        {m.label}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-2xl font-black tracking-tighter",
                        m.color === "blue"
                          ? "text-blue-600"
                          : m.color === "purple"
                            ? "text-purple-600"
                            : "text-emerald-600",
                      )}
                    >
                      {formatPrice(m.amount)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 px-3">
                    <div className="h-2 w-2 rounded-full bg-accent/30" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
                      DESGLOSE OPERATIVO
                    </h3>
                  </div>
                  <div className="bg-white/40 rounded-2xl border-2 border-white shadow-soft p-6 lg:p-8 space-y-4">
                    {[
                      {
                        label: "Pedidos Entregados",
                        count: cashSummary.deliveredCount,
                        color: "text-green-600",
                        bg: "bg-green-500/10",
                      },
                      {
                        label: "Pedidos Pendientes",
                        count: cashSummary.pendingCount,
                        color: "text-amber-600",
                        bg: "bg-amber-500/10",
                      },
                      {
                        label: "Pedidos Cancelados",
                        count: cashSummary.cancelledCount,
                        color: "text-destructive",
                        bg: "bg-red-500/10",
                      },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 lg:p-4 rounded-xl hover:bg-white/50 transition-colors group"
                      >
                        <span className="font-bold text-sm lg:text-base text-muted-foreground/70">
                          {stat.label}
                        </span>
                        <div
                          className={cn(
                            "px-4 py-1.5 rounded-xl font-black text-base shadow-inner group-hover:scale-110 transition-transform",
                            stat.bg,
                            stat.color,
                          )}
                        >
                          {stat.count}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2 px-3">
                    <div className="h-2 w-2 rounded-full bg-primary/20" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
                      BALANCE FINAL
                    </h3>
                  </div>
                  <div className="bg-primary p-8 lg:p-10 rounded-2xl lg:rounded-4xl shadow-lg shadow-primary/20 relative overflow-hidden group">
                    <p className="text-white/60 font-black text-[9px] tracking-[0.4em] uppercase mb-1">
                      GRAN TOTAL
                    </p>
                    <p className="text-4xl lg:text-5xl font-black text-white tracking-tighter mb-4 group-hover:scale-105 transition-transform origin-left">
                      {formatPrice(cashSummary.totalSales)}
                    </p>
                    <div className="flex items-center gap-3 py-2 px-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-md">
                      <TrendingUp className="h-4 w-4 text-white/60" />
                      <p className="text-white/80 font-bold text-[10px] lg:text-xs">
                        Liquidación de caja consolidada.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-accent/10 rounded-4xl lg:rounded-[3rem] p-6 lg:p-12 border-2 border-accent/20 relative group/section">
              <div className="flex items-center gap-3 lg:gap-4 mb-6 lg:mb-10 relative">
                <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-lg lg:rounded-xl bg-white border-2 shadow-soft flex items-center justify-center text-primary group-hover/section:scale-110 transition-transform">
                  <Banknote className="h-5 w-5 lg:h-6 lg:w-6" />
                </div>
                <h4 className="text-xl lg:text-2xl font-black tracking-tight text-foreground/80">
                  Liquidación por Medios de Pago
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {[
                  {
                    label: "Caja (Efectivo)",
                    value: paymentSummary.efectivo,
                    icon: Banknote,
                    color: "emerald",
                  },
                  {
                    label: "Datáfono (Tarjetas)",
                    value: paymentSummary.tarjeta,
                    icon: CreditCard,
                    color: "blue",
                  },
                  {
                    label: "Digital (Nequi/Transferencia)",
                    value: paymentSummary.nequi,
                    icon: Smartphone,
                    color: "purple",
                  },
                ].map((p) => (
                  <div
                    key={p.label}
                    className="bg-white/80 p-6 lg:p-8 rounded-2xl lg:rounded-3xl shadow-strong border-2 border-transparent hover:border-primary/20 transition-all duration-500 group/item hover:scale-105"
                  >
                    <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
                      <div
                        className={cn(
                          "h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-soft",
                          p.color === "emerald"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : p.color === "blue"
                              ? "bg-blue-500/10 text-blue-600"
                              : p.color === "purple"
                                ? "bg-purple-500/10 text-purple-600"
                                : "bg-primary/10 text-primary",
                        )}
                      >
                        <p.icon
                          className="h-5 w-5 lg:h-6 lg:w-6"
                          strokeWidth={2.5}
                        />
                      </div>
                      <p className="text-[10px] lg:text-[11px] font-black uppercase text-muted-foreground/40 tracking-widest leading-tight">
                        {p.label}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-2xl lg:text-3xl font-black tracking-tighter",
                        p.color === "emerald"
                          ? "text-emerald-600"
                          : p.color === "blue"
                            ? "text-blue-600"
                            : p.color === "purple"
                              ? "text-purple-600"
                              : "text-primary",
                      )}
                    >
                      {formatPrice(p.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ===== VENTAS POR PERSONAL ===== */}
          <TabsContent
            value="meseros"
            className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both outline-none"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
              {waiterData.map((w, idx) => (
                <div
                  key={w.name}
                  className="pos-card p-10 group overflow-hidden relative border-4 border-white shadow-strong hover:scale-[1.05] transition-all duration-700"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="absolute -right-8 -top-8 h-40 w-40 bg-primary/5 rounded-full blur-[60px] group-hover:bg-primary/15 transition-all duration-1000" />

                  <div className="flex flex-col items-center text-center space-y-6 mb-10 relative">
                    <div className="w-24 h-24 rounded-4xl bg-linear-to-br from-primary/80 to-primary flex items-center justify-center text-white font-black text-4xl shadow-strong shadow-primary/20 group-hover:rotate-12 transition-all duration-500">
                      {w.name.charAt(0)}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-black text-2xl tracking-tighter text-foreground group-hover:text-primary transition-colors">
                        {w.name}
                      </h3>
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/5 rounded-full border border-primary/10">
                        <Award className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">
                          {w.orders} SERVICIOS
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/40 p-8 rounded-4xl border-2 border-white shadow-soft relative group/amount">
                    <p className="text-[10px] font-black uppercase text-muted-foreground/30 tracking-[0.3em] mb-2">
                      VENTAS ACUMULADAS
                    </p>
                    <p className="text-3xl font-black text-primary tracking-tighter">
                      {formatPrice(w.total)}
                    </p>
                    <div className="absolute right-6 bottom-6 h-2 w-2 rounded-full bg-primary/20 animate-pulse" />
                  </div>
                </div>
              ))}

              {waiterData.length === 0 && (
                <div className="col-span-full py-48 flex flex-col items-center justify-center space-y-8 bg-white/40 rounded-[4rem] border-4 border-white shadow-soft border-dashed animate-pulse">
                  <div className="h-28 w-28 rounded-[2.5rem] bg-accent/10 flex items-center justify-center text-muted-foreground/20">
                    <User className="h-14 w-14" strokeWidth={2.5} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-black uppercase tracking-[0.5em] text-sm text-muted-foreground/40">
                      SIN REGISTROS DE PERSONAL
                    </p>
                    <p className="text-xs font-bold text-muted-foreground/30 italic">
                      No hay actividad detectada en el periodo seleccionado
                    </p>
                  </div>
                </div>
              )}
            </div>

            {waiterData.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
                    DESEMPEÑO POR PERSONAL
                  </h3>
                </div>
                <div className="pos-card p-4 lg:p-6 h-[300px] border-2 shadow-md bg-white/80 backdrop-blur-md relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-primary/20 to-transparent" />
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={waiterData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="hsl(var(--border))"
                        vertical={false}
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        fontWeight={900}
                        axisLine={false}
                        tickLine={false}
                        dy={20}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        fontWeight={900}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${v / 1000}k`}
                        dx={-15}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255, 255, 255, 0.9)",
                          backdropFilter: "blur(10px)",
                          border: "2px solid hsl(var(--primary)/10%)",
                          borderRadius: "24px",
                          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.15)",
                          padding: "20px",
                        }}
                        itemStyle={{
                          color: "hsl(var(--primary))",
                          fontWeight: 900,
                          fontSize: "16px",
                        }}
                        labelStyle={{
                          fontWeight: 900,
                          color: "hsl(var(--muted-foreground))",
                          marginBottom: "6px",
                          fontSize: "12px",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                        cursor={{
                          fill: "hsl(var(--primary))",
                          opacity: 0.05,
                          radius: 20,
                        }}
                        formatter={(value: number) => [
                          formatPrice(value),
                          "Total Vendido",
                        ]}
                      />
                      <Bar
                        dataKey="total"
                        fill="hsl(var(--primary))"
                        radius={[16, 16, 8, 8]}
                        barSize={60}
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== DETALLE HISTORICO ===== */}
          <TabsContent
            value="detalle"
            className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both outline-none"
          >
            <div className="space-y-8 pb-20">
              {filteredOrders.length === 0 ? (
                <div className="py-48 flex flex-col items-center justify-center space-y-10 bg-white/40 rounded-[4rem] border-4 border-white shadow-soft group">
                  <div className="h-32 w-32 rounded-[2.5rem] bg-accent/5 flex items-center justify-center text-muted-foreground/20 group-hover:scale-110 transition-transform duration-700">
                    <ShoppingCart className="h-16 w-16" strokeWidth={1.5} />
                  </div>
                  <div className="text-center space-y-3">
                    <p className="font-black uppercase tracking-[0.5em] text-sm text-muted-foreground/40">
                      ARCHIVO VACÍO
                    </p>
                    <p className="text-xs font-bold text-muted-foreground/20 italic max-w-xs mx-auto">
                      Ajusta los filtros para explorar el historial de
                      transacciones.
                    </p>
                  </div>
                </div>
              ) : (
                filteredOrders.map((order, idx) => {
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
                      className={cn(
                        "pos-card overflow-hidden transition-all duration-500 border-4 relative group",
                        isExpanded
                          ? "border-primary/40 shadow-strong bg-white scale-[1.02] z-10"
                          : "border-white bg-white/60 hover:bg-white hover:border-primary/20 hover:shadow-xl cursor-pointer",
                      )}
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      {/* Header — clickable */}
                      <button
                        onClick={() =>
                          setExpandedDetailId((prev) =>
                            prev === order.id ? null : order.id,
                          )
                        }
                        className="w-full flex items-center justify-between gap-6 p-4 lg:p-6 text-left"
                      >
                        <div className="flex items-center gap-6 min-w-0">
                          <div
                            className={cn(
                              "w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 shadow-md transition-all duration-300",
                              isExpanded
                                ? "bg-primary text-white border-primary/10"
                                : "bg-white border-white text-primary",
                            )}
                          >
                            <span className="text-[8px] font-black opacity-40 uppercase leading-none mb-1">
                              ORD
                            </span>
                            <span className="text-xl font-black">
                              {order.locator}
                            </span>
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <StatusBadge
                                status={order.status}
                                className="scale-75 origin-left"
                              />
                              <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest bg-white/80 px-3 py-1 rounded-full border border-white">
                                {itemCount} {itemCount === 1 ? "ART" : "ARTS"} •{" "}
                                {hora}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="text-xl lg:text-2xl font-black tracking-tighter text-foreground">
                                {formatPrice(order.total)}
                              </p>
                              <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-lg border border-primary/10">
                                <User className="h-3 w-3 text-primary/40" />
                                <span className="text-[8px] font-black text-primary uppercase tracking-widest">
                                  {order.profiles?.name || "SISTEMA"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center border transition-all duration-300",
                            isExpanded
                              ? "bg-primary text-white"
                              : "bg-white text-muted-foreground",
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 transition-transform duration-300",
                              isExpanded && "rotate-180",
                            )}
                            strokeWidth={3}
                          />
                        </div>
                      </button>

                      {/* Detailed Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.5, ease: "circOut" }}
                            className="overflow-hidden"
                          >
                            <div className="p-6 lg:p-12 bg-accent/5 border-t-4 border-dashed border-white/60">
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                                <div className="lg:col-span-7 space-y-6 lg:space-y-8">
                                  <div className="flex items-center gap-3 lg:gap-4 px-2">
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    <h4 className="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                                      DESGLOSE DE CONSUMO
                                    </h4>
                                  </div>
                                  <div className="bg-white/80 backdrop-blur-md rounded-4xl lg:rounded-[3rem] p-6 lg:p-10 border-4 border-white shadow-strong">
                                    <div className="divide-y divide-accent/30">
                                      {order.order_items?.map((item) => (
                                        <div
                                          key={item.id}
                                          className="py-4 lg:py-8 first:pt-0 last:pb-0 group/item"
                                        >
                                          <div className="flex justify-between items-start mb-2 lg:mb-3">
                                            <div className="flex gap-4 lg:gap-6">
                                              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-base lg:text-lg border border-primary/5 shadow-inner">
                                                {item.quantity}
                                              </div>
                                              <div className="space-y-0.5 lg:space-y-1">
                                                <p className="font-black text-lg lg:text-xl text-foreground/80 group-hover/item:text-primary transition-colors">
                                                  {item.products?.name}
                                                </p>
                                                <p className="text-[9px] lg:text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                                                  P. UNITARIO:{" "}
                                                  {formatPrice(item.unit_price)}
                                                </p>
                                              </div>
                                            </div>
                                            <p className="font-black text-xl lg:text-2xl tracking-tighter text-foreground/90">
                                              {formatPrice(
                                                item.unit_price * item.quantity,
                                              )}
                                            </p>
                                          </div>

                                          {(item.selected_options ||
                                            item.selected_extras ||
                                            item.notes) && (
                                            <div className="ml-16 mt-4 p-5 bg-accent/5 rounded-2xl border border-accent/10 space-y-2">
                                              {item.selected_options &&
                                                Object.entries(
                                                  item.selected_options,
                                                ).map(([key, val]) => (
                                                  <p
                                                    key={key}
                                                    className="text-xs text-muted-foreground/60 font-bold uppercase tracking-wider flex items-center gap-2"
                                                  >
                                                    <div className="h-1 w-1 rounded-full bg-primary/40" />
                                                    <span className="opacity-40">
                                                      {key}:
                                                    </span>{" "}
                                                    {val}
                                                  </p>
                                                ))}
                                              {item.selected_extras &&
                                                item.selected_extras.length >
                                                  0 && (
                                                  <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-wider flex items-center gap-2">
                                                    <div className="h-1 w-1 rounded-full bg-primary/40" />
                                                    <span className="opacity-40">
                                                      Extras:
                                                    </span>{" "}
                                                    {item.selected_extras.join(
                                                      ", ",
                                                    )}
                                                  </p>
                                                )}
                                              {item.notes && (
                                                <p className="text-xs text-primary font-black italic flex items-center gap-3 mt-3 bg-white/50 p-3 rounded-xl border border-primary/10">
                                                  <ListChecks className="h-4 w-4" />
                                                  "{item.notes}"
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="lg:col-span-5 space-y-12">
                                  <div className="space-y-8">
                                    <div className="flex items-center gap-4 px-2">
                                      <div className="h-2 w-2 rounded-full bg-primary" />
                                      <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                                        TRAZABILIDAD LOGÍSTICA
                                      </h4>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-md rounded-[3rem] p-10 border-4 border-white shadow-strong grid grid-cols-2 gap-10">
                                      {[
                                        {
                                          label: "REGISTRO",
                                          val: format(
                                            new Date(order.created_at),
                                            "PPP",
                                            { locale: es },
                                          ),
                                          icon: CalendarIcon,
                                        },
                                        {
                                          label: "CANAL",
                                          val: "TERMINAL POS",
                                          icon: Smartphone,
                                        },
                                        {
                                          label: "OPERADOR",
                                          val:
                                            order.profiles?.name || "SISTEMA",
                                          icon: User,
                                        },
                                        {
                                          label: "UBICACIÓN",
                                          val: activeStore?.name,
                                          icon: MapPin,
                                        },
                                      ].map((info, i) => (
                                        <div key={i} className="space-y-2">
                                          <div className="flex items-center gap-2 opacity-30">
                                            <info.icon className="h-3 w-3" />
                                            <p className="text-[9px] font-black uppercase tracking-[0.3em]">
                                              {info.label}
                                            </p>
                                          </div>
                                          <p className="text-sm font-black text-foreground/80 leading-tight">
                                            {info.val}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="bg-primary p-12 rounded-[3.5rem] shadow-strong shadow-primary/20 relative overflow-hidden group/total">
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 transition-all duration-1000 group-hover/total:bg-white/20" />
                                    <div className="flex justify-between items-center relative">
                                      <div className="space-y-2">
                                        <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/50 leading-none">
                                          TOTAL NETO
                                        </p>
                                        <p className="text-6xl font-black text-white tracking-tighter group-hover/total:scale-110 transition-transform origin-left duration-700">
                                          {formatPrice(order.total)}
                                        </p>
                                      </div>
                                      <div className="h-20 w-20 rounded-3xl bg-white/10 flex items-center justify-center border-2 border-white/10 shadow-inner group-hover/total:rotate-12 transition-transform duration-700">
                                        <DollarSign
                                          className="h-10 w-10 text-white"
                                          strokeWidth={3}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
