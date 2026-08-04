import { CheckCircle2, Database, LogOut, ShieldCheck } from "lucide-react";

import { PageIntro } from "@/components/common/page-intro";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/use-auth";
import { supabaseConfigurationIssue } from "@/lib/supabase/env";

export function SettingsPage() {
  const auth = useAuth();

  return (
    <div>
      <PageIntro
        description="接続状態、アカウント、チーム設定を確認します。"
        title="設定"
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          description="環境変数から読み込んだ接続状態です"
          title="Supabase接続"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-slate-100 p-2">
              <Database className="size-5 text-slate-600" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {auth.isConfigured ? "接続設定済み" : "仮データモード"}
                <span
                  className={
                    auth.isConfigured
                      ? "rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                      : "rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
                  }
                >
                  {auth.isConfigured ? "Supabase" : "Mock"}
                </span>
              </p>
              <p className="mt-2 max-w-xl text-xs leading-5 text-slate-600">
                {auth.isConfigured
                  ? "認証セッションを利用しています。データ取得は組織単位のRLSで保護されます。"
                  : "VITE_SUPABASE_URLとVITE_SUPABASE_PUBLISHABLE_KEYを設定すると、認証モードへ切り替わります。"}
              </p>
              {supabaseConfigurationIssue ? (
                <p className="mt-2 text-xs font-medium text-rose-700">
                  {supabaseConfigurationIssue}
                </p>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard description="現在の認証セッション" title="アカウント">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {auth.user?.email ?? "伊東 勇大（仮ユーザー）"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {auth.user
                  ? "Supabase Authで認証済み"
                  : "仮データ確認用のローカル表示"}
              </p>
            </div>
            {auth.user ? (
              <Button
                className="gap-2"
                onClick={() => void auth.signOut()}
                size="sm"
                variant="outline"
              >
                <LogOut className="size-4" />
                ログアウト
              </Button>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          description="Phase 3で採用したセキュリティ境界"
          title="データ保護"
        >
          <ul className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              全業務テーブルでRLSを有効化
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              組織メンバーのみデータへアクセス
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              service_roleキーをクライアントへ配置しない
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
