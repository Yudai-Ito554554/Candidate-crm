import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { EnvironmentBadge } from "@/components/common/environment-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { environment } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(12, "パスワードは12文字以上で入力してください。")
      .max(128, "パスワードは128文字以内で入力してください。"),
    confirmation: z.string(),
  })
  .refine((values) => values.password === values.confirmation, {
    message: "確認用パスワードが一致しません。",
    path: ["confirmation"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function SetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRecovery = searchParams.get("mode") === "recovery";
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });
  const environmentName = environment.success
    ? environment.data.VITE_APP_ENV
    : "production";

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
                パスワードを設定
              </h1>
              <EnvironmentBadge environmentName={environmentName} />
            </div>
            <p className="text-xs text-slate-500">
              {isRecovery
                ? "Candidate CRMのパスワード再設定"
                : "Candidate CRMの初回ログイン設定"}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          {isRecovery
            ? "今後のログインで使用する新しいパスワードを設定してください。"
            : "招待されたアカウントで使用するパスワードを設定してください。"}
        </p>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            void handleSubmit(async ({ password }) => {
              setServerError(null);
              const client = await getSupabaseClient();
              if (!client) {
                setServerError("Supabaseの接続設定を確認してください。");
                return;
              }
              try {
                const { error } = await client.auth.updateUser({ password });
                if (error) {
                  setServerError(
                    "パスワードを設定できませんでした。別のパスワードでお試しください。",
                  );
                  return;
                }
                void navigate("/", { replace: true });
              } catch {
                setServerError(
                  "パスワードを設定できませんでした。ネットワーク接続を確認してください。",
                );
              }
            })(event);
          }}
        >
          <div>
            <label
              className="text-xs font-medium text-slate-700"
              htmlFor="new-password"
            >
              新しいパスワード
            </label>
            <Input
              autoComplete="new-password"
              autoFocus
              className="mt-1"
              id="new-password"
              type="password"
              {...register("password", {
                onChange: () => setServerError(null),
              })}
            />
            {errors.password ? (
              <p className="mt-1 text-xs text-rose-700">
                {errors.password.message}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">12文字以上</p>
            )}
          </div>

          <div>
            <label
              className="text-xs font-medium text-slate-700"
              htmlFor="password-confirmation"
            >
              パスワード（確認）
            </label>
            <Input
              autoComplete="new-password"
              className="mt-1"
              id="password-confirmation"
              type="password"
              {...register("confirmation", {
                onChange: () => setServerError(null),
              })}
            />
            {errors.confirmation ? (
              <p className="mt-1 text-xs text-rose-700">
                {errors.confirmation.message}
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
            {isSubmitting
              ? "設定中…"
              : isRecovery
                ? "パスワードを変更して開始"
                : "パスワードを設定して開始"}
          </Button>
        </form>
      </section>
    </main>
  );
}
