import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { EnvironmentBadge } from "@/components/common/environment-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLoadingScreen } from "@/features/auth/auth-loading-screen";
import { ConfigurationErrorPage } from "@/features/auth/configuration-error-page";
import { useAuth } from "@/features/auth/use-auth";
import { environment } from "@/lib/env";

const loginSchema = z.object({
  email: z.string().trim().email("有効なメールアドレスを入力してください。"),
  password: z.string().min(1, "パスワードを入力してください。"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (auth.status === "authenticated") {
      void navigate("/", { replace: true });
    }
  }, [auth.status, navigate]);

  if (!environment.success) return <ConfigurationErrorPage />;
  if (auth.status === "loading") return <AuthLoadingScreen />;
  if (auth.session) return <Navigate replace to="/" />;

  const environmentName = environment.data.VITE_APP_ENV;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <LockKeyhole aria-hidden="true" className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-950">
                Candidate CRM
              </h1>
              <EnvironmentBadge environmentName={environmentName} />
            </div>
            <p className="text-xs text-slate-500">業務アカウントでログイン</p>
          </div>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            void handleSubmit(async (values) => {
              const succeeded = await auth.signIn(
                values.email,
                values.password,
              );
              if (succeeded) void navigate("/", { replace: true });
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
              autoFocus
              className="mt-1"
              id="email"
              type="email"
              {...register("email", { onChange: auth.clearError })}
            />
            {errors.email ? (
              <p className="mt-1 text-xs text-rose-700">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                className="text-xs font-medium text-slate-700"
                htmlFor="password"
              >
                パスワード
              </label>
              <Link
                className="text-xs font-medium text-blue-700 hover:underline"
                to="/forgot-password"
              >
                パスワードを忘れた場合
              </Link>
            </div>
            <Input
              autoComplete="current-password"
              className="mt-1"
              id="password"
              type="password"
              {...register("password", { onChange: auth.clearError })}
            />
            {errors.password ? (
              <p className="mt-1 text-xs text-rose-700">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {auth.errorMessage ? (
            <p
              className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
              role="alert"
            >
              {auth.errorMessage}
            </p>
          ) : null}

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "ログイン処理中…" : "ログイン"}
          </Button>
        </form>
      </section>
    </main>
  );
}
