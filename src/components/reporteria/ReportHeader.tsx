import {
  TrendingUp,
  Banknote,
  Award,
  ListChecks,
  Calendar as CalendarIcon,
  Download,
  Filter,
  Store as StoreIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import type { OrderStatus, Store } from "@/types";
import { cn } from "@/lib/utils";

export interface QuickRange {
  label: string;
  getValue: () => { from: Date; to: Date };
}

interface ReportHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  quickRanges: QuickRange[];
  activeQuick: string;
  onQuickRangeSelect: (label: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  statusFilter: OrderStatus | "all";
  onStatusFilterChange: (status: OrderStatus | "all") => void;
  typeFilter: "all" | "caja" | "delivery";
  onTypeFilterChange: (type: "all" | "caja" | "delivery") => void;
  isDomiciliosStore: boolean;
  stores: Store[];
  selectedStoreId: string;
  onStoreChange: (storeId: string) => void;
  canChangeStore: boolean;
  onExportExcel: () => void;
  isExporting: boolean;
  totalOrdersCount: number;
}

export function ReportHeader({
  activeTab,
  onTabChange,
  quickRanges,
  activeQuick,
  onQuickRangeSelect,
  dateRange,
  onDateRangeChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  isDomiciliosStore,
  stores,
  selectedStoreId,
  onStoreChange,
  canChangeStore,
  onExportExcel,
  isExporting,
  totalOrdersCount,
}: ReportHeaderProps) {
  const tabs = [
    { id: "resumen", label: "Resumen", icon: TrendingUp },
    { id: "caja", label: "Caja & Cierre", icon: Banknote },
    { id: "meseros", label: "Personal", icon: Award },
    { id: "detalle", label: "Auditoría", icon: ListChecks, count: totalOrdersCount },
  ];

  const dateRangeLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "d MMM", { locale: es })} - ${format(dateRange.to, "d MMM", { locale: es })}`
      : format(dateRange.from, "d MMM yyyy", { locale: es })
    : "Seleccionar fechas";

  return (
    <div className="sticky top-14 sm:top-14 lg:top-16 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs no-print select-none">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-2.5 space-y-2.5">
        {/* Row 1: Sub-tabs Segmented Bar & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Segmented Pill Navigation */}
          <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5" role="tablist">
            {tabs.map((t) => {
              const isActive = activeTab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onTabChange(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer shrink-0 active:scale-95",
                    isActive
                      ? "bg-teal-600 text-white shadow-xs"
                      : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{t.label}</span>
                  {t.count !== undefined && t.count > 0 && (
                    <span
                      className={cn(
                        "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-black",
                        isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Action: Excel Export Button */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={onExportExcel}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              {isExporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>Exportar Excel</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Date Filters & Filter Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          {/* Quick Date Chips + Popover Calendar */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 max-w-full">
            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl shrink-0">
              {quickRanges.map((r) => {
                const isSelected = activeQuick === r.label;
                return (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => onQuickRangeSelect(r.label)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer",
                      isSelected
                        ? "bg-white text-teal-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Range Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0",
                    activeQuick === ""
                      ? "bg-teal-50 text-teal-700 border-teal-300"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <CalendarIcon className="size-3.5 text-teal-600 shrink-0" />
                  <span className="capitalize">{dateRangeLabel}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-slate-200" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    onDateRangeChange(range);
                  }}
                  locale={es}
                  className="p-3"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Store & Order Filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {/* Store Selector */}
            {canChangeStore && (
              <Select value={selectedStoreId} onValueChange={onStoreChange}>
                <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-200 rounded-xl px-2.5 gap-1.5 shrink-0">
                  <StoreIcon className="size-3.5 text-teal-600 shrink-0" />
                  <SelectValue placeholder="Sede" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">
                    Todas las Sedes (Consolidado)
                  </SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs font-medium">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Channel Filter (Caja vs Domicilio) */}
            {isDomiciliosStore && (
              <Select value={typeFilter} onValueChange={(v: "all" | "caja" | "delivery") => onTypeFilterChange(v)}>
                <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-200 rounded-xl px-2.5 gap-1.5 shrink-0">
                  <Filter className="size-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">
                    Todos los Canales
                  </SelectItem>
                  <SelectItem value="caja" className="text-xs font-medium">
                    Solo Mostrador / Caja
                  </SelectItem>
                  <SelectItem value="delivery" className="text-xs font-medium">
                    Solo Domicilios
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Order Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => onStatusFilterChange(v as OrderStatus | "all")}
            >
              <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-200 rounded-xl px-2.5 gap-1.5 shrink-0">
                <Filter className="size-3.5 text-slate-400 shrink-0" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs font-bold">
                  Todos los Estados
                </SelectItem>
                <SelectItem value="entregado" className="text-xs font-medium">
                  Entregados
                </SelectItem>
                <SelectItem value="listo" className="text-xs font-medium">
                  Listos
                </SelectItem>
                <SelectItem value="en_preparacion" className="text-xs font-medium">
                  En Preparación
                </SelectItem>
                <SelectItem value="pendiente" className="text-xs font-medium">
                  Pendientes
                </SelectItem>
                <SelectItem value="cancelado" className="text-xs font-medium">
                  Cancelados
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
