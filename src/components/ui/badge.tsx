import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeStyles: Record<string, string> = {
  新規: "bg-sky-50 text-sky-700 ring-sky-600/20",
  初回連絡: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  面談調整: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  面談済み: "bg-violet-50 text-violet-700 ring-violet-600/20",
  求人提案: "bg-purple-50 text-purple-700 ring-purple-600/20",
  応募意思確認: "bg-amber-50 text-amber-800 ring-amber-600/20",
  選考中: "bg-blue-50 text-blue-700 ring-blue-600/20",
  内定: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  入社: "bg-green-50 text-green-700 ring-green-600/20",
  保留: "bg-slate-100 text-slate-600 ring-slate-500/20",
  検討中: "bg-slate-100 text-slate-700 ring-slate-500/20",
  応募済み: "bg-blue-50 text-blue-700 ring-blue-600/20",
  書類選考: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  一次面接: "bg-violet-50 text-violet-700 ring-violet-600/20",
  二次面接: "bg-purple-50 text-purple-700 ring-purple-600/20",
  最終面接: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20",
  オファー: "bg-amber-50 text-amber-800 ring-amber-600/20",
  辞退: "bg-slate-100 text-slate-600 ring-slate-500/20",
  見送り: "bg-rose-50 text-rose-700 ring-rose-600/20",
  募集中: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  募集停止: "bg-amber-50 text-amber-800 ring-amber-600/20",
  充足: "bg-slate-100 text-slate-600 ring-slate-500/20",
  未着手: "bg-slate-100 text-slate-700 ring-slate-500/20",
  対応中: "bg-blue-50 text-blue-700 ring-blue-600/20",
  完了: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  高: "bg-rose-50 text-rose-700 ring-rose-600/20",
  中: "bg-amber-50 text-amber-800 ring-amber-600/20",
  低: "bg-slate-100 text-slate-600 ring-slate-500/20",
  期限超過: "bg-rose-50 text-rose-700 ring-rose-600/20",
  未完了: "bg-blue-50 text-blue-700 ring-blue-600/20",
  相手待ち: "bg-amber-50 text-amber-800 ring-amber-600/20",
  自分待ち: "bg-blue-50 text-blue-700 ring-blue-600/20",
  面談前: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  応募調整: "bg-amber-50 text-amber-800 ring-amber-600/20",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  value?: string;
}

export function Badge({ value, className, children, ...props }: BadgeProps) {
  const label = value ?? "";

  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeStyles[label] ?? "bg-slate-100 text-slate-700 ring-slate-500/20",
        className,
      )}
      {...props}
    >
      {children ?? value}
    </span>
  );
}
