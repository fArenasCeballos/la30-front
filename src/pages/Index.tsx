import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { Navigate } from "react-router-dom";

const ROLE_ROUTES: Record<string, string> = {
  admin: "/dashboard",
  caja: "/caja",
  mesero: "/kiosko",
  cocina: "/cocina",
  bodega: "/bodega",
};

export default function Index() {
  const { user, isAuthenticated, loading } = useAuth();
  const { activeStore, canSwitchStore, loading: storeLoading } = useStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
            Sincronizando
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
            Cargando sedes
          </span>
        </div>
      </div>
    );
  }

  // User without an active store who can switch stores → send to store selector
  if (canSwitchStore && !activeStore) {
    return <Navigate to="/select-store" replace />;
  }

  // If active store is Domicilios, go directly to the delivery module for admin/caja
  if ((user?.role === "admin" || user?.role === "caja") && activeStore?.slug === "domicilios") {
    return <Navigate to="/domicilios" replace />;
  }

  const target = user ? ROLE_ROUTES[user.role] || "/caja" : "/login";

  return <Navigate to={target} replace />;
}
