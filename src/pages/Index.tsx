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
  const { activeStore, loading: storeLoading } = useStore();

  if (loading || storeLoading) {
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

  // Admin or Bodega without an active store → send to store selector
  if ((user?.role === "admin" || user?.role === "bodega") && !activeStore) {
    return <Navigate to="/select-store" replace />;
  }

  // If active store is Domicilios, go directly to the delivery module
  if (user?.role === "admin" && activeStore?.slug === "domicilios") {
    return <Navigate to="/domicilios" replace />;
  }

  const target = user ? ROLE_ROUTES[user.role] || "/caja" : "/login";
  
  // Extra safety: If we are going to dashboard but have no store (as admin), don't
  if (target === "/dashboard" && !activeStore && user?.role === "admin") {
    return <Navigate to="/select-store" replace />;
  }

  return <Navigate to={target} replace />;
}
