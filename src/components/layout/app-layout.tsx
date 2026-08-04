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
  Plus,
  Search,
  Settings,
  LogOut,
  UserRound,
  UsersRound,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { PlannedButton } from "@/components/common/planned-button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/use-auth";
import { currentUser } from "@/data/mock-data";
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
  const auth = useAuth();
  const location = useLocation();
  const pageTitle = useMemo(
    () => getPageTitle(location.pathname),
    [location.pathname],
  );
  const userLabel =
    (typeof auth.user?.user_metadata.full_name === "string"
      ? auth.user.user_metadata.full_name
      : auth.user?.email) ?? currentUser;

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
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <Input
              aria-label="全体検索"
              className="h-9 border-slate-200 bg-slate-50 pl-9"
              placeholder="候補者・企業・求人を検索"
            />
          </div>
          <PlannedButton className="h-9 gap-2" size="sm">
            <Plus className="size-4" />
            新規登録
          </PlannedButton>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-100">
              <UserRound className="size-4 text-slate-600" />
            </div>
            <span className="whitespace-nowrap text-sm font-medium">
              {userLabel}
            </span>
            {auth.isConfigured ? (
              <button
                aria-label="ログアウト"
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => void auth.signOut()}
                title="ログアウト"
                type="button"
              >
                <LogOut className="size-4" />
              </button>
            ) : null}
          </div>
        </header>
        <main className="min-w-0 p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
