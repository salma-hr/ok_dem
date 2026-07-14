import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * DashboardRouter — Redirige vers le dashboard approprié selon le rôle de l'utilisateur
 */
export default function DashboardRouter() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const role = user?.role || "";

  // Redirection selon le rôle
  if (role === "CHEF_LIGNE") return <Navigate to="/dashboard/chef-ligne" replace />;
  if (role === "TECHNICIEN") return <Navigate to="/dashboard/technicien" replace />;
  if (role === "AGENT_QUALITE") return <Navigate to="/dashboard/agent-qualite" replace />;
  if (role === "PPO") return <Navigate to="/dashboard-advanced" replace />;
  if (role === "ADMIN") return <Navigate to="/dashboard-advanced" replace />;
  if (role === "ADMIN_PLANT") return <Navigate to="/dashboard-advanced" replace />;
  if (role === "OPERATEUR") return <Navigate to="/checklist/operateur" replace />;

  // Fallback vers dashboard-advanced
  return <Navigate to="/dashboard-advanced" replace />;
}
