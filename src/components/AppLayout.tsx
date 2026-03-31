import { useAuth } from "@/context/AuthContext";
import { Navigate, Outlet } from "react-router-dom";
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
} from "lucide-react";
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
import { useState } from "react";
import { Logo } from "./ui/logo";
// TODO: Eliminar
import { BirthdayModal } from "./BirthdayModal";

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
];

export function AppLayout() {
  const { user, logout, forceReset, isAuthenticated, loading } = useAuth();
  const [showResetDialog, setShowResetDialog] = useState(false);

  if (loading) {
    // Mientras Supabase verifica la sesión, no redirige
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Cargando...</span>
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
    <div className="min-h-screen flex flex-col">
// TODO: Eliminar
      <BirthdayModal />
      <header className="h-16 border-b bg-card flex items-center px-4 gap-3 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-card border shadow-sm flex items-center justify-center overflow-hidden">
            <Logo className="h-7 w-7" />
          </div>
          <span className="font-display font-bold text-lg hidden sm:block">
            La 30
          </span>
        </div>

        <nav className="flex gap-0.5 ml-3 overflow-x-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors touch-target whitespace-nowrap"
              activeClassName="bg-accent text-accent-foreground"
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden md:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <span className="text-sm text-muted-foreground hidden lg:block">
            {user?.name}{" "}
            <span className="uppercase text-xs font-semibold text-primary">
              ({user?.role})
            </span>
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowResetDialog(true)}
            title="Reparar conexión"
          >
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reparar conexión?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cerrará tu sesión actual, borrará los datos de caché del navegador y recargará la aplicación. 
              <br /><br />
              Úsala solo si experimentas problemas persistentes con el inicio de sesión o la carga de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={forceReset}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirmar Reparación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
