import { LoaderCircle } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/contexts/use-auth";

export function AuthGate() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isConfigured) return <AppLayout />;

  if (auth.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <LoaderCircle className="size-4 animate-spin" />
          セッションを確認しています
        </div>
      </main>
    );
  }

  if (!auth.session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <AppLayout />;
}
