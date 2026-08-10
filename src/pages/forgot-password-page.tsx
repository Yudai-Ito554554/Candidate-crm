import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate } from "react-router-dom";
import { z } from "zod";

import { EnvironmentBadge } from "@/components/common/environment-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLoadingScreen } from "@/features/auth/auth-loading-screen";
import { ConfigurationErrorPage } from "@/features/auth/configuration-error-page";
import { translateAuthError } from "@/features/auth/auth-errors";
import { useAuth } from "@/features/auth/use-auth";
import { environment } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";

const RECOVERY_REDIRECT_URL = "candidate-crm://auth/callback";
const forgotPasswordSchema = z.object({
  email: z.string().trim().email("有効なメールアドレスを入力してください。"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  if (!environment.success) return <ConfigurationErrorPage />;
  if (auth.status === "loading") return <AuthLoadingScreen />;
  if (auth.session) return <Navigate replace to="/" />;

  const environmentName = environment.data.VITE_APP_ENV;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <KeyRound aria-hidden="true" className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-950">
                パスワードを再設定
              </h1>
              <EnvironmentBadge environmentName={environmentName} />
            </div>
            <p className="text-xs text-slate-500">Candidate CRM</p>
          </div>
        </div>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p
              className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800"
              role="status"
            >
              登録済みのメールアドレスであれば、再設定メールを送信しました。メール内のリンクを開いてください。
            </p>
            <Link
              className="block text-center text-sm font-medium text-blue-700 hover:underline"
              to="/login"
            >
              ログイン画面へ戻る
            </Link>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              void handleSubmit(async ({ email }) => {
                setServerError(null);
                const client = await getSupabaseClient();
                if (!client) {
                  setServerError("Supabaseの接続設定を確認してください。");
                  return;
                }
                try {
                  const { error } = await client.auth.resetPasswordForEmail(
                    email,
                    { redirectTo: RECOVERY_REDIRECT_URL },
                  );
                  if (error) {
                    setServerError(
                      translateAuthError(
                        error.message,
                        "再設定メールを送信できませんでした。時間を置いて再度お試しください。",
                      ),
                    );
                    return;
                  }
                  setSent(true);
                } catch {
                  setServerError(
                    "再設定メールを送信できませんでした。ネットワーク接続を確認してください。",
                  );
                }
              })(event);
            }}
          >
            <p className="text-sm leading-6 text-slate-600">
              登録しているメールアドレスへ、パスワード再設定リンクを送ります。
            </p>
            <div>
              <label
                className="text-xs font-medium text-slate-700"
                htmlFor="recovery-email"
              >
                メールアドレス
              </label>
              <Input
                autoComplete="email"
                autoFocus
                className="mt-1"
                id="recovery-email"
                type="email"
                {...register("email", {
                  onChange: () => setServerError(null),
                })}
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-rose-700">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            {serverError ? (
              <p
                className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
                role="alert"
              >
                {serverError}
              </p>
            ) : null}

            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "送信中…" : "再設定メールを送信"}
            </Button>
            <Link
              className="block text-center text-sm font-medium text-slate-600 hover:text-slate-950 hover:underline"
              to="/login"
            >
              ログイン画面へ戻る
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
