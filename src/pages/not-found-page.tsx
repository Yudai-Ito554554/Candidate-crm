import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <SearchX aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-950">
          ページが見つかりません
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          URLが変更されたか、この画面へアクセスできない可能性があります。
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            className="gap-2"
            onClick={() => void navigate(-1)}
            type="button"
            variant="outline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            前の画面へ戻る
          </Button>
          <Button asChild className="gap-2">
            <Link to="/">
              <Home aria-hidden="true" className="size-4" />
              ホームへ戻る
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
