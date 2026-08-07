import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function RouteErrorPage() {
  const routeError = useRouteError();
  const notFound =
    isRouteErrorResponse(routeError) && routeError.status === 404;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section
        aria-labelledby="route-error-title"
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
              id="route-error-title"
            >
              {notFound
                ? "ページが見つかりません"
                : "画面を読み込めませんでした"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {notFound
                ? "URLを確認するか、ホーム画面から目的の情報を開いてください。"
                : "通信状態を確認して再読み込みしてください。繰り返し発生する場合は管理者へ連絡してください。"}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button asChild className="gap-2" variant="outline">
            <Link to="/">
              <Home aria-hidden="true" className="size-4" />
              ホームへ戻る
            </Link>
          </Button>
          {!notFound ? (
            <Button
              className="gap-2"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              再読み込み
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
