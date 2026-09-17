import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  ShoppingCart,
  Monitor,
  ChefHat,
  BarChart3,
  Wrench,
  ClipboardList,
  Truck,
  UtensilsCrossed,
  Search,
  ArrowLeftRight,
  Store as StoreIcon,
  Settings,
  MoreHorizontal,
  Building2,
} from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { NavLink } from "@/components/NavLink";
import type { UserRole, Store as StoreType } from "@/types";
import { useCompany } from "@/context/CompanyContext";
import { NotificationBell } from "./NotificationBell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { Logo } from "./ui/logo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS: {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}[] = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin"] },
  {
    to: "/kiosko",
    label: "Kiosko",
    icon: ShoppingCart,
    roles: ["mesero", "admin", "caja"],
  },
  { to: "/caja", label: "Caja", icon: Monitor, roles: ["caja", "admin"] },
  {
    to: "/domicilios",
    label: "Domicilios",
    icon: Truck,
    roles: ["caja", "admin"],
  },
  {
    to: "/cocina",
    label: "Cocina",
    icon: ChefHat,
    roles: ["cocina", "admin", "caja"],
  },
  {
    to: "/mis-pedidos",
    label: "Mis Pedidos",
    icon: ClipboardList,
    roles: ["mesero", "caja", "admin"],
  },
  {
    to: "/consumo-interno",
    label: "Consumo Interno",
    icon: UtensilsCrossed,
    roles: ["caja", "admin"],
  },
  {
    to: "/consultas",
    label: "Consultas",
    icon: Search,
    roles: ["caja", "admin"],
  },
];

function getStoreTheme(store: StoreType | null) {
  if (!store) {
    return {
      bg: "bg-gray-100/80 hover:bg-gray-200/80",
      border: "border-gray-300 hover:border-gray-400",
      text: "text-gray-800",
      badge: "bg-gray-700 text-white shadow-gray-500/20",
      accent: "#4b5563",
      glow: "shadow-gray-500/10",
      defaultIcon: "🏪",
      label: "SIN TIENDA",
      tag: "Punto de venta",
      accentBg: "bg-gray-500",
    };
  }

  const slug = store.slug?.toLowerCase() || "";
  const name = store.name?.toLowerCase() || "";

  if (slug.includes("domicilio") || name.includes("domicilio")) {
    return {
      bg: "bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-purple-500/5 hover:from-purple-500/25 hover:to-purple-500/15",
      border: "border-purple-500/50 hover:border-purple-600",
      text: "text-purple-900",
      badge: "bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30",
      accent: "#9333ea",
      glow: "shadow-lg shadow-purple-500/15",
      defaultIcon: "🛵",
      label: "DOMICILIOS",
      tag: "Centro de Despacho & Entregas",
      accentBg: "bg-purple-600",
    };
  }

  if (
    slug.includes("trailer") ||
    slug.includes("carrito") ||
    name.includes("trailer") ||
    name.includes("tráiler")
  ) {
    return {
      bg: "bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/25 hover:to-emerald-500/15",
      border: "border-emerald-500/50 hover:border-emerald-600",
      text: "text-emerald-900",
      badge: "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30",
      accent: "#059669",
      glow: "shadow-lg shadow-emerald-500/15",
      defaultIcon: "🚚",
      label: "TRÁILER",
      tag: "Punto Móvil / Carrito",
      accentBg: "bg-emerald-600",
    };
  }

  return {
    bg: "bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-orange-500/5 hover:from-orange-500/25 hover:to-orange-500/15",
    border: "border-orange-500/50 hover:border-orange-600",
    text: "text-orange-950",
    badge: "bg-gradient-to-br from-orange-600 to-amber-600 text-white shadow-md shadow-orange-500/30",
    accent: store.color || "#ea580c",
    glow: "shadow-lg shadow-orange-500/15",
    defaultIcon: store.icon || "🍽️",
    label: store.name?.toUpperCase() || "RESTAURANTE",
    tag: "Comedor & Salón Principal",
    accentBg: "bg-orange-600",
  };
}

export function AppLayout() {
  const { user, logout, logoutAll, forceReset, isAuthenticated, loading } =
    useAuth();
  const {
    activeStore,
    canSwitchStore,
    loading: storeLoading,
  } = useStore();
  const { activeCompany, canSwitchCompany, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdministracion = location.pathname.startsWith("/administracion");
  const ecosystem = location.pathname.startsWith("/kiosko")
    ? "kiosk"
    : "restaurant";
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);
  const [hasOtherSessions, setHasOtherSessions] = useState(false);

  const adminTheme = {
    bg: "bg-gradient-to-r from-teal-500/20 via-teal-500/10 to-teal-500/5 hover:from-teal-500/25 hover:to-teal-500/15",
    border: "border-teal-500/50 hover:border-teal-600",
    text: "text-teal-900",
    badge: "bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/30",
    accent: "#0d9488",
    glow: "shadow-lg shadow-teal-500/15",
    defaultIcon: "⚙️",
    label: "ADMINISTRACIÓN",
    tag: "Gestión Global & Control",
    accentBg: "bg-teal-600",
  };

  const currentTheme = isAdministracion ? adminTheme : getStoreTheme(activeStore);

  useEffect(() => {
    if (isAuthenticated) {
      supabase.rpc("has_other_sessions").then(({ data }) => {
        if (data) setHasOtherSessions(true);
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 4000);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Guard: Prevent accessing /domicilios if the active store is not Domicilios
  useEffect(() => {
    if (
      !loading &&
      !storeLoading &&
      activeStore &&
      location.pathname === "/domicilios" &&
      activeStore.slug !== "domicilios"
    ) {
      navigate(user?.role === "admin" ? "/dashboard" : "/");
    }
  }, [
    loading,
    storeLoading,
    activeStore,
    location.pathname,
    navigate,
    user?.role,
  ]);

  if (loading || companyLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-accent/20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border-2 shadow-strong flex items-center justify-center animate-bounce">
            <Logo className="h-6 w-6" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">
            Iniciando plataforma...
          </p>
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

  if (storeLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-accent/20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border-2 shadow-strong flex items-center justify-center animate-bounce">
            <Logo className="h-6 w-6" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">
            Cargando sede...
          </p>
        </div>
      </div>
    );
  }

  // Si el usuario tiene múltiples tiendas asignadas pero aún no ha seleccionado ninguna
  // y no está en la vista global de administración, debe elegir primero su tienda
  if (canSwitchStore && !activeStore && !isAdministracion) {
    return <Navigate to="/select-store" replace />;
  }

  const role = user?.role;
  const isCaja = role === "caja";

  // Filter navigation items based on user role, active store, and caja ecosystem
  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!role) return false;

    // Hide Domicilios module from the navbar if the active store is NOT "domicilios"
    if (item.to === "/domicilios" && activeStore?.slug !== "domicilios") {
      return false;
    }

    // Caja role ecosystem isolation
    if (isCaja) {
      if (ecosystem === "restaurant") {
        if (item.to === "/kiosko") return false;
      }
    }

    return item.roles.includes(role);
  });

  // Mobile / Tablet WhatsApp & Instagram style bottom bar navigation
  const primaryMobileNav =
    visibleNav.length > 5 ? visibleNav.slice(0, 4) : visibleNav;
  const secondaryMobileNav =
    visibleNav.length > 5 ? visibleNav.slice(4) : [];
  const isMoreActive = secondaryMobileNav.some(
    (item) => location.pathname === item.to
  );
  const hasMoreItems = secondaryMobileNav.length > 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans selection:bg-primary selection:text-white pb-28 lg:pb-0">
      {/* Offline Status Banners */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-md relative z-50"
          >
            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>
              Modo sin conexión: Los pedidos se guardarán localmente y se
              sincronizarán al recuperar la red.
            </span>
          </motion.div>
        )}
        {showRestored && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-600 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-md relative z-50"
          >
            <div className="w-2 h-2 rounded-full bg-white" />
            <span>
              Conexión restablecida. Sincronizando datos con el servidor...
            </span>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Premium Glass Header with Subtle Ambient Store Aura */}
      <header
        className="relative h-14 lg:h-16 2xl:h-20 border-b bg-white/95 backdrop-blur-md flex items-center px-4 lg:px-6 2xl:px-10 gap-2 lg:gap-4 2xl:gap-8 sticky top-0 z-50 transition-all duration-300"
        style={{
          backgroundImage: `radial-gradient(450px circle at 180px 0px, ${currentTheme.accent}15, transparent 80%)`,
        }}
      >
        {/* Brand & Store Selector */}
        <div className="flex items-center gap-2 lg:gap-4 2xl:gap-6 flex-1 lg:flex-none">
          <div
            className="flex items-center gap-2 lg:gap-3 group cursor-pointer shrink-0"
            onClick={() => {
              if (isAdministracion) navigate("/administracion");
              else if (user?.role === "admin") navigate("/dashboard");
              else if (user?.role === "caja") navigate("/caja");
              else if (user?.role === "cocina") navigate("/cocina");
              else if (user?.role === "mesero") navigate("/kiosko");
              else navigate("/");
            }}
          >
            <div className="w-9 h-9 lg:w-10 2xl:w-12 lg:h-10 2xl:h-12 rounded-xl lg:rounded-2xl 2xl:rounded-3xl bg-white border-2 shadow-soft flex items-center justify-center overflow-hidden group-hover:scale-105 group-hover:rotate-3 transition-all duration-200">
              {activeCompany?.icon ? (
                <span className="text-base lg:text-lg 2xl:text-xl">{activeCompany.icon}</span>
              ) : (
                <Logo className="h-5 w-5 lg:h-6 2xl:h-8" />
              )}
            </div>
            <div className="hidden 2xl:block">
              <span className="font-black text-xl 2xl:text-2xl tracking-tighter block leading-none">
                {activeCompany?.name || "La 30"}
              </span>
              <span className="text-[9px] text-primary uppercase font-black tracking-[0.2em] mt-1 block">
                {isAdministracion ? "Administración" : `${activeCompany?.name || 'La 30'} POS`}
              </span>
            </div>
            <div className="hidden xl:block 2xl:hidden">
              <span className="font-black text-lg tracking-tighter block leading-none">
                {activeCompany?.name || "La 30"}
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-accent/60 mx-1 hidden lg:block" />

          {isAdministracion ? (
            <div
              onClick={() => navigate("/select-store")}
              className="group relative flex items-center gap-3 rounded-2xl border px-3.5 py-1.5 transition-all duration-200 shadow-2xs min-w-0 border-teal-500/40 bg-gradient-to-r from-teal-50/90 via-teal-50/50 to-white hover:border-teal-500 hover:shadow-xs cursor-pointer select-none"
              title="Clic para cambiar a un punto de venta"
            >
              <div className="size-8 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-800 flex items-center justify-center text-sm shrink-0 font-bold group-hover:scale-105 transition-transform shadow-xs">
                <Settings className="size-4 animate-spin-slow text-teal-700" />
              </div>
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
                  <p className="truncate text-xs font-black text-teal-950 leading-tight tracking-tight uppercase">
                    Administración
                  </p>
                </div>
                <p className="truncate text-[9px] text-teal-700/80 font-semibold leading-none mt-0.5">
                  Gestión Global & Control
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-teal-200/80 text-[10px] font-bold text-teal-700 group-hover:text-teal-900 group-hover:translate-x-0.5 transition-all shrink-0">
                <span>Cambiar</span>
                <ArrowLeftRight className="size-2.5" />
              </div>
            </div>
          ) : activeStore && (
            <div
              onClick={() => canSwitchStore && navigate("/select-store")}
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl border px-3.5 py-1.5 transition-all duration-200 shadow-xs min-w-0 select-none",
                canSwitchStore ? "cursor-pointer hover:shadow-sm" : ""
              )}
              style={{
                background: `linear-gradient(135deg, ${currentTheme.accent}14 0%, ${currentTheme.accent}06 50%, #ffffff 100%)`,
                borderColor: `${currentTheme.accent}45`,
              }}
              title={canSwitchStore ? "Clic para cambiar de sede / punto de venta" : undefined}
            >
              {/* Left: Store Icon in dedicated themed badge */}
              <div
                className="size-8 rounded-xl border flex items-center justify-center text-base shrink-0 font-bold group-hover:scale-105 transition-transform shadow-xs"
                style={{
                  background: `linear-gradient(135deg, ${currentTheme.accent}18, ${currentTheme.accent}30)`,
                  borderColor: `${currentTheme.accent}40`,
                }}
              >
                {activeStore.icon ? (
                  <span>{activeStore.icon}</span>
                ) : (
                  <StoreIcon className="size-4" style={{ color: currentTheme.accent }} />
                )}
              </div>

              {/* Center: Store Name & Tag with Live Beacon */}
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex size-2">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: currentTheme.accent }}
                    />
                    <span
                      className="relative inline-flex rounded-full size-2"
                      style={{ backgroundColor: currentTheme.accent }}
                    />
                  </span>
                  <p className="truncate text-xs font-black text-slate-900 leading-tight tracking-tight uppercase">
                    {activeStore.name}
                  </p>
                </div>
                <p className="truncate text-[10px] text-slate-500 font-semibold leading-none mt-0.5">
                  {currentTheme.tag || "Punto de Venta"}
                </p>
              </div>

              {/* Right: Pill Switcher */}
              {canSwitchStore && (
                <div
                  className="hidden sm:flex items-center gap-1.5 pl-2.5 border-l text-[10px] font-bold group-hover:translate-x-0.5 transition-all shrink-0"
                  style={{
                    borderColor: `${currentTheme.accent}25`,
                    color: currentTheme.accent,
                  }}
                >
                  <span>Cambiar</span>
                  <ArrowLeftRight className="size-2.5" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex flex-1 items-center justify-center px-4 min-w-0">
          {isAdministracion ? (
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-100/90 border border-slate-200/80 text-xs text-slate-700 shadow-2xs">
              <span className="size-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="font-black uppercase tracking-wider text-[11px] text-slate-800">
                Centro de Control Administrativo
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-[10px] font-semibold text-slate-500">
                Gestión Global & Parámetros
              </span>
            </div>
          ) : (
            <nav className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-2xs overflow-x-auto no-scrollbar max-w-full">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-2 px-3 xl:px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-all whitespace-nowrap group shrink-0 active:scale-98"
                  activeClassName="bg-white text-slate-900 shadow-xs border border-slate-200/80 font-black"
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          "size-4 transition-transform duration-200 shrink-0",
                          isActive
                            ? "text-teal-600 scale-110"
                            : "text-slate-400 group-hover:text-slate-600",
                        )}
                      />
                      <span className="tracking-tight">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        {/* User & Actions */}
        <div className="flex items-center gap-1.5 lg:gap-2 2xl:gap-4">
          <NotificationBell ecosystem={ecosystem} />

          <div className="h-8 w-px bg-accent/60 mx-1 hidden lg:block" />

          <div className="text-right hidden xl:block">
            <p className="text-[10px] 2xl:text-xs font-black uppercase tracking-widest leading-none mb-1">
              {user?.name}
            </p>
            <div className="flex items-center justify-end gap-1.5">
              {hasOtherSessions && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/20">
                  <span className="size-1 rounded-full bg-amber-500 animate-pulse" />
                  2+ sesiones
                </span>
              )}
              <p className="text-[8px] 2xl:text-[10px] font-bold text-muted-foreground/60 bg-accent px-1.5 py-0.5 rounded-md inline-block">
                {user?.role?.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center bg-accent/30 p-1 lg:p-1 rounded-xl 2xl:rounded-[1.25rem] border-2 border-accent/20">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl h-9 w-9 lg:h-10 lg:w-10 hover:bg-white hover:shadow-soft transition-all text-muted-foreground hover:text-primary"
              onClick={() => setShowResetDialog(true)}
              title="Reparar conexión"
            >
              <Wrench className="h-4 w-4" />
            </Button>
            {hasOtherSessions ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative rounded-xl h-9 w-9 lg:h-10 lg:w-10 hover:bg-white hover:shadow-soft text-amber-700 hover:text-amber-800 transition-all cursor-pointer"
                    title="Múltiples sesiones abiertas. Clic para ver opciones"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="absolute top-2 right-2 flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-amber-500 ring-1 ring-white" />
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-2xl border border-slate-200/90 shadow-xl p-2 bg-white/95 backdrop-blur-md"
                >
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                      <span className="relative flex size-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-2 bg-amber-500" />
                      </span>
                      <span>Múltiples Sesiones</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-snug">
                      Tu cuenta está activa en otro dispositivo. Puedes cerrar las otras sesiones por seguridad.
                    </p>
                  </div>

                  <DropdownMenuItem
                    onClick={logout}
                    className="rounded-xl font-bold py-2.5 px-3 text-xs focus:bg-slate-100 text-slate-700 cursor-pointer mb-1"
                  >
                    Cerrar solo esta sesión
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={logoutAll}
                    className="rounded-xl font-black py-2.5 px-3 text-xs bg-red-50 text-red-700 focus:bg-red-100 focus:text-red-800 cursor-pointer flex items-center justify-between"
                  >
                    <span>Cerrar en todos los equipos</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-200 text-red-800 font-black">
                      Seguro
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-9 w-9 lg:h-10 lg:w-10 hover:bg-white hover:shadow-soft text-muted-foreground hover:text-destructive transition-all"
                onClick={logout}
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
            {canSwitchCompany && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-9 w-9 lg:h-10 lg:w-10 hover:bg-white hover:shadow-soft transition-all text-muted-foreground hover:text-teal-600"
                onClick={() => navigate("/select-company")}
                title="Cambiar empresa"
              >
                <Building2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile iPhone Instagram Style Liquid Glass Floating Dock */}
      {!isAdministracion && (
        <nav
          aria-label="Barra de navegación móvil"
          className="lg:hidden fixed left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full max-w-md mx-auto z-40 rounded-full bg-gradient-to-b from-white/65 via-white/40 to-white/20 backdrop-blur-3xl backdrop-saturate-[200%] backdrop-contrast-[105%] border border-white/60 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.14),0_0_0_1px_rgba(255,255,255,0.4),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.03)] px-2 py-1.5 transition-all duration-300 before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent"
          style={{
            bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex items-center justify-around relative z-10">
            {primaryMobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-full transition-all duration-300 text-slate-500 active:scale-90 select-none min-h-[46px] group"
                activeClassName="text-slate-950 font-black"
              >
                {({ isActive }) => (
                  <>
                    {/* Liquid droplet lens on active tab */}
                    {isActive && (
                      <div className="absolute inset-0.5 rounded-full bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200" />
                    )}

                    <div className="relative z-10 flex items-center justify-center">
                      <item.icon
                        className={cn(
                          "size-5 transition-transform duration-200",
                          isActive
                            ? "text-slate-950 scale-110 stroke-[2.25]"
                            : "text-slate-500 stroke-[1.75] group-hover:text-slate-800"
                        )}
                      />
                      {isActive && (
                        <div className="absolute -bottom-1 size-1 rounded-full bg-teal-600 shadow-[0_0_6px_rgba(13,148,136,0.9)]" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "relative z-10 text-[10px] tracking-tight mt-1 transition-colors leading-none",
                        isActive ? "font-black text-slate-950" : "font-semibold text-slate-500 group-hover:text-slate-700"
                      )}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}

            {hasMoreItems && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Más opciones"
                    className={cn(
                      "relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-full transition-all duration-300 text-slate-500 active:scale-90 cursor-pointer select-none min-h-[46px] group",
                      isMoreActive ? "text-slate-950" : "text-slate-500"
                    )}
                  >
                    {/* Liquid droplet lens on active more button */}
                    {isMoreActive && (
                      <div className="absolute inset-0.5 rounded-full bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/90 backdrop-blur-md" />
                    )}

                    <div className="relative z-10 flex items-center justify-center">
                      <MoreHorizontal
                        className={cn(
                          "size-5 transition-transform duration-200",
                          isMoreActive
                            ? "text-slate-950 scale-110 stroke-[2.25]"
                            : "text-slate-500 stroke-[1.75] group-hover:text-slate-800"
                        )}
                      />
                      {isMoreActive && (
                        <div className="absolute -bottom-1 size-1 rounded-full bg-teal-600 shadow-[0_0_6px_rgba(13,148,136,0.9)]" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "relative z-10 text-[10px] tracking-tight mt-1 transition-colors leading-none",
                        isMoreActive ? "font-black text-slate-950" : "font-semibold text-slate-500 group-hover:text-slate-700"
                      )}
                    >
                      Más
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="top"
                  className="w-56 rounded-3xl p-2.5 border border-white/70 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.18),inset_0_2px_4px_rgba(255,255,255,0.8)] bg-gradient-to-b from-white/85 via-white/70 to-white/50 backdrop-blur-3xl backdrop-saturate-[200%] mb-3.5"
                >
                  {secondaryMobileNav.map((item) => (
                    <DropdownMenuItem
                      key={item.to}
                      onClick={() => navigate(item.to)}
                      className={cn(
                        "flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl font-bold text-xs cursor-pointer transition-colors",
                        location.pathname === item.to
                          ? "bg-teal-500/20 text-teal-950 font-black shadow-2xs"
                          : "text-slate-800 hover:bg-white/60"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 text-slate-600" />
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1 relative pb-6 lg:pb-0">
        {/* Subtle Background Pattern */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/3 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {/* Repair Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="rounded-[2.5rem] border-4 p-10 max-w-lg">
          <AlertDialogHeader className="space-y-4">
            <div className="h-20 w-20 rounded-4xl bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Wrench className="h-10 w-10" />
            </div>
            <AlertDialogTitle className="text-3xl font-black tracking-tight">
              ¿Reparar conexión?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
              Esta acción cerrará tu sesión actual, borrará los datos de caché
              del navegador y recargará la aplicación por completo.
              <br />
              <br />
              Úsala solo si experimentas problemas persistentes con el inicio de
              sesión o la carga de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-4">
            <AlertDialogCancel className="h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] border-2">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={forceReset}
              className="h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-primary text-white hover:bg-primary/90 shadow-strong shadow-primary/20"
            >
              Confirmar Reparación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
