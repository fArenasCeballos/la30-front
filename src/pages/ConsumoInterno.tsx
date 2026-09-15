import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UtensilsCrossed,
  Users,
  Handshake,
  ClipboardList,
  ShoppingCart,
} from "lucide-react";

// ── Lazy-loaded sub-views ────────────────────────────────────────────────────

const InternalPosView = lazy(() =>
  import("@/components/consumo-interno/InternalPosView").then((m) => ({
    default: m.InternalPosView,
  })),
);

const EmployeeAccountsView = lazy(() =>
  import("@/components/consumo-interno/EmployeeAccountsView").then((m) => ({
    default: m.EmployeeAccountsView,
  })),
);

const PartnerAccountsView = lazy(() =>
  import("@/components/consumo-interno/PartnerAccountsView").then((m) => ({
    default: m.PartnerAccountsView,
  })),
);

const InternalHistoryView = lazy(() =>
  import("@/components/consumo-interno/InternalHistoryView").then((m) => ({
    default: m.InternalHistoryView,
  })),
);

// ── Tab Configuration ────────────────────────────────────────────────────────

const TABS = [
  {
    id: "pos",
    label: "Nuevo Pedido",
    icon: ShoppingCart,
    component: InternalPosView,
  },
  {
    id: "empleados",
    label: "Empleados",
    icon: Users,
    component: EmployeeAccountsView,
  },
  {
    id: "socios",
    label: "Socios",
    icon: Handshake,
    component: PartnerAccountsView,
  },
  {
    id: "historial",
    label: "Historial",
    icon: ClipboardList,
    component: InternalHistoryView,
  },
] as const;

// ── Loading Fallback ─────────────────────────────────────────────────────────

function TabLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse max-w-5xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/4 rounded-xl" />
        <Skeleton className="h-4 w-1/3 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ConsumoInterno() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("pos");

  // Role Guard: Only admin and caja can access this module
  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "caja") {
      const defaultPaths: Record<string, string> = {
        mesero: "/kiosko",
        cocina: "/cocina",
        bodega: "/administracion?tab=bodega",
      };
      navigate(defaultPaths[user.role] || "/", { replace: true });
    }
  }, [user, navigate]);

  if (!user || (user.role !== "admin" && user.role !== "caja")) return null;

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const ActiveComponent = currentTab.component;

  return (
    <div className="min-h-screen bg-slate-50/30">
      {/* Sub-header */}
      <div className="bg-white/95 backdrop-blur-xl border-b border-slate-200/80 sticky top-14 lg:top-16 2xl:top-20 z-40 px-4 lg:px-6 2xl:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-br from-teal-500/15 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-teal-700 shadow-2xs shrink-0">
            <UtensilsCrossed className="size-5 text-teal-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-none">
                Consumo Interno
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                50% Dcto en Cocina
              </span>
            </div>
            <p className="text-[10px] font-semibold text-slate-400 tracking-wide mt-0.5">
              Gestión y registro de consumo para Empleados y Socios
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 overflow-x-auto max-w-full shadow-2xs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
                  isActive
                    ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white/60",
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5",
                    isActive ? "text-teal-600" : "text-slate-400",
                  )}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="animate-in fade-in duration-300">
        <ErrorBoundary>
          <Suspense fallback={<TabLoading />}>
            <ActiveComponent />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
