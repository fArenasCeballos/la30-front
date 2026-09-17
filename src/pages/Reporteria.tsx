import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { OrderStatus } from "@/types";
import { supabase } from "@/lib/supabase";
import {
  format,
  startOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { getCalendarShiftRange, getCurrentShiftDate } from "@/lib/shiftUtils";
import type { DateRange } from "react-day-picker";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { ReportLoadingModal } from "@/components/ReportLoadingModal";
import {
  ReportHeader,
  type QuickRange,
} from "@/components/reporteria/ReportHeader";
import { SummaryTab } from "@/components/reporteria/SummaryTab";
import { CashTab } from "@/components/reporteria/CashTab";
import { StaffTab } from "@/components/reporteria/StaffTab";
import { AuditTab, type ReportOrder } from "@/components/reporteria/AuditTab";
import { Loader2 } from "lucide-react";

const QUICK_RANGES: QuickRange[] = [
  {
    label: "Hoy",
    getValue: () => {
      const shift = getCurrentShiftDate();
      return { from: shift, to: shift };
    },
  },
  {
    label: "Ayer",
    getValue: () => {
      const shift = subDays(getCurrentShiftDate(), 1);
      return { from: shift, to: shift };
    },
  },
  {
    label: "Últimos 7 días",
    getValue: () => {
      const shift = getCurrentShiftDate();
      return { from: subDays(shift, 6), to: shift };
    },
  },
  {
    label: "Este mes",
    getValue: () => {
      const shift = getCurrentShiftDate();
      return {
        from: startOfMonth(shift),
        to: startOfDay(endOfMonth(shift)),
      };
    },
  },
  {
    label: "Mes pasado",
    getValue: () => {
      const shift = getCurrentShiftDate();
      const d = subDays(startOfMonth(shift), 1);
      return { from: startOfMonth(d), to: startOfDay(endOfMonth(d)) };
    },
  },
];

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
  const { stores, activeStore } = useStore();

  const [activeTab, setActiveTab] = useState<string>("resumen");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "caja" | "delivery">(
    "all",
  );
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    activeStore?.id ?? (stores[0]?.id || "all"),
  );

  useEffect(() => {
    if (activeStore?.id) {
      setSelectedStoreId(activeStore.id);
    } else if (stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [activeStore?.id, stores]);
  const [activeQuick, setActiveQuick] = useState<string>("Hoy");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const shift = getCurrentShiftDate();
    return { from: shift, to: shift };
  });
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const PAGE_SIZE = 50;
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const canChangeStore = user?.role === "admin";

  const selectedStoreName = useMemo(() => {
    if (selectedStoreId === "all") return "General (Todas las Sedes)";
    const current = stores.find((s) => s.id === selectedStoreId);
    return current?.name ?? activeStore?.name ?? "Sede Seleccionada";
  }, [selectedStoreId, stores, activeStore]);

  const isDomiciliosStore = useMemo(() => {
    if (selectedStoreId === "all") return true;
    const current = stores.find((s) => s.id === selectedStoreId);
    if (current) return current.slug === "domicilios";
    return activeStore?.slug === "domicilios";
  }, [selectedStoreId, stores, activeStore]);

  const shiftRange = useMemo(() => {
    if (!dateRange?.from) return null;
    return getCalendarShiftRange(dateRange.from, dateRange.to);
  }, [dateRange]);

  // ── Stats Query (RPC) ────────────────────────────────────────────────────────
  const { data: reportStatsRaw, isLoading: isStatsLoading } = useQuery({
    queryKey: [
      "report-stats",
      user?.id,
      shiftRange?.from?.toISOString(),
      shiftRange?.to?.toISOString(),
      selectedStoreId,
      typeFilter,
    ],
    queryFn: async () => {
      if (!shiftRange) return null;
      const from = shiftRange.from.toISOString();
      const to = shiftRange.to.toISOString();

      const targetStoreId =
        selectedStoreId !== "all"
          ? selectedStoreId
          : stores.length === 1
            ? stores[0].id
            : null;

      const { data, error } = await supabase.rpc("get_reporteria_stats", {
        p_start: from,
        p_end: to,
        p_store_id: targetStoreId,
        p_type_filter: typeFilter,
      });

      if (error) throw error;
      return data as unknown as ReportStatsData;
    },
    enabled: !!user && !!shiftRange,
  });

  // ── Paged Orders Query ─────────────────────────────────────────────────────────
  const {
    data: pagedOrdersResponse = { data: [], count: 0 },
    isLoading: isOrdersLoading,
  } = useQuery({
    queryKey: [
      "paged-orders",
      user?.id,
      shiftRange?.from?.toISOString(),
      shiftRange?.to?.toISOString(),
      selectedStoreId,
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
          { count: "exact" },
        )
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedStoreId !== "all") {
        query = query.eq("store_id", selectedStoreId);
      } else {
        const companyStoreIds = stores.map((s) => s.id);
        if (companyStoreIds.length > 0) {
          query = query.in("store_id", companyStoreIds);
        }
      }

      if (typeFilter !== "all") {
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

  // ── Derived State ────────────────────────────────────────────────────────────
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
  };

  const cashSummary = {
    totalSales: reportStats.total_sales ?? 0,
    deliveredCount: reportStats.completed_orders ?? 0,
    pendingCount: reportStats.active_orders ?? 0,
    pendingTotal: reportStats.delivery_pending ?? 0,
    cancelledCount: reportStats.cancelled_orders ?? 0,
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

  const hourlyData = isMultiDay
    ? (reportStats.sales_by_day ?? [])
    : (reportStats.sales_by_hour ?? []);

  const waiterData = reportStats.waiter_stats ?? [];
  const pagedOrders = pagedOrdersResponse.data;
  const totalPages = Math.ceil(pagedOrdersResponse.count / PAGE_SIZE) || 1;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleQuickRangeSelect = (label: string) => {
    const range = QUICK_RANGES.find((r) => r.label === label);
    if (range) {
      setDateRange(range.getValue());
      setActiveQuick(label);
      setPage(0);
    }
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveQuick("");
    setPage(0);
  };

  const handleStatusFilterChange = (status: OrderStatus | "all") => {
    setStatusFilter(status);
    setPage(0);
  };

  const handleTypeFilterChange = (type: "all" | "caja" | "delivery") => {
    setTypeFilter(type);
    setPage(0);
  };

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    setPage(0);
  };

  // ── ExcelJS Multi-Sheet Export ────────────────────────────────────────────────
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

      if (selectedStoreId !== "all") {
        query = query.eq("store_id", selectedStoreId);
      } else {
        const companyStoreIds = stores.map((s) => s.id);
        if (companyStoreIds.length > 0) {
          query = query.in("store_id", companyStoreIds);
        }
      }

      if (typeFilter !== "all") {
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

      const wb = new ExcelJS.Workbook();
      wb.creator = "La 30";
      wb.lastModifiedBy = user?.email || "Sistema";
      wb.created = new Date();
      wb.modified = new Date();

      // HOJA 1: RESUMEN DE ÓRDENES
      const wsOrders = wb.addWorksheet("Órdenes", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      wsOrders.columns = [
        { header: "LOCALIZADOR", key: "loc", width: 16 },
        { header: "CANAL", key: "channel", width: 16 },
        { header: "ESTADO", key: "status", width: 18 },
        { header: "TOTAL", key: "total", width: 18 },
        { header: "CLIENTE / DIRECCIÓN", key: "customer", width: 32 },
        { header: "CANTIDAD ITEMS", key: "items", width: 18 },
        { header: "FECHA", key: "date", width: 28 },
        { header: "CREADO POR", key: "creator", width: 25 },
      ];

      wsOrders.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsOrders.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0D9488" }, // Teal 600
      };
      wsOrders.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      wsOrders.getRow(1).height = 25;

      ordersToExport.forEach((o) => {
        const row = wsOrders.addRow({
          loc: o.is_delivery ? `#DOM ${o.locator}` : `#ORD ${o.locator}`,
          channel: o.is_delivery ? "DOMICILIO" : "CAJA",
          status: o.status.toUpperCase(),
          total: o.total,
          customer: o.is_delivery
            ? `${o.delivery_name || "Cliente"} (${o.delivery_address || "Sin dirección"})`
            : "Venta en Local / Caja",
          items: o.order_items?.length ?? 0,
          date: format(new Date(o.created_at), "PPP pp", { locale: es }),
          creator: o.profiles?.name ?? "Sistema",
        });

        row.getCell("total").numFmt = '"$"#,##0.00';
        row.getCell("loc").font = { bold: true };
      });

      // HOJA 2: DETALLE DE PRODUCTOS
      const wsItems = wb.addWorksheet("Detalle Productos", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      wsItems.columns = [
        { header: "ORDEN", key: "loc", width: 15 },
        { header: "PRODUCTO", key: "product", width: 35 },
        { header: "CANTIDAD", key: "qty", width: 12 },
        { header: "PRECIO UNIT", key: "price", width: 16 },
        { header: "EXTRAS", key: "extras_total", width: 14 },
        { header: "TOTAL ITEM", key: "total", width: 18 },
        { header: "OPCIONES", key: "options", width: 30 },
        { header: "ADICIONALES", key: "addons", width: 30 },
        { header: "NOTAS", key: "notes", width: 35 },
        { header: "FECHA", key: "date", width: 28 },
      ];

      wsItems.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsItems.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" }, // Slate 900
      };
      wsItems.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      wsItems.getRow(1).height = 25;

      ordersToExport.forEach((o) => {
        o.order_items?.forEach((item) => {
          const row = wsItems.addRow({
            loc: o.locator,
            product: item.products?.name,
            qty: item.quantity,
            price: item.unit_price,
            extras_total: item.extras_total,
            total: (item.unit_price + item.extras_total) * item.quantity,
            options: item.selected_options
              ? JSON.stringify(item.selected_options)
              : "",
            addons: item.selected_extras ? item.selected_extras.join(", ") : "",
            notes: item.notes ?? "",
            date: format(new Date(o.created_at), "PPP pp", { locale: es }),
          });

          row.getCell("loc").font = { bold: true };
          row.getCell("price").numFmt = '"$"#,##0.00';
          row.getCell("extras_total").numFmt = '"$"#,##0.00';
          row.getCell("total").numFmt = '"$"#,##0.00';
        });
      });

      // Format cells & borders
      [wsOrders, wsItems].forEach((ws) => {
        ws.eachRow((row, rowNumber) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
            if (rowNumber > 1) {
              cell.alignment = {
                vertical: "middle",
                horizontal: "left",
                wrapText: true,
              };
              if (cell.numFmt) {
                cell.alignment.horizontal = "right";
              }
            }
          });
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(
        blob,
        `Reporte_La30_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`,
      );
    } catch (e) {
      console.error("Error exporting to Excel:", e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-slate-50/50 flex flex-col">
      <ReportLoadingModal isLoading={isLoading && isMultiDay} />

      {/* ── Docking Header with Filter Controls & Segmented Navigation ── */}
      <ReportHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        quickRanges={QUICK_RANGES}
        activeQuick={activeQuick}
        onQuickRangeSelect={handleQuickRangeSelect}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        isDomiciliosStore={isDomiciliosStore}
        stores={stores}
        selectedStoreId={selectedStoreId}
        onStoreChange={handleStoreChange}
        canChangeStore={canChangeStore}
        onExportExcel={exportToExcel}
        isExporting={isExporting}
        totalOrdersCount={pagedOrdersResponse.count}
      />

      {/* ── Main Tab Content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6">
        {isStatsLoading && !reportStatsRaw ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="size-8 animate-spin text-teal-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cargando estadísticas de reportería...
            </p>
          </div>
        ) : (
          <>
            {activeTab === "resumen" && (
              <SummaryTab
                summary={summary}
                isDomiciliosStore={isDomiciliosStore}
                reportStats={reportStats}
                paymentSummary={paymentSummary}
                hourlyData={hourlyData}
                isMultiDay={isMultiDay}
              />
            )}

            {activeTab === "caja" && (
              <CashTab
                cashSummary={cashSummary}
                paymentSummary={paymentSummary}
                isDomiciliosStore={isDomiciliosStore}
                reportStats={reportStats}
              />
            )}

            {activeTab === "meseros" && <StaffTab waiterData={waiterData} />}

            {activeTab === "detalle" && (
              <AuditTab
                orders={pagedOrders}
                totalOrdersCount={pagedOrdersResponse.count}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                expandedDetailId={expandedDetailId}
                onToggleDetail={(orderId) =>
                  setExpandedDetailId((prev) =>
                    prev === orderId ? null : orderId,
                  )
                }
                activeStoreName={selectedStoreName}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
