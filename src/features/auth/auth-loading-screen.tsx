import { LoaderCircle } from "lucide-react";

import { EnvironmentBadge } from "@/components/common/environment-badge";
import type { AppEnvironment } from "@/lib/env";

export function AuthLoadingScreen({
  environmentName,
}: {
  environmentName: AppEnvironment["VITE_APP_ENV"];
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-2">
        <EnvironmentBadge environmentName={environmentName} />
        <div
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-slate-600"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ログイン状態を確認しています
        </div>
      </div>
    </main>
  );
}
