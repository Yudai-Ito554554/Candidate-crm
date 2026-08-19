import { Navigate, Outlet, useLocation } from "react-router-dom";

import { AuthLoadingScreen } from "@/features/auth/auth-loading-screen";
import { ConfigurationErrorPage } from "@/features/auth/configuration-error-page";
import { toLoginRedirectState } from "@/features/auth/login-redirect";
import { useAuth } from "@/features/auth/use-auth";
import { environment } from "@/lib/env";

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (!environment.success) return <ConfigurationErrorPage />;
  if (auth.status === "loading")
    return (
      <AuthLoadingScreen environmentName={environment.data.VITE_APP_ENV} />
    );
  if (!auth.session)
    return (
      <Navigate replace state={toLoginRedirectState(location)} to="/login" />
    );

  return <Outlet />;
}
