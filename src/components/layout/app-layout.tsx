import { useMemo, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckSquare2,
  Home,
  Inbox,
  Settings,
  LogOut,
  UserRound,
  UsersRound,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { GlobalSearch } from "@/components/layout/global-search";
import { ConnectivityBanner } from "@/components/layout/connectivity-banner";
import { GlobalCreateMenu } from "@/components/layout/global-create-menu";
import { EditorOnly } from "@/features/access/editor-only";
import { useAccess } from "@/features/access/use-access";
import { useAuth } from "@/features/auth/use-auth";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "ホーム", path: "/", icon: Home },
  { label: "候補者", path: "/candidates", icon: UsersRound },
  { label: "求人", path: "/jobs", icon: BriefcaseBusiness },
  { label: "Inbox", path: "/inbox", icon: Inbox },
  { label: "今日の予定", path: "/today", icon: CalendarDays },
  { label: "タスク", path: "/tasks", icon: CheckSquare2 },
  { label: "レポート", path: "/reports", icon: BarChart3 },
  { label: "設定", path: "/settings", icon: Settings },
] as const;

function getPageTitle(pathname: string) {
  if (/^\/companies\/[^/]+$/.test(pathname)) return "企業詳細";
  if (pathname.startsWith("/companies")) return "企業管理";
  if (/^\/candidates\/.+/.test(pathname)) return "候補者詳細";
  if (/^\/jobs\/.+/.test(pathname)) return "求人詳細";
  return (
    navItems.find((item) =>
      item.path === "/" ? pathname === "/" : pathname.startsWith(item.path),
    )?.label ?? "Candidate CRM"
  );
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const auth = useAuth();
  const access = useAccess();
  const location = useLocation();
  const pageTitle = useMemo(
    () => getPageTitle(location.pathname),
    [location.pathname],
  );
  const userLabel = auth.user?.email ?? "ログインユーザー";

  async function handleSignOut() {
    setIsSigningOut(true);
    setLogoutError(null);
    const succeeded = await auth.signOut();
    if (!succeeded) {
      setLogoutError(
        auth.errorMessage ??
          "ログアウトに失敗しました。時間を置いて再度お試しください。",
      );
    }
    setIsSigningOut(false);
  }

  if (access.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600" role="status">
          アクセス権限を確認しています…
        </p>
      </main>
    );
  }

  if (access.role === "pending" || access.role === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section
          className="w-full max-w-md rounded-lg border border-amber-200 bg-white p-6 shadow-sm"
          role="alert"
        >
          <h1 className="text-lg font-semibold text-slate-950">
            利用承認をお待ちください
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            このアカウントはまだCandidate
            CRMの利用を承認されていません。管理者へ承認を依頼してください。
          </p>
          <p className="mt-3 text-xs text-slate-500">{userLabel}</p>
          {logoutError ? (
            <p className="mt-3 text-sm text-rose-700">{logoutError}</p>
          ) : null}
          <button
            className="mt-5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            {isSigningOut ? "ログアウト中…" : "ログアウト"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-slate-950 text-slate-100 transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-[224px]",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
            C
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Candidate CRM</p>
              <p className="text-[11px] text-slate-400">Recruiting workspace</p>
            </div>
          ) : null}
        </div>

        <nav aria-label="メインナビゲーション" className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    isActive
                      ? "bg-blue-600 font-medium text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  )
                }
                end={item.path === "/"}
                key={item.path}
                title={collapsed ? item.label : undefined}
                to={item.path}
              >
                <Icon aria-hidden="true" className="size-4.5 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </NavLink>
            );
          })}
        </nav>

        <button
          aria-label={collapsed ? "サイドバーを展開" : "サイドバーを折り畳む"}
          className="m-2 flex h-9 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="mr-2 size-4" />
              <span className="text-xs">折り畳む</span>
            </>
          )}
        </button>
      </aside>

      <div
        className={cn(
          "min-w-0 transition-[margin] duration-200",
          collapsed ? "ml-[68px]" : "ml-[224px]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-5">
          <div className="min-w-36">
            <h1 className="text-lg font-semibold text-slate-900">
              {pageTitle}
            </h1>
          </div>
          <div className="relative max-w-xl flex-1">
            <GlobalSearch />
          </div>
          <EditorOnly>
            <GlobalCreateMenu />
          </EditorOnly>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-100">
              <UserRound className="size-4 text-slate-600" />
            </div>
            <span className="whitespace-nowrap text-sm font-medium">
              {userLabel}
            </span>
            <button
              aria-label="ログアウト"
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              title="ログアウト"
              type="button"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>
        {logoutError ? (
          <div
            className="border-b border-rose-200 bg-rose-50 px-5 py-2 text-sm text-rose-800"
            role="alert"
          >
            {logoutError}
          </div>
        ) : null}
        <ConnectivityBanner />
        <main className="min-w-0 p-5">
          {access.role === "viewer" ? (
            <div
              className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
              role="status"
            >
              閲覧専用モード：データの追加・変更・アーカイブはできません。
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
