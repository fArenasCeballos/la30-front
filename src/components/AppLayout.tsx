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
  Settings,
  UtensilsCrossed,
  ChevronDown,
  Check,
  ExternalLink,
} from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { NavLink } from "@/components/NavLink";
import type { UserRole, Store as StoreType } from "@/types";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { Logo } from "./ui/logo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
    to: "/administracion",
    label: "Administración",
    icon: Settings,
    roles: ["admin"],
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
    stores,
    setActiveStore,
    loading: storeLoading,
  } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const ecosystem = location.pathname.startsWith("/kiosko")
    ? "kiosk"
    : "restaurant";
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);
  const [hasOtherSessions, setHasOtherSessions] = useState(false);

  const currentTheme = getStoreTheme(activeStore);

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

  if (loading) {
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans selection:bg-primary selection:text-white pb-24 lg:pb-0">
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

      {/* Cross-session reset warning banner */}
      <AnimatePresence>
        {hasOtherSessions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-purple-900 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-4 shadow-lg relative z-50 border-b border-purple-700"
          >
            <div className="flex items-center gap-2 mx-auto">
              <span className="text-base">🔐</span>
              <span>
                Hay múltiples sesiones abiertas. Puedes cerrar todas las demás
                sesiones desde el botón de cerrar sesión.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Glass Header */}
      <header className="relative h-14 lg:h-16 2xl:h-20 border-b bg-white/95 backdrop-blur-md flex items-center px-4 lg:px-6 2xl:px-10 gap-2 lg:gap-4 2xl:gap-8 sticky top-0 z-50 transition-all duration-300">
        {/* Dynamic Top Ambient Indicator Line with Glow */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5 transition-all duration-500"
          style={{
            backgroundColor: currentTheme.accent,
            boxShadow: `0 2px 12px ${currentTheme.accent}80`,
          }}
        />

        {/* Brand & Store Selector */}
        <div className="flex items-center gap-2 lg:gap-4 2xl:gap-6 flex-1 lg:flex-none">
          <div
            className="flex items-center gap-2 lg:gap-3 group cursor-pointer shrink-0"
            onClick={() => {
              if (user?.role === "admin") navigate("/dashboard");
              else if (user?.role === "caja") navigate("/caja");
              else if (user?.role === "cocina") navigate("/cocina");
              else if (user?.role === "mesero") navigate("/kiosko");
              else navigate("/");
            }}
          >
            <div className="w-9 h-9 lg:w-10 2xl:w-12 lg:h-10 2xl:h-12 rounded-xl lg:rounded-2xl 2xl:rounded-3xl bg-white border-2 shadow-soft flex items-center justify-center overflow-hidden group-hover:scale-105 group-hover:rotate-3 transition-all duration-200">
              <Logo className="h-5 w-5 lg:h-6 2xl:h-8" />
            </div>
            <div className="hidden 2xl:block">
              <span className="font-black text-xl 2xl:text-2xl tracking-tighter block leading-none">
                La 30
              </span>
              <span className="text-[9px] text-primary uppercase font-black tracking-[0.2em] mt-1 block">
                Plataforma POS
              </span>
            </div>
            <div className="hidden xl:block 2xl:hidden">
              <span className="font-black text-lg tracking-tighter block leading-none">
                La 30
              </span>
            </div>
          </div>

          {activeStore && (
            <div className="h-8 w-px bg-accent/60 mx-1 hidden lg:block" />
          )}

          {activeStore &&
            (canSwitchStore ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "group relative flex items-center gap-2 lg:gap-3 px-3 lg:px-4 2xl:px-5 py-1.5 lg:py-2 rounded-2xl transition-all duration-300 border-2 hover:scale-[1.03] active:scale-[0.98] cursor-pointer min-w-0 shadow-sm",
                      currentTheme.bg,
                      currentTheme.border,
                      currentTheme.glow,
                    )}
                    title="Clic para cambiar de punto de venta"
                  >
                    {/* Store Icon Badge with 3D gradient & glow */}
                    <div
                      className={cn(
                        "w-8 h-8 lg:w-9 lg:h-9 2xl:w-10 2xl:h-10 rounded-xl flex items-center justify-center text-base lg:text-lg shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
                        currentTheme.badge,
                      )}
                    >
                      <span>
                        {activeStore.icon || currentTheme.defaultIcon}
                      </span>
                    </div>

                    <div className="text-left flex flex-col justify-center min-w-0 pr-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[7.5px] lg:text-[8.5px] 2xl:text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/80 leading-none">
                          SEDE ACTIVA
                        </span>
                        <span className="relative flex h-2 w-2">
                          <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                            style={{ backgroundColor: currentTheme.accent }}
                          />
                          <span
                            className="relative inline-flex rounded-full h-2 w-2 shadow-xs"
                            style={{ backgroundColor: currentTheme.accent }}
                          />
                        </span>
                      </div>
                      <span
                        className={cn(
                          "font-black text-xs lg:text-sm 2xl:text-base tracking-tight leading-tight uppercase truncate max-w-32 sm:max-w-44 lg:max-w-none",
                          currentTheme.text,
                        )}
                      >
                        {activeStore.name}
                      </span>
                    </div>

                    <div className="h-5 w-px bg-current/20 mx-1 hidden sm:block" />

                    <div className="flex items-center gap-1">
                      <span className="hidden sm:inline-block text-[8px] lg:text-[9px] font-black uppercase tracking-wider bg-white/80 dark:bg-black/20 border border-current/20 px-1.5 py-0.5 rounded-md opacity-80 group-hover:opacity-100 transition-opacity shadow-xs">
                        Cambiar
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 opacity-70 group-hover:opacity-100",
                          currentTheme.text,
                        )}
                      />
                    </div>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="start"
                  className="w-72 sm:w-80 p-2 rounded-2xl border-2 shadow-2xl bg-white/95 backdrop-blur-xl animate-in fade-in-80 zoom-in-95 duration-200 z-50"
                >
                  <div className="px-3 py-2 border-b border-accent/20 mb-1.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      Puntos de Venta
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      Selecciona la tienda para operar
                    </p>
                  </div>

                  <div className="space-y-1">
                    {stores.map((s) => {
                      const isSelected = s.id === activeStore.id;
                      const sTheme = getStoreTheme(s);
                      return (
                        <DropdownMenuItem
                          key={s.id}
                          onClick={() => {
                            if (!isSelected) {
                              setActiveStore(s);
                              toast.success(`Cambiado a: ${s.name}`);
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border-2",
                            isSelected
                              ? `${sTheme.bg} ${sTheme.border} ${sTheme.text} font-black shadow-xs`
                              : "hover:bg-accent/40 border-transparent text-foreground font-bold",
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-xs shrink-0",
                                isSelected ? sTheme.badge : "bg-accent/40",
                              )}
                            >
                              <span>{s.icon || sTheme.defaultIcon}</span>
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-black tracking-tight uppercase leading-tight truncate">
                                {s.name}
                              </p>
                              <p className="text-[10px] font-bold text-muted-foreground leading-none mt-0.5">
                                {sTheme.tag || "Punto de venta"}
                              </p>
                            </div>
                          </div>

                          {isSelected ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black uppercase tracking-wider bg-white/90 px-2 py-0.5 rounded-md shadow-xs">
                                Activo
                              </span>
                              <Check
                                className="h-4 w-4 text-current shrink-0"
                                strokeWidth={3}
                              />
                            </div>
                          ) : (
                            <span className="text-[10px] font-black text-muted-foreground/60 hover:text-primary">
                              Cambiar
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>

                  <DropdownMenuSeparator className="my-2 bg-accent/20" />

                  <DropdownMenuItem
                    onClick={() => navigate("/select-store")}
                    className="flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-black text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir selector en pantalla completa</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* Static Badge for single-store users */
              <div
                className={cn(
                  "flex items-center gap-2.5 lg:gap-3 px-3 lg:px-4 2xl:px-5 py-1.5 lg:py-2 rounded-2xl border-2 shadow-sm min-w-0",
                  currentTheme.bg,
                  currentTheme.border,
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 lg:w-9 lg:h-9 2xl:w-10 2xl:h-10 rounded-xl flex items-center justify-center text-base lg:text-lg shrink-0",
                    currentTheme.badge,
                  )}
                >
                  <span>{activeStore.icon || currentTheme.defaultIcon}</span>
                </div>
                <div className="text-left flex flex-col justify-center min-w-0 pr-0.5">
                  <span className="text-[7.5px] lg:text-[8.5px] 2xl:text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/80 leading-none">
                    SEDE ACTIVA
                  </span>
                  <span
                    className={cn(
                      "font-black text-xs lg:text-sm 2xl:text-base tracking-tight leading-tight uppercase truncate",
                      currentTheme.text,
                    )}
                  >
                    {activeStore.name}
                  </span>
                </div>
              </div>
            ))}
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex flex-1 items-center justify-center px-4 min-w-0">
          <div className="flex items-center gap-1 xl:gap-2 2xl:gap-4 overflow-x-auto overflow-y-hidden premium-scrollbar scroll-smooth py-2">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-1.5 xl:gap-2 px-3 xl:px-4 2xl:px-6 py-2 rounded-xl xl:rounded-2xl text-[10px] xl:text-xs 2xl:text-sm font-black text-muted-foreground hover:bg-accent/50 hover:text-primary transition-all whitespace-nowrap group relative"
                activeClassName="bg-primary/5 text-primary shadow-inner"
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        "h-3.5 w-3.5 xl:h-4 xl:w-4 transition-all duration-200",
                        isActive
                          ? "scale-110 rotate-3"
                          : "group-hover:scale-110",
                      )}
                    />
                    <span className="hidden lg:inline uppercase tracking-[0.15em] text-[9px] xl:text-[10px] 2xl:text-[11px]">
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)] animate-in zoom-in duration-200" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User & Actions */}
        <div className="flex items-center gap-1.5 lg:gap-2 2xl:gap-4">
          <NotificationBell ecosystem={ecosystem} />

          <div className="h-8 w-px bg-accent/60 mx-1 hidden lg:block" />

          <div className="text-right hidden xl:block">
            <p className="text-[10px] 2xl:text-xs font-black uppercase tracking-widest leading-none mb-1">
              {user?.name}
            </p>
            <p className="text-[8px] 2xl:text-[10px] font-bold text-muted-foreground/60 bg-accent px-1.5 py-0.5 rounded-md inline-block">
              {user?.role?.toUpperCase()}
            </p>
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
                    className="rounded-xl h-9 w-9 lg:h-10 lg:w-10 hover:bg-white hover:shadow-soft text-muted-foreground hover:text-destructive transition-all"
                    title="Opciones de sesión"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-2xl border-none shadow-strong p-2"
                >
                  <DropdownMenuItem
                    onClick={logout}
                    className="rounded-xl font-bold py-3 focus:bg-red-50 focus:text-red-700 cursor-pointer mb-1"
                  >
                    Cerrar sesión actual
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={logoutAll}
                    className="rounded-xl font-bold py-3 focus:bg-red-50 focus:text-red-700 cursor-pointer"
                  >
                    Cerrar de todos los dispositivos
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
          </div>
        </div>
      </header>

      {/* Mobile Top Sub-Navbar (Always visible on mobile right below header) */}
      <div className="lg:hidden border-b bg-white/95 backdrop-blur-md sticky top-14 z-40 px-3 py-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 min-w-max">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black text-muted-foreground hover:bg-accent/50 hover:text-primary transition-all whitespace-nowrap border-2 border-transparent"
              activeClassName="bg-primary text-white border-primary shadow-xs"
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      isActive ? "text-white scale-110" : "text-muted-foreground",
                    )}
                  />
                  <span className="uppercase tracking-wider">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

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
