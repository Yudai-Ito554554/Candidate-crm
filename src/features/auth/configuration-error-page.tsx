import { AlertTriangle } from "lucide-react";

import { environment } from "@/lib/env";

export function ConfigurationErrorPage() {
  const messages = environment.success
    ? ["環境設定を確認できませんでした。"]
    : environment.messages;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-lg border border-rose-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-rose-50 p-2 text-rose-700">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-950">
              Supabaseの設定が必要です
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              `.env`に以下の環境変数を設定し、アプリを再起動してください。
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-1 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
          {messages.map((message) => (
            <li key={message}>・{message}</li>
          ))}
        </ul>
        <div className="mt-4 rounded-md border border-slate-200 p-3 font-mono text-xs text-slate-700">
          <p>VITE_SUPABASE_URL=</p>
          <p>VITE_SUPABASE_PUBLISHABLE_KEY=</p>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Publishable
          keyのみを使用してください。service_roleキーは設定しないでください。
        </p>
      </section>
    </main>
  );
}
