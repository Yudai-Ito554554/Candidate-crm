import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section
          aria-labelledby="fatal-error-title"
          className="w-full max-w-lg rounded-lg border border-rose-200 bg-white p-6 shadow-sm"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <span className="rounded-md bg-rose-50 p-2 text-rose-700">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h1
                className="text-lg font-semibold text-slate-950"
                id="fatal-error-title"
              >
                アプリを表示できませんでした
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                入力内容は送信されていません。アプリを再読み込みして、もう一度お試しください。
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              className="gap-2"
              onClick={() => window.location.assign("/")}
              type="button"
              variant="outline"
            >
              <Home aria-hidden="true" className="size-4" />
              ホームへ戻る
            </Button>
            <Button
              className="gap-2"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              再読み込み
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
