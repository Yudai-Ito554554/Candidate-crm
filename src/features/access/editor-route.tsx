import { LoaderCircle, ShieldAlert } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAccess } from "@/features/access/use-access";

export function EditorRoute() {
  const access = useAccess();

  if (access.isPending)
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        権限を確認しています…
      </div>
    );

  if (!access.canWrite)
    return (
      <section
        className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-6 text-center"
        role="alert"
      >
        <ShieldAlert aria-hidden="true" className="size-7 text-amber-700" />
        <h2 className="mt-3 text-base font-semibold text-amber-950">
          閲覧専用アカウントです
        </h2>
        <p className="mt-1 max-w-lg text-sm text-amber-800">
          新規登録・編集・アーカイブはエージェントまたは管理者へ依頼してください。
        </p>
        <Button asChild className="mt-4" size="sm" variant="outline">
          <Link to="/">ホームへ戻る</Link>
        </Button>
      </section>
    );

  return <Outlet />;
}
