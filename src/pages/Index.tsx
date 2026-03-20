import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const ROLE_ROUTES: Record<string, string> = {
  admin: "/dashboard",
  caja: "/caja",
  mesero: "/kiosko",
  cocina: "/cocina",
};

export default function Index() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const target = user ? ROLE_ROUTES[user.role] || "/caja" : "/login";
  return <Navigate to={target} replace />;
}
