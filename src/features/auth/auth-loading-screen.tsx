import { LoaderCircle } from "lucide-react";

export function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-slate-600"
      >
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ログイン状態を確認しています
      </div>
    </main>
  );
}
