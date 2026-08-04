import { zodResolver } from "@hookform/resolvers/zod";
import { Database, LockKeyhole } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/use-auth";
import { supabaseConfigurationIssue } from "@/lib/supabase/env";

const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください。"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください。"),
});

type LoginValues = z.infer<typeof loginSchema>;

type LoginLocationState = {
  from?: string;
};

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LoginLocationState | null)?.from ?? "/";
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (auth.session) void navigate(from, { replace: true });
  }, [auth.session, from, navigate]);

  if (auth.session) return <Navigate replace to={from} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <LockKeyhole className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-950">
              Candidate CRM
            </h1>
            <p className="text-xs text-slate-500">業務アカウントでログイン</p>
          </div>
        </div>

        {!auth.isConfigured ? (
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <Database className="mt-0.5 size-4 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  Supabase未設定
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  `.env`に接続情報を設定すると認証が有効になります。現在は仮データモードで利用できます。
                </p>
              </div>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                void navigate("/");
              }}
            >
              仮データモードを開く
            </Button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              void handleSubmit(async (values) => {
                const message = await auth.signIn(
                  values.email,
                  values.password,
                );
                if (message) setError("root", { message });
              })(event);
            }}
          >
            <div>
              <label
                className="text-xs font-medium text-slate-700"
                htmlFor="email"
              >
                メールアドレス
              </label>
              <Input
                autoComplete="email"
                className="mt-1"
                id="email"
                type="email"
                {...register("email")}
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-rose-700">
                  {errors.email.message}
                </p>
              ) : null}
            </div>
            <div>
              <label
                className="text-xs font-medium text-slate-700"
                htmlFor="password"
              >
                パスワード
              </label>
              <Input
                autoComplete="current-password"
                className="mt-1"
                id="password"
                type="password"
                {...register("password")}
              />
              {errors.password ? (
                <p className="mt-1 text-xs text-rose-700">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
            {errors.root?.message || auth.error ? (
              <p
                className="rounded-md bg-rose-50 p-3 text-xs text-rose-700"
                role="alert"
              >
                {errors.root?.message ?? auth.error}
              </p>
            ) : null}
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "ログイン中…" : "ログイン"}
            </Button>
          </form>
        )}

        {supabaseConfigurationIssue ? (
          <p className="mt-4 text-xs text-rose-700" role="alert">
            {supabaseConfigurationIssue}
          </p>
        ) : null}
      </section>
    </main>
  );
}
