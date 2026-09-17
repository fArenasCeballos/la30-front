import pkg from "../../package.json";
import { useNavigate, Navigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useCompany } from "@/context/CompanyContext";
import { useAuth } from "@/context/AuthContext";
import type { Store } from "@/types";
import {
  Store as StoreIcon,
  Settings,
  ShieldCheck,
  ArrowRight,
  LogOut,
  Truck,
  UtensilsCrossed,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

function getStoreTheme(store: Store) {
  const slug = store.slug?.toLowerCase() || "";
  const name = store.name?.toLowerCase() || "";

  if (slug.includes("domicilio") || name.includes("domicilio")) {
    return {
      iconBox:
        "bg-purple-50 text-purple-600 border-purple-200/80 group-hover:bg-purple-100/70",
      badge: "bg-purple-50 text-purple-700 border-purple-200/80",
      hoverBorder: "hover:border-purple-400 hover:shadow-purple-500/10",
      btnText: "text-purple-600 group-hover:text-purple-700",
      activeRing: "ring-2 ring-purple-500 border-purple-500 shadow-purple-500/10",
      pingColor: "bg-purple-500",
    };
  }
  if (
    slug.includes("trailer") ||
    slug.includes("carrito") ||
    name.includes("trailer")
  ) {
    return {
      iconBox:
        "bg-emerald-50 text-emerald-600 border-emerald-200/80 group-hover:bg-emerald-100/70",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      hoverBorder: "hover:border-emerald-400 hover:shadow-emerald-500/10",
      btnText: "text-emerald-600 group-hover:text-emerald-700",
      activeRing:
        "ring-2 ring-emerald-500 border-emerald-500 shadow-emerald-500/10",
      pingColor: "bg-emerald-500",
    };
  }
  return {
    iconBox:
      "bg-orange-50 text-orange-600 border-orange-200/80 group-hover:bg-orange-100/70",
    badge: "bg-orange-50 text-orange-700 border-orange-200/80",
    hoverBorder: "hover:border-orange-400 hover:shadow-orange-500/10",
    btnText: "text-orange-600 group-hover:text-orange-700",
    activeRing: "ring-2 ring-orange-500 border-orange-500 shadow-orange-500/10",
    pingColor: "bg-orange-500",
  };
}

function getStoreIcon(store: Store) {
  const slug = store.slug?.toLowerCase() || "";
  const name = store.name?.toLowerCase() || "";

  if (slug.includes("domicilio") || name.includes("domicilio")) {
    return <Truck className="size-7 sm:size-8" />;
  }
  if (
    slug.includes("trailer") ||
    slug.includes("carrito") ||
    name.includes("trailer")
  ) {
    return <Truck className="size-7 sm:size-8" />;
  }
  if (store.icon) {
    return (
      <span className="text-2xl sm:text-3xl leading-none">{store.icon}</span>
    );
  }
  return <UtensilsCrossed className="size-7 sm:size-8" />;
}

function getStoreSubtitle(store: Store) {
  const slug = store.slug?.toLowerCase() || "";
  const name = store.name?.toLowerCase() || "";

  if (slug.includes("domicilio") || name.includes("domicilio")) {
    return "Centro de Despacho & Entregas";
  }
  if (
    slug.includes("trailer") ||
    slug.includes("carrito") ||
    name.includes("trailer")
  ) {
    return "Punto Móvil / Carrito";
  }
  return "Sede Principal";
}

export default function StoreSelector() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, loading } = useAuth();
  const { activeCompany, canSwitchCompany, loading: companyLoading } = useCompany();
  const {
    stores,
    activeStore,
    setActiveStore,
    loading: storeLoading,
  } = useStore();

  if (loading || companyLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center animate-pulse">
            <StoreIcon className="size-6 text-teal-600" />
          </div>
          <div className="w-8 h-8 border-3 border-teal-500/20 border-t-teal-600 rounded-full animate-spin" />
          <span className="text-teal-700 font-bold uppercase tracking-widest text-xs">
            Cargando sedes...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (canSwitchCompany && !activeCompany) {
    return <Navigate to="/select-company" replace />;
  }

  const activeStores = stores.filter((s) => s.is_active);
  const isAdmin = user?.role === "admin" || user?.role === "bodega";

  const handleSelect = (store: Store) => {
    setActiveStore(store);

    if (
      store.slug === "domicilios" &&
      (user?.role === "admin" || user?.role === "caja")
    ) {
      navigate("/domicilios", { replace: true });
    } else if (user?.role === "mesero") {
      navigate("/kiosko", { replace: true });
    } else if (user?.role === "cocina") {
      navigate("/cocina", { replace: true });
    } else if (user?.role === "caja") {
      navigate("/caja", { replace: true });
    } else if (user?.role === "admin") {
      navigate(store.slug === "domicilios" ? "/domicilios" : "/dashboard", {
        replace: true,
      });
    } else if (user?.role === "bodega") {
      navigate("/administracion?tab=bodega", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  const totalCards = activeStores.length + (isAdmin ? 1 : 0);

  return (
    <div
      className="relative min-h-screen min-h-[100dvh] w-full max-w-full bg-slate-50/70 text-slate-900 flex flex-col justify-between px-4 sm:p-6 lg:p-8 overflow-x-hidden overflow-y-auto select-none"
      style={{
        paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))",
        paddingBottom: "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))",
      }}
    >
      {/* Luces sutiles de fondo contenidas para evitar desbordamiento horizontal */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[450px] max-w-full h-[250px] bg-teal-500/5 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[300px] max-w-full h-[200px] bg-orange-500/5 blur-[90px] rounded-full" />
      </div>

      {/* Cabecera Superior */}
      <header className="relative z-10 flex items-center justify-between max-w-4xl w-full mx-auto shrink-0 py-1">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-9 sm:size-10 items-center justify-center rounded-2xl text-white shadow-md p-1.5"
            style={{ background: `linear-gradient(135deg, ${activeCompany?.color || '#059669'}, ${activeCompany?.color || '#0d9488'}cc)`, boxShadow: `0 4px 14px ${activeCompany?.color || '#059669'}25` }}
          >
            {activeCompany?.icon ? (
              <span className="text-lg">{activeCompany.icon}</span>
            ) : (
              <Logo className="size-5 sm:size-6 text-white" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-base sm:text-lg font-black tracking-tight text-slate-900">
                {activeCompany?.name || "La 30"}
              </span>
              <span className="rounded-md bg-teal-500/15 border border-teal-500/20 px-1.5 py-0.2 text-[9px] font-black text-teal-700 uppercase">
                POS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Plataforma de Gestión
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-700 bg-white border border-slate-200/80 px-3 py-1 rounded-full shadow-2xs">
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800">
              {user?.name || user?.email}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-extrabold">
              ({user?.role})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer h-8 px-2.5"
          >
            <LogOut className="size-3.5 mr-1" />
            Cerrar Sesión
          </Button>
          {canSwitchCompany && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/select-company")}
              className="text-xs text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors cursor-pointer h-8 px-2.5"
            >
              <Building2 className="size-3.5 mr-1" />
              Cambiar Empresa
            </Button>
          )}
        </div>
      </header>

      {/* Área Central: Selector de Puntos de Venta */}
      <main className="relative z-10 max-w-4xl w-full mx-auto my-auto py-2 sm:py-4 space-y-4 sm:space-y-6 shrink-0">
        {/* Título Principal */}
        <div className="text-center space-y-1.5">
          <h1 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
            Puntos de Venta
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-0.5 w-8 bg-teal-500/40 rounded-full" />
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">
              SELECCIONA EL PUNTO DE VENTA O TIENDA
            </p>
            <div className="h-0.5 w-8 bg-teal-500/40 rounded-full" />
          </div>
        </div>

        {/* Grid de Tarjetas */}
        <div
          className={cn(
            "grid gap-4 sm:gap-5 mx-auto w-full",
            totalCards === 4
              ? "grid-cols-1 sm:grid-cols-2 max-w-4xl"
              : totalCards === 3
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl"
                : totalCards === 2
                  ? "grid-cols-1 sm:grid-cols-2 max-w-3xl"
                  : "grid-cols-1 max-w-md",
          )}
        >
          {/* 1. Tiendas Asignadas Activas */}
          {activeStores.map((s) => {
            const isSelected = s.id === activeStore?.id;
            const theme = getStoreTheme(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                className={cn(
                  "group relative flex flex-col items-center justify-center p-5 sm:p-6 rounded-3xl border transition-all duration-300 text-center cursor-pointer",
                  "bg-white hover:bg-slate-50/50",
                  "border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1",
                  theme.hoverBorder,
                  isSelected && theme.activeRing,
                )}
              >
                {/* Badge Activa */}
                <div className="absolute top-3.5 right-3.5">
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border shadow-2xs uppercase tracking-wider",
                      theme.badge,
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full animate-pulse",
                        theme.pingColor,
                      )}
                    />
                    ACTIVA
                  </span>
                </div>

                {/* Icono de Tienda */}
                <div
                  className={cn(
                    "flex size-14 sm:size-16 items-center justify-center rounded-2xl border transition-all duration-300 shadow-2xs mb-3 group-hover:scale-105",
                    theme.iconBox,
                  )}
                >
                  {getStoreIcon(s)}
                </div>

                {/* Nombre de la Tienda */}
                <h3 className="font-display text-lg sm:text-xl font-black text-slate-900 group-hover:text-slate-950 transition-colors tracking-tight">
                  {s.name}
                </h3>

                {/* Ubicación y Tipo */}
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {getStoreSubtitle(s)}
                </p>

                {/* Botón Ingresar */}
                <div
                  className={cn(
                    "mt-3.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                    theme.btnText,
                  )}
                >
                  <span>INGRESAR AHORA</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}

          {/* 2. Tarjeta: Administración Global */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate("/administracion")}
              className="group relative flex flex-col items-center justify-center p-5 sm:p-6 rounded-3xl border border-slate-200/90 hover:border-teal-400/80 bg-white hover:bg-slate-50/50 transition-all duration-300 text-center cursor-pointer shadow-xs hover:shadow-xl hover:shadow-teal-500/10 hover:-translate-y-1"
            >
              <div className="absolute top-3.5 right-3.5">
                <span className="flex items-center gap-1 text-[9px] font-black text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full shadow-2xs uppercase tracking-wider">
                  <ShieldCheck className="size-3" />
                  ADMIN
                </span>
              </div>

              <div className="flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-600 group-hover:scale-105 group-hover:bg-teal-100/70 transition-all duration-300 shadow-2xs mb-3">
                <Settings className="size-7 sm:size-8" />
              </div>

              <h3 className="font-display text-lg sm:text-xl font-black text-slate-900 group-hover:text-slate-950 transition-colors tracking-tight">
                Administración
              </h3>

              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Gestión Global de Tiendas & Roles
              </p>

              <div className="mt-3.5 flex items-center gap-1.5 text-xs font-bold text-teal-600 group-hover:text-teal-700 uppercase tracking-wider transition-colors">
                <span>CONFIGURAR</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          )}
        </div>
      </main>

      {/* Pie de Página */}
      <footer className="relative z-10 text-center text-[11px] text-slate-400 max-w-4xl w-full mx-auto py-1 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-1 shrink-0">
        <span>{activeCompany?.name || "La 30"} POS · Aislamiento total de datos por tienda</span>
        <span>v{pkg.version}</span>
      </footer>
    </div>
  );
}

