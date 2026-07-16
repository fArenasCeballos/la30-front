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
  ChevronLeft,
  ChevronRight,
  User,
  Activity,
  ShoppingBag,
  MapPin,
  Award,
  ListChecks,
  FileText,
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
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { getCalendarShiftRange } from "@/lib/shiftUtils";
import type { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { ReportLoadingModal } from "@/components/ReportLoadingModal";

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
  is_delivery: boolean;
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
  siigo_invoice_id?: string | null;
  siigo_invoice_number?: string | null;
  siigo_invoices?: {
    id: string;
    siigo_invoice_id: string | null;
    siigo_invoice_number: string | null;
    status: string;
    payment_method: string;
    response_payload?: { public_url?: string; [key: string]: unknown } | null;
  }[];
}

interface ReportStatsData {
  total_sales: number;
  active_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  avg_ticket: number;
  delivery_total: number;
  delivery_pending: number;
  caja_total: number;
  cash_total: number;
  card_total: number;
  nequi_total: number;
  siesa_total: number;
  transfer_total: number;
  pending_total: number;
  items_sold: number;
  sales_by_day: { date: string; ventas: number }[];
  sales_by_hour: { hora: string; ventas: number }[];
  top_products: { product_name: string; quantity: number }[];
  waiter_stats: { name: string; orders: number; total: number }[];
}

export default function Reporteria() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: startOfDay(new Date()),
  });
  const { activeStore } = useStore();
  const storeId = activeStore?.id;
  const [activeQuick, setActiveQuick] = useState("Hoy");
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "caja" | "delivery">(
    "all",
  );

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [isExporting, setIsExporting] = useState(false);

  const shiftRange = useMemo(() => {
    if (!dateRange?.from) return null;
    // Cada día seleccionado representa su turno: 4:00 PM del día → 4:00 AM del día siguiente.
    // Para un rango: from = primer día a las 16:00, to = (último día + 1) a las 04:00.
    return getCalendarShiftRange(dateRange.from, dateRange.to);
  }, [dateRange]);

  const { data: reportStatsRaw, isLoading: isStatsLoading } = useQuery({
    queryKey: [
      "report-stats",
      user?.id,
      shiftRange?.from?.toISOString(),
      shiftRange?.to?.toISOString(),
      storeId,
      typeFilter,
    ],
    queryFn: async () => {
      if (!shiftRange) return null;
      const from = shiftRange.from.toISOString();
      const to = shiftRange.to.toISOString();

      const { data, error } = await supabase.rpc("get_reporteria_stats", {
        p_start: from,
        p_end: to,
        p_store_id: activeStore?.slug === "domicilios" ? null : storeId,
        p_type_filter: typeFilter,
      });

      if (error) throw error;
      return data as unknown as ReportStatsData;
    },
    enabled: !!user && !!shiftRange,
  });

  const { data: pagedOrdersResponse = { data: [], count: 0 }, isLoading: isOrdersLoading } = useQuery({
    queryKey: [
      "paged-orders",
      user?.id,
      shiftRange?.from?.toISOString(),
      shiftRange?.to?.toISOString(),
      storeId,
      typeFilter,
      statusFilter,
      page,
    ],
    queryFn: async () => {
      if (!shiftRange) return { data: [], count: 0 };
      const from = shiftRange.from.toISOString();
      const to = shiftRange.to.toISOString();

      let query = supabase
        .from("orders")
        .select(
          "*, profiles:profiles!orders_created_by_fkey(name), order_items(*, products(*)), siigo_invoices(*)",
          { count: "exact" }
        )
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (storeId && activeStore?.slug !== "domicilios") {
        query = query.eq("store_id", storeId);
      }

      if (activeStore?.slug === "domicilios" && typeFilter !== "all") {
        if (typeFilter === "delivery") query = query.eq("is_delivery", true);
        if (typeFilter === "caja")
          query = query.filter("is_delivery", "in", "(false,null)");
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as unknown as ReportOrder[], count: count ?? 0 };
    },
    enabled: !!user && !!shiftRange,
  });

  // ── Derived state ────────────────────────────────────────────────────────────
  const isMultiDay =
    dateRange?.from && dateRange?.to
      ? !isSameDay(dateRange.from, dateRange.to)
      : false;

  const isLoading = isStatsLoading || isOrdersLoading || isExporting;

  const reportStats: ReportStatsData =
    reportStatsRaw ?? ({} as ReportStatsData);

  const summary = {
    total: reportStats.total_sales ?? 0,
    avgTicket: reportStats.avg_ticket ?? 0,
    count:
      (reportStats.completed_orders ?? 0) +
      (reportStats.active_orders ?? 0) +
      (reportStats.cancelled_orders ?? 0),
    itemsSold: reportStats.items_sold ?? 0,
    delivered: reportStats.completed_orders ?? 0,
    cancelled: reportStats.cancelled_orders ?? 0,
  };

  const cashSummary = {
    totalSales: reportStats.total_sales ?? 0,
    deliveredCount: reportStats.completed_orders ?? 0,
    pendingCount: reportStats.active_orders ?? 0,
    pendingTotal: reportStats.delivery_pending ?? 0,
    cancelledCount: reportStats.cancelled_orders ?? 0,
    cancelledTotal: 0,
    totalOrders:
      (reportStats.completed_orders ?? 0) +
      (reportStats.active_orders ?? 0) +
      (reportStats.cancelled_orders ?? 0),
  };

  const paymentSummary = {
    efectivo: reportStats.cash_total ?? 0,
    tarjeta: reportStats.card_total ?? 0,
    nequi: reportStats.nequi_total ?? 0,
    total:
      (reportStats.cash_total ?? 0) +
      (reportStats.card_total ?? 0) +
      (reportStats.nequi_total ?? 0),
  };

  const hourlyData: { hora?: string; date?: string; ventas: number }[] =
    isMultiDay
      ? (reportStats.sales_by_day ?? [])
      : (reportStats.sales_by_hour ?? []);

  const waiterData = reportStats.waiter_stats ?? [];

  const pagedOrders = pagedOrdersResponse.data;
  const totalPages = Math.ceil(pagedOrdersResponse.count / PAGE_SIZE) || 1;
  const reportOrders = pagedOrders;

  const renderPagination = () => {
    if (pagedOrdersResponse.count === 0) return null;
    return (
      <div className="flex items-center justify-between py-2 border-accent/10">
        <Button
          variant="outline"
          onClick={() => {
            setPage((p) => Math.max(0, p - 1));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          disabled={page === 0}
          className="rounded-xl h-12 px-6 font-bold text-[10px] tracking-widest uppercase border-accent/20 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Anterior
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
            Página {page + 1} de {totalPages}
          </span>
          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
            {pagedOrdersResponse.count} Registros
          </span>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPage((p) => p + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          disabled={page >= totalPages - 1}
          className="rounded-xl h-12 px-6 font-bold text-[10px] tracking-widest uppercase border-accent/20 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
        >
          Siguiente
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  };

  // ── Export helper ─────────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    if (!shiftRange) return;
    setIsExporting(true);
    try {
      const from = shiftRange.from.toISOString();
      const to = shiftRange.to.toISOString();

      let query = supabase
        .from("orders")
        .select(
          "*, profiles:profiles!orders_created_by_fkey(name), order_items(*, products(*))",
        )
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false });

      if (storeId && activeStore?.slug !== "domicilios") {
        query = query.eq("store_id", storeId);
      }

      if (activeStore?.slug === "domicilios" && typeFilter !== "all") {
        if (typeFilter === "delivery") query = query.eq("is_delivery", true);
        if (typeFilter === "caja")
          query = query.filter("is_delivery", "in", "(false,null)");
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: allExportOrders, error } = await query;
      if (error) throw error;

      const ordersToExport =
        (allExportOrders as unknown as ReportOrder[]) ?? [];

      const ordersData = ordersToExport.map((o) => ({
        ID: o.id,
        Localizador: o.locator,
        Estado: o.status.toUpperCase(),
        Total: o.total,
        "Items Qty": o.order_items?.length ?? 0,
        Fecha: format(new Date(o.created_at), "PPP pp", { locale: es }),
        "Creado Por": o.profiles?.name ?? "Sistema",
      }));

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
      ordersToExport.forEach((o) => {
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
            Notas: item.notes ?? "",
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
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Quick range helper ────────────────────────────────────────────────────────
  const handleQuickRange = (label: string) => {
    const range = QUICK_RANGES.find((r) => r.label === label);
    if (range) {
      setDateRange(range.getValue());
      setActiveQuick(label);
      setPage(0);
    }
  };

  return (
    <>
      <ReportLoadingModal isLoading={isLoading && isMultiDay} />
      <Tabs defaultValue="resumen" className="w-full">
        <div className="section-container space-y-4 pb-32 animate-in fade-in duration-700 relative">
          {/* Modern Integrated Header */}
          {/* Modern Integrated Header */}
          <div className="sticky top-14 lg:top-16 z-40 bg-white/95 backdrop-blur-xl -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-3 lg:py-4 border-b border-accent/10 shadow-sm transition-all duration-300 rounded-b-3xl lg:rounded-b-4xl">
            <div className="flex flex-col gap-3 lg:gap-4">
              {/* Top Row: Brand & Main Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                  <div className="bg-primary/10 p-2 lg:p-2.5 rounded-xl lg:rounded-2xl shrink-0">
                    <Activity
                      className="h-5 w-5 lg:h-6 lg:w-6 text-primary"
                      strokeWidth={2.5}
                    />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg lg:text-xl font-black tracking-tight text-foreground leading-none truncate">
                      Reportería
                    </h1>
                    <p className="text-[8px] lg:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5 lg:mt-1 truncate">
                      {activeStore?.name}
                    </p>
                  </div>
                </div>

                <Button
                  variant="default"
                  size="sm"
                  className="rounded-xl h-9 lg:h-10 px-3 lg:px-6 font-black shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all group bg-primary border-0 shrink-0"
                  onClick={exportToExcel}
                  disabled={isLoading || reportOrders.length === 0}
                >
                  <Download
                    className="h-3.5 w-3.5 lg:h-4 lg:w-4 lg:mr-2 group-hover:animate-bounce transition-transform"
                    strokeWidth={3}
                  />
                  <span className="hidden lg:inline text-[10px] tracking-widest uppercase">
                    Exportar XLSX
                  </span>
                  <span className="lg:hidden text-[9px] ml-1.5 font-black">
                    XLSX
                  </span>
                </Button>
              </div>

              {/* Bottom Row: Controls & Navigation */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-accent/5 overflow-hidden">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 pb-1 lg:pb-0 lg:mx-0 lg:px-0">
                  {/* Date Selection */}
                  <div className="flex items-center gap-1 bg-accent/5 p-1 rounded-xl lg:rounded-2xl border border-accent/10 shrink-0">
                    <div className="flex">
                      {QUICK_RANGES.map((r) => (
                        <button
                          key={r.label}
                          onClick={() => handleQuickRange(r.label)}
                          className={cn(
                            "px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg lg:rounded-xl font-black text-[8px] lg:text-[9px] uppercase tracking-widest transition-all whitespace-nowrap",
                            activeQuick === r.label
                              ? "bg-white text-primary shadow-sm"
                              : "text-muted-foreground/40 hover:text-primary",
                          )}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>

                    <div className="w-px h-3 lg:h-4 bg-accent/20 mx-1" />

                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 hover:bg-white rounded-lg lg:rounded-xl transition-all group whitespace-nowrap">
                          <CalendarIcon className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
                          <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-primary/60 group-hover:text-primary">
                            {dateRange?.from
                              ? dateRange.to
                                ? `${format(dateRange.from, "dd MMM", { locale: es })} - ${format(dateRange.to, "dd MMM", { locale: es })}`
                                : format(dateRange.from, "dd MMM", {
                                    locale: es,
                                  })
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
                          numberOfMonths={window.innerWidth > 768 ? 2 : 1}
                          locale={es}
                          className="p-4"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
                    <SelectTrigger className="w-32 lg:w-44 h-8 lg:h-10 rounded-xl lg:rounded-2xl border-none bg-accent/5 font-black text-[8px] lg:text-[10px] tracking-widest uppercase shadow-none hover:bg-accent/10 transition-colors shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Filter
                          className="h-3.5 w-3.5 text-primary/40"
                          strokeWidth={2.5}
                        />
                        <SelectValue placeholder="Estado" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-strong p-1">
                      <SelectItem
                        value="all"
                        className="font-black text-[9px] lg:text-[10px] tracking-widest uppercase py-3 rounded-xl"
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
                          className="font-black text-[9px] lg:text-[10px] tracking-widest uppercase py-3 rounded-xl"
                        >
                          {status.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Type Filter (Caja vs Domicilio) - Only for domicilios store */}
                  {activeStore?.slug === "domicilios" && (
                    <Select
                      value={typeFilter}
                      onValueChange={(v: "all" | "caja" | "delivery") =>
                        setTypeFilter(v)
                      }
                    >
                      <SelectTrigger className="w-32 lg:w-44 h-8 lg:h-10 rounded-xl lg:rounded-2xl border-none bg-accent/5 font-black text-[8px] lg:text-[10px] tracking-widest uppercase shadow-none hover:bg-accent/10 transition-colors shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Filter
                            className="h-3.5 w-3.5 text-primary/40"
                            strokeWidth={2.5}
                          />
                          <SelectValue placeholder="Tipo" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-strong p-1">
                        <SelectItem
                          value="all"
                          className="font-black text-[9px] lg:text-[10px] tracking-widest uppercase py-3 rounded-xl"
                        >
                          Todos los Tipos
                        </SelectItem>
                        <SelectItem
                          value="caja"
                          className="font-black text-[9px] lg:text-[10px] tracking-widest uppercase py-3 rounded-xl"
                        >
                          Solo Caja
                        </SelectItem>
                        <SelectItem
                          value="delivery"
                          className="font-black text-[9px] lg:text-[10px] tracking-widest uppercase py-3 rounded-xl"
                        >
                          Solo Domicilios
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Tabs Integration - Scrollable on Mobile */}
                <div className="overflow-x-auto no-scrollbar -mx-3 px-3 pb-1 lg:pb-0 lg:mx-0 lg:px-0 shrink-0">
                  <TabsList className="bg-accent/5 p-1 rounded-xl lg:rounded-2xl border border-accent/10 h-auto gap-1 inline-flex whitespace-nowrap">
                    {[
                      { value: "resumen", label: "Resumen", icon: TrendingUp },
                      { value: "caja", label: "Caja", icon: Banknote },
                      { value: "meseros", label: "Personal", icon: User },
                      {
                        value: "detalle",
                        label: "Auditoría",
                        icon: ListChecks,
                      },
                    ].map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="rounded-lg lg:rounded-xl px-3 lg:px-5 py-1.5 lg:py-2 font-black uppercase tracking-widest text-[8px] lg:text-[9px] transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm flex items-center gap-1.5"
                      >
                        <tab.icon
                          className="h-3 w-3 lg:h-3.5 lg:w-3.5"
                          strokeWidth={3}
                        />
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-4">
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
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
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
              className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both outline-none"
            >
              <div className="space-y-6 pb-20">
                {renderPagination()}
                
                {pagedOrders.length === 0 ? (
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
                  pagedOrders.map((order, idx) => {
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
                        <div
                          onClick={() =>
                            setExpandedDetailId((prev) =>
                              prev === order.id ? null : order.id,
                            )
                          }
                          className="w-full flex items-center justify-between gap-6 p-4 lg:p-6 text-left cursor-pointer"
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex items-center gap-6 min-w-0 flex-1">
                            <div
                              className={cn(
                                "w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 shadow-md transition-all duration-300 shrink-0",
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

                            <div className="min-w-0 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <StatusBadge
                                    status={order.status}
                                    className="scale-75 origin-left"
                                  />
                                  <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest bg-white/80 px-3 py-1 rounded-full border border-white">
                                    {itemCount}{" "}
                                    {itemCount === 1 ? "ART" : "ARTS"} • {hora}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 flex-wrap">
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

                              {/* Siigo Compact Badge */}
                              {(() => {
                                const successInv = order.siigo_invoices?.find(
                                  (inv) => inv.status === "success",
                                );
                                if (!successInv) return null;
                                return (
                                  <div
                                    className="flex items-center gap-4 px-4 py-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black text-emerald-600/60 uppercase tracking-[0.2em] mb-0.5">
                                        FACTURA ELECTRÓNICA
                                      </span>
                                      <span className="text-sm font-black text-emerald-700 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                        {successInv.siigo_invoice_number ||
                                          successInv.siigo_invoice_id ||
                                          "—"}
                                      </span>
                                    </div>
                                    {successInv.response_payload
                                      ?.public_url && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(
                                            successInv.response_payload
                                              ?.public_url,
                                            "_blank",
                                          );
                                        }}
                                        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm shadow-emerald-500/20 ml-2"
                                      >
                                        <FileText
                                          className="h-4 w-4"
                                          strokeWidth={3}
                                        />
                                        PDF
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          <div
                            className={cn(
                              "h-10 w-10 shrink-0 rounded-full flex items-center justify-center border transition-all duration-300",
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
                        </div>

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
                                                    {formatPrice(
                                                      item.unit_price,
                                                    )}
                                                  </p>
                                                </div>
                                              </div>
                                              <p className="font-black text-xl lg:text-2xl tracking-tighter text-foreground/90">
                                                {formatPrice(
                                                  item.unit_price *
                                                    item.quantity,
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

                                    {/* Facturación Electrónica Siigo */}
                                    {(() => {
                                      const successInv =
                                        order.siigo_invoices?.find(
                                          (inv) => inv.status === "success",
                                        );
                                      if (!successInv) return null;
                                      return (
                                        <div className="space-y-4">
                                          <div className="flex items-center gap-4 px-2">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                                              FACTURA ELECTRÓNICA SIIGO
                                            </h4>
                                          </div>
                                          <div className="bg-emerald-50 border-4 border-emerald-100 rounded-4xl p-6 flex items-center justify-between gap-4">
                                            <div className="space-y-1">
                                              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-600/60">
                                                No. FACTURA
                                              </p>
                                              <p className="text-lg font-black text-emerald-700 tracking-tight">
                                                {successInv.siigo_invoice_number ||
                                                  successInv.siigo_invoice_id ||
                                                  "—"}
                                              </p>
                                              <p className="text-[9px] font-bold text-emerald-600/40 uppercase tracking-widest">
                                                {successInv.payment_method.toUpperCase()}
                                              </p>
                                            </div>
                                            {successInv.response_payload
                                              ?.public_url && (
                                              <button
                                                onClick={() =>
                                                  window.open(
                                                    successInv.response_payload
                                                      ?.public_url,
                                                    "_blank",
                                                  )
                                                }
                                                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-emerald-500/20"
                                              >
                                                <FileText
                                                  className="h-4 w-4"
                                                  strokeWidth={3}
                                                />
                                                PDF Siigo
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}
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

                {pagedOrders.length > 0 && (
                  <div className="pt-4 border-t border-accent/10">
                    {renderPagination()}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </>
  );
}
