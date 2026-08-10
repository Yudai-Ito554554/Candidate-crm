import { Navigate, Outlet } from "react-router-dom";

import { AuthLoadingScreen } from "@/features/auth/auth-loading-screen";
import { ConfigurationErrorPage } from "@/features/auth/configuration-error-page";
import { useAuth } from "@/features/auth/use-auth";
import { environment } from "@/lib/env";

export function ProtectedRoute() {
  const auth = useAuth();

  if (!environment.success) return <ConfigurationErrorPage />;
  if (auth.status === "loading")
    return (
      <AuthLoadingScreen environmentName={environment.data.VITE_APP_ENV} />
    );
  if (!auth.session) return <Navigate replace to="/login" />;

  return <Outlet />;
}
