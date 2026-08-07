import { BriefcaseBusiness, Building2, Plus, UsersRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const createItems = [
  {
    label: "候補者を登録",
    description: "候補者の基本情報と希望条件",
    path: "/candidates/new",
    icon: UsersRound,
  },
  {
    label: "企業を登録",
    description: "取引企業と採用情報",
    path: "/companies/new",
    icon: Building2,
  },
  {
    label: "求人を登録",
    description: "募集条件と選考情報",
    path: "/jobs/new",
    icon: BriefcaseBusiness,
  },
] as const;

export function GlobalCreateMenu() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        setOpen(false);
        containerRef.current?.querySelector("button")?.focus();
      }}
      ref={containerRef}
    >
      <Button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-9 gap-2"
        onClick={() => setOpen((value) => !value)}
        size="sm"
        type="button"
      >
        <Plus aria-hidden="true" className="size-4" />
        新規登録
      </Button>

      {open ? (
        <div
          aria-label="新規登録メニュー"
          className="absolute right-0 top-11 z-40 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
          id={menuId}
          role="menu"
        >
          {createItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                key={item.path}
                onClick={() => setOpen(false)}
                role="menuitem"
                to={item.path}
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
