import pkg from "../../../package.json";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useCompany } from "@/context/CompanyContext";
import { supabase } from "@/lib/supabase";
import { getRawMaterials } from "@/lib/inventoryService";
import { toast } from "sonner";
import {
  Package,
  Boxes,
  Smartphone,
  Map,
  Bike,
  FileText,
  Search,
  Users,
  Store as StoreIcon,
  Sparkles,
  ArrowRight,
  Plus,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AdminNewsModal } from "@/components/admin/AdminNewsModal";
import { LATEST_UPDATE_ID } from "@/data/appUpdates";
import { cn } from "@/lib/utils";

interface PanelDeControlProps {
  onSelectTab?: (tabId: string) => void;
}

export default function PanelDeControl({ onSelectTab }: PanelDeControlProps) {
  const { user } = useAuth();
  const { stores, activeStore } = useStore();
  const { activeCompany, updateCompanyProfitability } = useCompany();
  const companyStoreIds = useMemo(() => stores.map((s) => s.id), [stores]);
  const navigate = useNavigate();

  // News Modal State
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Buenos días";
    if (hour >= 12 && hour < 19) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  }, []);

  // 1. Products & Categories Count (filtered by active company's stores)
  const {
    data: catalogData,
    isLoading: loadingCatalog,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: ["admin-kpi-catalog-v2", activeCompany?.id, companyStoreIds],
    queryFn: async () => {
      const [prodRes, catRes] = await Promise.all([
        supabase.from("products").select("id, available, store_ids"),
        supabase.from("categories").select("id, store_ids"),
      ]);
      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;

      const companyStoreSet = new Set(companyStoreIds);
      const products = (prodRes.data || []).filter((p) => {
        if (companyStoreIds.length === 0) return false;
        if (!p.store_ids || p.store_ids.length === 0) return false;
        return p.store_ids.some((id: string) => companyStoreSet.has(id));
      });
      const categories = (catRes.data || []).filter((c) => {
        if (companyStoreIds.length === 0) return false;
        if (!c.store_ids || c.store_ids.length === 0) return false;
        return c.store_ids.some((id: string) => companyStoreSet.has(id));
      });

      const activeProducts = products.filter((p) => p.available !== false);
      return {
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        totalCategories: categories.length,
      };
    },
    staleTime: 1000 * 60 * 3,
  });

  // 2. Raw Materials & Low Stock Alert (scoped to company's stores)
  const {
    data: rawMaterialsData,
    isLoading: loadingMaterials,
    refetch: refetchMaterials,
  } = useQuery({
    queryKey: ["admin-kpi-materials", activeStore?.id, companyStoreIds],
    queryFn: async () => {
      let items: {
        is_active?: boolean | null;
        min_stock?: number | null;
        current_stock?: number | null;
      }[] = [];
      if (activeStore?.id) {
        items = await getRawMaterials(activeStore.id);
      } else if (companyStoreIds.length > 0) {
        const { data, error } = await supabase
          .from("raw_materials")
          .select("id, current_stock, min_stock, is_active")
          .in("store_id", companyStoreIds);
        if (error) throw error;
        items = data || [];
      }
      const lowStockItems = items.filter(
        (m) =>
          m.is_active !== false &&
          m.min_stock != null &&
          m.min_stock > 0 &&
          (m.current_stock || 0) <= m.min_stock,
      );
      return {
        total: items.length,
        lowStockCount: lowStockItems.length,
      };
    },
    staleTime: 1000 * 60 * 3,
  });

  // 3. Profiles / Staff (filtered by active company)
  const {
    data: staffData,
    isLoading: loadingStaff,
    refetch: refetchStaff,
  } = useQuery({
    queryKey: ["admin-kpi-staff", activeCompany?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, role, is_active, company_ids");
      const allProfiles = (data || []) as unknown as {
        id: string;
        role: string;
        is_active?: boolean;
        company_ids?: string[] | null;
      }[];
      const profiles = allProfiles.filter((p) => {
        if (!activeCompany) return true;
        if (!p.company_ids || p.company_ids.length === 0) return true;
        return p.company_ids.includes(activeCompany.id);
      });
      const activeStaff = profiles.filter((p) => p.is_active !== false);
      return {
        total: profiles.length,
        active: activeStaff.length,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // 4. Logistics (Zones & Drivers filtered by active company)
  const {
    data: logisticsData,
    isLoading: loadingLogistics,
    refetch: refetchLogistics,
  } = useQuery({
    queryKey: ["admin-kpi-logistics", activeCompany?.id],
    queryFn: async () => {
      let zonesQuery = supabase
        .from("delivery_zones")
        .select("id, is_active, company_id");
      let driversQuery = supabase
        .from("delivery_drivers")
        .select("id, is_active, company_id");

      if (activeCompany?.id) {
        zonesQuery = zonesQuery.eq("company_id", activeCompany.id);
        driversQuery = driversQuery.eq("company_id", activeCompany.id);
      }

      const [zonesRes, driversRes] = await Promise.all([
        zonesQuery,
        driversQuery,
      ]);
      if (zonesRes.error) throw zonesRes.error;
      if (driversRes.error) throw driversRes.error;
      const zones = zonesRes.data || [];
      const drivers = driversRes.data || [];
      return {
        totalZones: zones.length,
        activeZones: zones.filter((z) => z.is_active !== false).length,
        totalDrivers: drivers.length,
        activeDrivers: drivers.filter((d) => d.is_active !== false).length,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleRefreshAll = () => {
    refetchCatalog();
    refetchMaterials();
    refetchStaff();
    refetchLogistics();
  };

  const handleNavigateTab = (tabId: string) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* ── 1. Hero Executive Header ── */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-950 to-teal-950 text-white p-5 sm:p-8 shadow-xl border border-slate-800/80">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <span className="size-2 rounded-full bg-teal-400 animate-pulse" />
                Panel de Control · Back-Office
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700/60">
                <ShieldCheck className="size-3 text-teal-400" />
                {user?.role === "bodega"
                  ? "Encargado Bodega"
                  : "Administración General"}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white capitalize">
              {greeting}, {user?.name || "Administrador"}
            </h1>

            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 font-medium capitalize">
              <Calendar className="size-4 text-teal-400" />
              <span>{todayFormatted}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 font-semibold">
                {activeStore?.name || activeCompany?.name || "Panel Principal"}
              </span>
            </div>
          </div>

          {/* Action buttons in hero */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedUpdateId(LATEST_UPDATE_ID);
                setNewsModalOpen(true);
              }}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs cursor-pointer backdrop-blur-xs transition-all active:scale-95"
            >
              <Sparkles className="size-3.5 text-amber-300" />
              <span>Novedades v{pkg.version}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200 rounded-xl text-xs font-bold gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
              title="Refrescar métricas del panel"
            >
              <RefreshCw className="size-3.5 text-teal-400" />
              <span>Actualizar</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => navigate("/select-store")}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs gap-1.5 shadow-md shadow-teal-600/30 cursor-pointer transition-all active:scale-95"
            >
              <StoreIcon className="size-3.5" />
              <span>Puntos de Venta</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── 1.1 Configuración de Rentabilidad y Ganancias por Empresa ── */}
      {activeCompany && (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="size-5.5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  Cálculo de rentabilidad, ganancias e ingresos
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                    activeCompany.profitability_enabled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-500 border-slate-200",
                  )}
                >
                  {activeCompany.profitability_enabled ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Calcula la inversión en insumos según las recetas y muestra la
                rentabilidad y ganancias en el Dashboard y Reportería para{" "}
                {activeCompany.name}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center shrink-0 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
            <Switch
              id="profitability-toggle"
              checked={!!activeCompany.profitability_enabled}
              onCheckedChange={async (checked) => {
                try {
                  await updateCompanyProfitability(activeCompany.id, checked);
                  toast.success(
                    checked
                      ? "Cálculo de rentabilidad y ganancias activado para " +
                          activeCompany.name
                      : "Cálculo de rentabilidad desactivado para " +
                          activeCompany.name,
                  );
                } catch (err: unknown) {
                  const msg =
                    err instanceof Error ? err.message : "Error al actualizar";
                  toast.error(msg);
                }
              }}
            />
            <label
              htmlFor="profitability-toggle"
              className="text-xs font-bold text-slate-700 cursor-pointer select-none"
            >
              {activeCompany.profitability_enabled
                ? "Habilitado"
                : "Deshabilitado"}
            </label>
          </div>
        </section>
      )}

      {/* ── 2. Executive KPI Cards ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* KPI 1: Catálogo & Menú */}
        <div
          onClick={() => handleNavigateTab("inventario")}
          className="group relative bg-white hover:bg-slate-50/80 active:scale-[0.98] border border-slate-200/90 hover:border-teal-400/80 rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="size-9 sm:size-11 rounded-xl sm:rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Package className="size-4.5 sm:size-5.5" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors truncate max-w-[90px] sm:max-w-none text-center">
              Menú Activo
            </span>
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {loadingCatalog ? (
                  <span className="text-slate-300 text-base">...</span>
                ) : (
                  (catalogData?.activeProducts ?? 0)
                )}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">
                platos activos
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 flex items-center gap-1 sm:gap-1.5">
              <span>{catalogData?.totalCategories ?? 0} cat.</span>
              <span className="text-slate-300">•</span>
              <span className="text-teal-600 font-semibold group-hover:underline inline-flex items-center gap-0.5">
                Ver Menú{" "}
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </p>
          </div>
        </div>

        {/* KPI 2: Bodega & Insumos */}
        <div
          onClick={() => handleNavigateTab("bodega")}
          className="group relative bg-white hover:bg-slate-50/80 active:scale-[0.98] border border-slate-200/90 hover:border-teal-400/80 rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="size-9 sm:size-11 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Boxes className="size-4.5 sm:size-5.5" />
            </div>
            {rawMaterialsData?.lowStockCount &&
            rawMaterialsData.lowStockCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 truncate max-w-[95px] sm:max-w-none">
                <AlertTriangle className="size-2.5 sm:size-3 shrink-0" />
                <span>{rawMaterialsData.lowStockCount} Bajo</span>
              </span>
            ) : (
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 truncate max-w-[90px] sm:max-w-none">
                Óptimo
              </span>
            )}
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {loadingMaterials ? (
                  <span className="text-slate-300 text-base">...</span>
                ) : (
                  (rawMaterialsData?.total ?? 0)
                )}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">
                insumos
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 flex items-center gap-1 sm:gap-1.5">
              <span>Recetas</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-700 font-semibold group-hover:underline inline-flex items-center gap-0.5">
                Gestionar{" "}
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </p>
          </div>
        </div>

        {/* KPI 3: Personal & Usuarios */}
        <div
          onClick={() => handleNavigateTab("usuarios")}
          className="group relative bg-white hover:bg-slate-50/80 active:scale-[0.98] border border-slate-200/90 hover:border-teal-400/80 rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="size-9 sm:size-11 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Users className="size-4.5 sm:size-5.5" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors truncate max-w-[90px] sm:max-w-none">
              Equipo
            </span>
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {loadingStaff ? (
                  <span className="text-slate-300 text-base">...</span>
                ) : (
                  (staffData?.active ?? 0)
                )}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">
                usuarios
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 flex items-center gap-1 sm:gap-1.5">
              <span>Caja, meseros</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-600 font-semibold group-hover:underline inline-flex items-center gap-0.5">
                Roles{" "}
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </p>
          </div>
        </div>

        {/* KPI 4: Canales de Despacho */}
        <div
          onClick={() => handleNavigateTab("zonas-domicilio")}
          className="group relative bg-white hover:bg-slate-50/80 active:scale-[0.98] border border-slate-200/90 hover:border-teal-400/80 rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="size-9 sm:size-11 rounded-xl sm:rounded-2xl bg-purple-50 border border-purple-200/60 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Map className="size-4.5 sm:size-5.5" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors truncate max-w-[90px] sm:max-w-none">
              Logística
            </span>
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {loadingLogistics ? (
                  <span className="text-slate-300 text-base">...</span>
                ) : (
                  (logisticsData?.activeZones ?? 0)
                )}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">
                zonas activas
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 flex items-center gap-1 sm:gap-1.5">
              <span>{logisticsData?.totalDrivers ?? 0} domis</span>
              <span className="text-slate-300">•</span>
              <span className="text-purple-600 font-semibold group-hover:underline inline-flex items-center gap-0.5">
                Zonas{" "}
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Quick Action Buttons Ribbon ── */}
      <section className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="size-3.5 text-teal-600" />
            Acciones Frecuentes
          </span>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Accesos directos a los flujos más utilizados
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigateTab("inventario")}
            className="bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 text-slate-700 text-xs font-bold rounded-xl gap-1.5 shrink-0 shadow-2xs cursor-pointer active:scale-95"
          >
            <Plus className="size-3.5 text-teal-600" />
            <span>+ Nuevo Producto</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigateTab("bodega")}
            className="bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 text-slate-700 text-xs font-bold rounded-xl gap-1.5 shrink-0 shadow-2xs cursor-pointer active:scale-95"
          >
            <Plus className="size-3.5 text-amber-600" />
            <span>+ Registrar Compra</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigateTab("reportes")}
            className="bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 text-xs font-bold rounded-xl gap-1.5 shrink-0 shadow-2xs cursor-pointer active:scale-95"
          >
            <FileText className="size-3.5 text-emerald-600" />
            <span>Ver Reportes de Ventas</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigateTab("usuarios")}
            className="bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 text-xs font-bold rounded-xl gap-1.5 shrink-0 shadow-2xs cursor-pointer active:scale-95"
          >
            <Users className="size-3.5 text-blue-600" />
            <span>Gestionar Personal</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigateTab("config-app")}
            className="bg-white hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 text-slate-700 text-xs font-bold rounded-xl gap-1.5 shrink-0 shadow-2xs cursor-pointer active:scale-95"
          >
            <Smartphone className="size-3.5 text-purple-600" />
            <span>Configurar App Móvil</span>
          </Button>
        </div>
      </section>

      {/* ── 4. Categorized Module Cards Grid ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
              Módulos de Gestión Administrativa
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Selecciona cualquier módulo para ingresar directamente
            </p>
          </div>
          <span className="text-xs font-bold text-teal-600 hidden sm:inline">
            {activeCompany?.name || "La 30"} Control Suite
          </span>
        </div>

        {/* Category Group 1: Catálogo & Suministros */}
        <div className="space-y-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
            Catálogo & Suministros
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Card: Inventario & Menú */}
            <div
              onClick={() => handleNavigateTab("inventario")}
              className="group relative bg-white hover:bg-teal-50/20 active:scale-[0.98] border border-slate-200/80 hover:border-teal-500/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-4"
            >
              <div className="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                <Package className="size-5 sm:size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                    Inventario & Menú
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[9px] sm:text-[10px] font-bold border-teal-200 text-teal-700 bg-teal-50"
                  >
                    Menú POS
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Configuración de productos, precios, categorías, opciones y
                  disponibilidad instantánea en caja.
                </p>
                <div className="mt-2.5 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-teal-600 group-hover:text-teal-700">
                  <span>Abrir Inventario</span>
                  <ArrowRight className="size-3 sm:size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Card: Bodega & Insumos */}
            <div
              onClick={() => handleNavigateTab("bodega")}
              className="group relative bg-white hover:bg-amber-50/20 active:scale-[0.98] border border-slate-200/80 hover:border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-4"
            >
              <div className="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                <Boxes className="size-5 sm:size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                    Bodega & Insumos
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[9px] sm:text-[10px] font-bold border-amber-200 text-amber-700 bg-amber-50"
                  >
                    Stock & Recetas
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Materia prima, compras con conversión de unidades, recetas
                  estándar, Kardex y directorio de proveedores.
                </p>
                <div className="mt-2.5 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-amber-700 group-hover:text-amber-800">
                  <span>Abrir Bodega</span>
                  <ArrowRight className="size-3 sm:size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Group 2: Canales & Despacho */}
        <div className="space-y-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
            Canales de Venta & Despacho
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Card: App Móvil */}
            <div
              onClick={() => handleNavigateTab("config-app")}
              className="group relative bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-4"
            >
              <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Smartphone className="size-5 sm:size-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  App Móvil & Menú Web
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Personaliza combos, banners y horarios para pedidos online de
                  clientes.
                </p>
                <div className="mt-2.5 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-indigo-600">
                  <span>Configurar</span>
                  <ArrowRight className="size-3 sm:size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Card: Zonas de Domicilio */}
            <div
              onClick={() => handleNavigateTab("zonas-domicilio")}
              className="group relative bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-4"
            >
              <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Map className="size-5 sm:size-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                  Zonas de Domicilio
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Polígonos geográficos en mapa, tarifas dinámicas por radio y
                  cobertura.
                </p>
                <div className="mt-2.5 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-purple-600">
                  <span>Ver Zonas</span>
                  <ArrowRight className="size-3 sm:size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Card: Domiciliarios */}
            <div
              onClick={() => handleNavigateTab("domiciliarios")}
              className="group relative bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-4"
            >
              <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Bike className="size-5 sm:size-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Domiciliarios
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Registro de flota de reparto, estados de entrega y liquidación
                  de envíos.
                </p>
                <div className="mt-2.5 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-600">
                  <span>Ver Flota</span>
                  <ArrowRight className="size-3 sm:size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Group 3: Análisis & Control */}
        <div className="space-y-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
            Auditoría, Reportes & Seguridad
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Card: Reportes & KPIs */}
            <div
              onClick={() => handleNavigateTab("reportes")}
              className="group relative bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-4"
            >
              <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="size-5 sm:size-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Reportes & KPIs
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Ventas totales, cierres de turno, desglose por métodos de pago
                  y exportación.
                </p>
                <div className="mt-2.5 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-600">
                  <span>Ver Reportes</span>
                  <ArrowRight className="size-3 sm:size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Card: Consultas de Órdenes */}
            <div
              onClick={() => handleNavigateTab("consultas")}
              className="group relative bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-4"
            >
              <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Search className="size-5 sm:size-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  Consultas de Órdenes
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Búsqueda detallada por fecha, estado, cliente y reimpresión de
                  comprobantes.
                </p>
                <div className="mt-2.5 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-sky-600">
                  <span>Consultar</span>
                  <ArrowRight className="size-3 sm:size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Card: Usuarios & Roles */}
            <div
              onClick={() => handleNavigateTab("usuarios")}
              className="group relative bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-start gap-3 sm:gap-4"
            >
              <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users className="size-5 sm:size-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Usuarios & Roles
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Creación de cuentas, asignación de permisos, restablecimiento
                  de accesos y perfiles.
                </p>
                <div className="mt-2.5 sm:mt-3 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-blue-600">
                  <span>Gestionar</span>
                  <ArrowRight className="size-3 sm:size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News Modal */}
      <AdminNewsModal
        open={newsModalOpen}
        onOpenChange={setNewsModalOpen}
        selectedUpdateId={selectedUpdateId}
      />
    </div>
  );
}
