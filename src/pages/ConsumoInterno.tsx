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
      <div className="bg-white border-b sticky top-14 lg:top-16 2xl:top-20 z-40 px-4 lg:px-6 2xl:px-10 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-soft no-print">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-primary leading-none mb-1">
              Consumo Interno
            </h1>
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              Empleados y Socios · 50% Dcto.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 premium-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
