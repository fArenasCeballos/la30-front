import pkg from "../../package.json";
import { SiigoProductsModal } from "@/components/SiigoProductsModal";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Package,
  FileText,
  Users,
  Search,
  Boxes,
  Map,
  Bike,
  Smartphone,
  Store as StoreIcon,
  ChevronRight,
  ArrowLeftRight,
  Menu,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const PanelDeControl = lazy(() => import("@/components/admin/PanelDeControl"));
const Inventario = lazy(() => import("./Inventario"));
const Bodega = lazy(() => import("./Bodega"));
const Reporteria = lazy(() => import("./Reporteria"));
const Usuarios = lazy(() => import("./Usuarios"));
const Consultas = lazy(() => import("./Consultas"));
const ZonasDomicilio = lazy(() => import("./ZonasDomicilio"));
const DomiciliariosAdmin = lazy(() => import("./DomiciliariosAdmin"));
const AppConfigAdmin = lazy(() => import("./AppConfigAdmin"));

interface TabItem {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  component: ComponentType<{ onSelectTab?: (tabId: string) => void }>;
}

interface NavGroup {
  title: string;
  items: TabItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Visión General",
    items: [
      {
        id: "panel",
        label: "Panel de Control",
        desc: "Resumen ejecutivo y accesos directos",
        icon: LayoutDashboard,
        component: PanelDeControl,
      },
    ],
  },
  {
    title: "Catálogo & Suministros",
    items: [
      {
        id: "inventario",
        label: "Inventario & Menú",
        desc: "Productos, categorías y extras",
        icon: Package,
        component: Inventario,
      },
      {
        id: "bodega",
        label: "Bodega & Insumos",
        desc: "Materia prima, compras y recetas",
        icon: Boxes,
        component: Bodega,
      },
    ],
  },
  {
    title: "Canales & Despacho",
    items: [
      {
        id: "config-app",
        label: "App Móvil",
        desc: "Catálogo web, combos y horarios",
        icon: Smartphone,
        component: AppConfigAdmin,
      },
      {
        id: "zonas-domicilio",
        label: "Zonas de Domicilio",
        desc: "Tarifas y polígonos de reparto",
        icon: Map,
        component: ZonasDomicilio,
      },
      {
        id: "domiciliarios",
        label: "Domiciliarios",
        desc: "Flota de reparto y entregas",
        icon: Bike,
        component: DomiciliariosAdmin,
      },
    ],
  },
  {
    title: "Auditoría & Análisis",
    items: [
      {
        id: "reportes",
        label: "Reportes & KPIs",
        desc: "Ventas, turnos y métricas clave",
        icon: FileText,
        component: Reporteria,
      },
      {
        id: "consultas",
        label: "Consultas de Órdenes",
        desc: "Búsqueda avanzada y reimpresión",
        icon: Search,
        component: Consultas,
      },
    ],
  },
  {
    title: "Control de Acceso",
    items: [
      {
        id: "usuarios",
        label: "Usuarios & Roles",
        desc: "Personal, perfiles y permisos",
        icon: Users,
        component: Usuarios,
      },
    ],
  },
];

const TabLoading = () => (
  <div className="p-6 sm:p-8 space-y-6 animate-pulse max-w-5xl mx-auto">
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Persistent sidebar collapsed state on desktop/iPad landscape
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("la30_admin_sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("la30_admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Role Guard
  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "bodega") {
      const defaultPaths: Record<string, string> = {
        caja: "/caja",
        cocina: "/cocina",
        mesero: "/kiosko",
      };
      navigate(defaultPaths[user.role] || "/", { replace: true });
    }
  }, [user, navigate]);

  // Flatten all items
  const allTabs = useMemo(() => NAV_GROUPS.flatMap((g) => g.items), []);

  // Filter for bodega role if applicable
  const availableGroups = useMemo(() => {
    if (user?.role === "bodega") {
      return [
        {
          title: "Suministros",
          items: allTabs.filter((t) => t.id === "bodega"),
        },
      ];
    }
    return NAV_GROUPS;
  }, [user?.role, allTabs]);

  const defaultTab = user?.role === "bodega" ? "bodega" : "panel";
  const currentTabId = searchParams.get("tab") || defaultTab;
  const activeTab = allTabs.find((t) => t.id === currentTabId) || allTabs[0];

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  if (user?.role !== "admin" && user?.role !== "bodega") return null;

  const ActiveComponent = activeTab.component;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-4rem)] 2xl:min-h-[calc(100vh-5rem)] flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* Mobile & iPad Portrait (< lg) Navigation Header */}
      <div className="lg:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-14 z-30 px-3.5 py-2.5 flex flex-col gap-2.5 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          {/* Drawer trigger button */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-xs hover:bg-teal-700 active:scale-95 transition-all cursor-pointer"
                title="Abrir menú de módulos"
              >
                <Menu className="size-4" />
                <span>Módulos</span>
              </button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-[85vw] max-w-xs sm:max-w-sm p-0 flex flex-col justify-between bg-white"
            >
              <SheetHeader className="p-4 border-b border-slate-100 text-left bg-slate-50/50">
                <SheetTitle className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-teal-500 animate-pulse" />
                  Centro de Control La 30
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Menú de navegación para los módulos administrativos y de configuración de La 30 POS.
                </SheetDescription>
              </SheetHeader>

              {/* Scrollable menu content inside Sheet */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {availableGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5 mb-1">
                      {group.title}
                    </h4>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = item.id === activeTab.id;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              handleTabChange(item.id);
                              setIsDrawerOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer",
                              isActive
                                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20 font-bold"
                                : "text-slate-700 hover:bg-slate-100/80 active:bg-slate-200"
                            )}
                          >
                            <div
                              className={cn(
                                "size-8 rounded-lg flex items-center justify-center shrink-0",
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-100 text-slate-600"
                              )}
                            >
                              <Icon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold leading-tight truncate">
                                {item.label}
                              </p>
                              <p
                                className={cn(
                                  "text-[10px] leading-tight truncate mt-0.5",
                                  isActive ? "text-teal-100" : "text-slate-400"
                                )}
                              >
                                {item.desc}
                              </p>
                            </div>
                            {isActive && (
                              <ChevronRight className="size-4 text-white/80 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Drawer Footer */}
              <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    navigate("/select-store");
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <StoreIcon className="size-4 text-teal-600" />
                    <span>Puntos de Venta</span>
                  </div>
                  <ArrowLeftRight className="size-3 text-slate-400" />
                </button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Active module name indicator on mobile */}
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-center sm:justify-start">
            <activeTab.icon className="size-4 text-teal-600 shrink-0" />
            <span className="text-xs font-black uppercase tracking-tight text-slate-900 truncate">
              {activeTab.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <SiigoProductsModal />
          </div>
        </div>

        {/* Quick horizontal swipeable pills for 1-tap fast switching on touch */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {availableGroups.flatMap((g) => g.items).map((tab) => {
            const isActive = tab.id === activeTab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0",
                  isActive
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 active:scale-95"
                )}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop & iPad Landscape Sidebar (lg:) with Collapsible Mode */}
      <aside
        className={cn(
          "hidden lg:flex bg-white border-r border-slate-200/80 shrink-0 flex-col justify-between py-4 transition-all duration-300 sticky top-14 lg:top-16 2xl:top-20 h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)] 2xl:h-[calc(100vh-5rem)] shadow-2xs select-none",
          isCollapsed ? "w-20 px-2" : "w-64 xl:w-72 px-3"
        )}
      >
        <div className="space-y-4 overflow-y-auto premium-scrollbar pr-0.5">
          {/* Header of Sidebar with Collapse/Expand button */}
          <div className="flex items-center justify-between px-2 pt-1">
            {!isCollapsed && (
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Módulos Globales
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={toggleSidebar}
              className={cn(
                "p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer",
                isCollapsed && "mx-auto"
              )}
              title={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            >
              {isCollapsed ? (
                <PanelLeft className="size-4.5 text-teal-600" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>

          {/* Navigation Groups */}
          <nav className="space-y-4">
            {availableGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                {!isCollapsed && (
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400/90 px-2.5 mb-1.5 truncate">
                    {group.title}
                  </h3>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.id === activeTab.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTabChange(item.id)}
                        title={item.label + " — " + item.desc}
                        className={cn(
                          "w-full flex items-center rounded-xl text-left transition-all duration-200 group cursor-pointer relative",
                          isCollapsed
                            ? "justify-center p-2.5"
                            : "gap-3 px-3 py-2",
                          isActive
                            ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                        )}
                      >
                        <div
                          className={cn(
                            "size-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105",
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-teal-700"
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        {!isCollapsed && (
                          <>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "text-xs font-bold truncate leading-tight",
                                  isActive ? "text-white" : "text-slate-800"
                                )}
                              >
                                {item.label}
                              </p>
                              <p
                                className={cn(
                                  "text-[10px] truncate leading-tight mt-0.5",
                                  isActive ? "text-teal-100" : "text-slate-400"
                                )}
                              >
                                {item.desc}
                              </p>
                            </div>
                            {isActive && (
                              <ChevronRight className="size-3.5 text-white/80 shrink-0" />
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer of Sidebar */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={() => navigate("/select-store")}
            title="Volver a la selección de puntos de venta"
            className={cn(
              "w-full flex items-center rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all group cursor-pointer shadow-2xs",
              isCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2"
            )}
          >
            <div className="flex items-center gap-2">
              <StoreIcon className="size-4 text-teal-600 group-hover:scale-110 transition-transform shrink-0" />
              {!isCollapsed && <span>Puntos de Venta</span>}
            </div>
            {!isCollapsed && (
              <ArrowLeftRight className="size-3 text-slate-400 group-hover:text-teal-600 transition-colors" />
            )}
          </button>

          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 text-[10px] text-slate-400 font-medium">
              <span>La 30 Back-Office</span>
              <span className="font-bold text-slate-500">v{pkg.version}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Subtle Module Header Bar (Visible on desktop & tablets) */}
        <div className="hidden sm:flex bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 lg:px-8 py-3 items-center justify-between shadow-2xs no-print">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-teal-50 border border-teal-200/60 text-teal-700 flex items-center justify-center shadow-inner shrink-0">
              <activeTab.icon className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm lg:text-base font-black uppercase tracking-tight text-slate-900 leading-none">
                  {activeTab.label}
                </h1>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 uppercase">
                  {activeTab.id === "panel" ? "Principal" : "Módulo Activo"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none mt-1">
                {activeTab.desc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SiigoProductsModal />
          </div>
        </div>

        {/* Dynamic Component Canvas */}
        <div className="flex-1">
          <ErrorBoundary>
            <Suspense fallback={<TabLoading />}>
              <ActiveComponent onSelectTab={handleTabChange} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
