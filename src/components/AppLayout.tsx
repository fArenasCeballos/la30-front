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
  FileText,
  Package,
  Users,
  Wrench,
  ClipboardList,
  Store,
} from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { NavLink } from "@/components/NavLink";
import type { UserRole } from "@/types";
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
import { useEffect, useState } from "react";
import { Logo } from "./ui/logo";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
  { to: "/cocina", label: "Cocina", icon: ChefHat, roles: ["cocina", "admin"] },
  { to: "/reporteria", label: "Reportes", icon: FileText, roles: ["admin"] },
  { to: "/inventario", label: "Inventario", icon: Package, roles: ["admin"] },
  { to: "/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] },
  {
    to: "/mis-pedidos",
    label: "Mis Pedidos",
    icon: ClipboardList,
    roles: ["mesero", "caja", "admin"],
  },
];

export function AppLayout() {
  const { user, logout, forceReset, isAuthenticated, loading } = useAuth();
  const { activeStore, isAdmin, loading: storeLoading } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const ecosystem = location.pathname.startsWith("/kiosko") ? "kiosk" : "restaurant";
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Guard: Admin without store should go to selector
  useEffect(() => {
    if (
      !loading &&
      !storeLoading &&
      isAuthenticated &&
      isAdmin &&
      !activeStore
    ) {
      navigate("/select-store", { replace: true });
    }
  }, [loading, storeLoading, isAuthenticated, isAdmin, activeStore, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
          <Logo className="h-16 w-16 relative animate-bounce" />
        </div>
        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">
          Cargando Sistema
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role),
  );

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Premium Glass Header */}
      <header className="h-14 lg:h-16 2xl:h-20 border-b bg-white/90 backdrop-blur-md flex items-center px-4 lg:px-4 2xl:px-10 gap-2 lg:gap-2 2xl:gap-8 sticky top-0 z-50 transition-all duration-300">
        {/* Brand & Store Selector */}
        <div className="flex items-center gap-2 lg:gap-2 2xl:gap-6 flex-1 lg:flex-none">
          <div
            className="flex items-center gap-2 lg:gap-3 group cursor-pointer shrink-0"
            onClick={() => navigate("/dashboard")}
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

          {activeStore && (
            <button
              onClick={() => (isAdmin ? navigate("/select-store") : undefined)}
              className={cn(
                "flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 2xl:px-5 py-1.5 lg:py-2 rounded-xl lg:rounded-2xl text-[10px] lg:text-[11px] 2xl:text-sm font-black transition-all border-2 shadow-soft min-w-0",
                isAdmin
                  ? "bg-white hover:border-primary/30 hover:shadow-medium cursor-pointer"
                  : "cursor-default bg-accent/30 border-transparent",
              )}
              style={{
                color: activeStore.color || undefined,
                borderColor: isAdmin ? undefined : `${activeStore.color}20`,
              }}
            >
              <div className="h-5 w-5 lg:h-6 lg:w-6 rounded-lg bg-current/10 flex items-center justify-center shrink-0">
                <Store className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
              </div>
              <span className="hidden sm:inline uppercase tracking-widest text-[8px] lg:text-[9px] 2xl:text-[11px] truncate">
                {activeStore.name}
              </span>
              <span className="sm:hidden">{activeStore.icon}</span>
              {isAdmin && (
                <Wrench className="h-2.5 w-2.5 opacity-30 ml-0.5 lg:ml-1 shrink-0" />
              )}
            </button>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-0.5 xl:gap-2 px-4 min-w-0 overflow-hidden">
          <div className="flex items-center gap-0.5 xl:gap-1.5 2xl:gap-4 overflow-x-auto no-scrollbar scroll-smooth">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-1.5 xl:gap-2 px-2 xl:px-5 py-1.5 rounded-xl xl:rounded-2xl text-[9px] xl:text-sm font-black text-muted-foreground hover:bg-accent/50 hover:text-primary transition-all whitespace-nowrap group relative"
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
                    <span className="hidden lg:inline uppercase tracking-widest text-[9px] xl:text-[10px]">
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
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl h-9 w-9 lg:h-10 lg:w-10 hover:bg-white hover:shadow-soft text-muted-foreground hover:text-destructive transition-all"
              onClick={logout}
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative pb-24 lg:pb-0">
        {/* Subtle Background Pattern */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/3 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-50 bg-white border border-white/50 shadow-2xl rounded-[2.5rem] p-1.5 flex items-center justify-around overflow-hidden">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 relative group min-w-[40px]"
            activeClassName="text-white"
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    "relative z-10 flex flex-col items-center transition-all duration-200",
                    isActive ? "scale-110" : "",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-all duration-200",
                      isActive
                        ? "text-white"
                        : "text-muted-foreground/40 group-hover:text-primary",
                    )}
                    strokeWidth={isActive ? 3 : 2.5}
                  />
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[7px] font-black uppercase tracking-[0.15em] mt-1 text-white whitespace-nowrap"
                    >
                      {item.label.split(" ")[0]}
                    </motion.span>
                  )}
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary rounded-2xl shadow-lg shadow-primary/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

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
