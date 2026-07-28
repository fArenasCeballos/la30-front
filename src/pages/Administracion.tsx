import { SiigoProductsModal } from "@/components/SiigoProductsModal";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Package,
  FileText,
  Users,
  Search,
  ChevronRight,
  Settings,
  Boxes,
  Map,
} from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";

const Inventario = lazy(() => import("./Inventario"));
const Bodega = lazy(() => import("./Bodega"));
const Reporteria = lazy(() => import("./Reporteria"));
const Usuarios = lazy(() => import("./Usuarios"));
const Consultas = lazy(() => import("./Consultas"));
const ZonasDomicilio = lazy(() => import("./ZonasDomicilio"));

const TABS = [
  {
    id: "inventario",
    label: "Inventario",
    icon: Package,
    component: Inventario,
    desc: "Gestionar productos, categorías y stock del sistema",
  },
  {
    id: "bodega",
    label: "Bodega",
    icon: Boxes,
    component: Bodega,
    desc: "Materia prima, compras, stock real y recetas",
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: FileText,
    component: Reporteria,
    desc: "Visualizar ventas, analíticas y auditorías del turno",
  },
  {
    id: "usuarios",
    label: "Usuarios",
    icon: Users,
    component: Usuarios,
    desc: "Administrar perfiles de personal, meseros y accesos",
  },
  {
    id: "consultas",
    label: "Consultas",
    icon: Search,
    component: Consultas,
    desc: "Búsqueda quirúrgica y control detallado de órdenes del día",
  },
  {
    id: "zonas-domicilio",
    label: "Zonas Domicilio",
    icon: Map,
    component: ZonasDomicilio,
    desc: "Configurar zonas geográficas y precios de domicilio en el mapa",
  },
];

const TabLoading = () => (
  <div className="p-8 space-y-6 animate-pulse max-w-5xl mx-auto">
    <div className="space-y-2">
      <Skeleton className="h-8 w-1/4 rounded-xl" />
      <Skeleton className="h-4 w-1/3 rounded-xl" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-32 rounded-3xl" />
    </div>
    <Skeleton className="h-64 rounded-3xl w-full" />
  </div>
);

export default function Administracion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab");

  // Role Guard
  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "bodega") {
      const defaultPaths: Record<string, string> = {
        caja: "/caja",
        cocina: "/cocina",
        mesero: "/kiosko",
      };
      navigate(defaultPaths[user.role] || "/", { replace: true });
    } else if (user && user.role === "bodega" && currentTab !== "bodega") {
      navigate("/administracion?tab=bodega", { replace: true });
    }
  }, [user, navigate, currentTab]);

  const visibleTabs = user?.role === "bodega" ? TABS.filter((t) => t.id === "bodega") : TABS;
  const activeTab = visibleTabs.find((t) => t.id === currentTab);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  if (user?.role !== "admin" && user?.role !== "bodega") return null;

  return (
    <div className="min-h-screen bg-slate-50/30">
      {/* Sub-header navigation for Administracion */}
      <div className="bg-white border-b sticky top-14 lg:top-16 2xl:top-20 z-40 px-4 lg:px-6 2xl:px-10 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-soft no-print">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Settings className="h-5 w-5 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-primary leading-none mb-1">
              Administración
            </h1>
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              Configuración y Control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 premium-scrollbar">
          <SiigoProductsModal />
          {user?.role === "admin" && (
            <button
              onClick={() => setSearchParams({})}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                !currentTab
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-muted-foreground/60 hover:bg-accent/40 hover:text-primary",
              )}
            >
              Panel General
            </button>
          )}
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                  isActive
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-muted-foreground/60 hover:bg-accent/40 hover:text-primary",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {!activeTab ? (
        <div className="section-container max-w-5xl mx-auto py-12 lg:py-20 px-4 animate-in fade-in duration-500">
          <div className="text-center max-w-xl mx-auto mb-12 lg:mb-16">
            <h2 className="text-3xl font-black tracking-tight text-primary uppercase">
              Centro de Control
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mt-2">
              Gestión de Parámetros de La 30
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <div
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className="pos-card p-8 cursor-pointer hover:border-primary/30 hover:shadow-xl transition-all group flex items-start gap-6 relative overflow-hidden bg-white border-2 rounded-3xl"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-linear-to-bl from-primary/5 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-300" />

                  <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shrink-0 shadow-inner">
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="space-y-2 flex-1">
                    <h3 className="text-lg font-black uppercase tracking-wider text-primary flex items-center gap-2">
                      {tab.label}
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs font-semibold text-muted-foreground/80 leading-relaxed">
                      {tab.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
          <ErrorBoundary>
            <Suspense fallback={<TabLoading />}>
              <activeTab.component />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
