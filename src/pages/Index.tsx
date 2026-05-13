import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { Navigate } from "react-router-dom";

const ROLE_ROUTES: Record<string, string> = {
  admin: "/dashboard",
  caja: "/caja",
  mesero: "/kiosko",
  cocina: "/cocina",
};

export default function Index() {
  const { user, isAuthenticated, loading } = useAuth();
  const { activeStore, loading: storeLoading } = useStore();

  if (loading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Cargando...</span>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Admin without an active store → send to store selector
  if (user?.role === "admin" && !activeStore) {
    return <Navigate to="/select-store" replace />;
  }

  const target = user ? ROLE_ROUTES[user.role] || "/caja" : "/login";
  return <Navigate to={target} replace />;
}
