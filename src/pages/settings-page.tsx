import { Settings } from "lucide-react";

import { PageIntro } from "@/components/common/page-intro";

export function SettingsPage() {
  return (
    <div>
      <PageIntro
        description="アプリケーションとチームの設定を管理します。"
        title="設定"
      />
      <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <Settings className="size-8 text-slate-400" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          設定画面は次のPhaseで実装予定です
        </p>
        <p className="mt-1 text-xs text-slate-500">
          ユーザー、通知、外部連携などを追加します。
        </p>
      </div>
    </div>
  );
}
