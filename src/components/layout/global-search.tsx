import {
  BriefcaseBusiness,
  Building2,
  LoaderCircle,
  Search,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useGlobalSearchQuery } from "@/features/search/search-queries";
import { cn } from "@/lib/utils";
import type { CrmSearchEntityType, CrmSearchResultRow } from "@/types/database";

const entityPresentation: Record<
  CrmSearchEntityType,
  { label: string; path: string; icon: typeof UserRound }
> = {
  candidate: { label: "候補者", path: "/candidates", icon: UserRound },
  company: { label: "企業", path: "/companies", icon: Building2 },
  job: { label: "求人", path: "/jobs", icon: BriefcaseBusiness },
};

const statusLabels: Record<string, string> = {
  new: "新規",
  contacted: "初回連絡",
  interview_scheduling: "面談調整",
  interviewed: "面談済み",
  job_proposed: "求人提案",
  intention_confirming: "応募意思確認",
  active_selection: "選考中",
  offered: "内定",
  joined: "入社",
  on_hold: "保留",
  closed: "終了",
  draft: "下書き",
  open: "募集中",
  paused: "募集停止",
  listed: "上場",
  unlisted: "非上場",
};

function resultPath(result: CrmSearchResultRow) {
  const presentation = entityPresentation[result.entity_type];
  return `${presentation.path}/${result.entity_id}`;
}

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const search = useGlobalSearchQuery(debouncedQuery);
  const results = useMemo(() => search.data ?? [], [search.data]);
  const canSearch = query.trim().length >= 2;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectResult = (result: CrmSearchResultRow) => {
    setOpen(false);
    setQuery("");
    void navigate(resultPath(result));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const result = results[activeIndex];
      if (result) selectResult(result);
    }
  };

  return (
    <div className="relative w-full" ref={rootRef}>
      <Search
        aria-hidden="true"
        className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
      />
      <Input
        aria-autocomplete="list"
        aria-controls="global-search-results"
        aria-expanded={open && canSearch}
        aria-label="全体検索"
        className="h-9 border-slate-200 bg-slate-50 pl-9"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="候補者・企業・求人・タグを検索"
        role="combobox"
        value={query}
      />

      {open && query.length > 0 ? (
        <div
          aria-label="全体検索結果"
          className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          id="global-search-results"
          role="listbox"
        >
          {!canSearch ? (
            <p className="px-4 py-3 text-xs text-slate-500">
              2文字以上入力してください。
            </p>
          ) : search.isPending || debouncedQuery !== query.trim() ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
              <LoaderCircle className="size-4 animate-spin" />
              検索しています…
            </div>
          ) : search.isError ? (
            <p className="px-4 py-3 text-xs text-rose-700" role="alert">
              {search.error.message}
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-500">
              該当する候補者・企業・求人はありません。
            </p>
          ) : (
            <ul className="max-h-[min(420px,60vh)] overflow-y-auto py-1">
              {results.map((result, index) => {
                const presentation = entityPresentation[result.entity_type];
                const Icon = presentation.icon;
                return (
                  <li key={`${result.entity_type}-${result.entity_id}`}>
                    <button
                      aria-selected={activeIndex === index}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50",
                        activeIndex === index && "bg-blue-50",
                      )}
                      onClick={() => selectResult(result)}
                      onMouseEnter={() => setActiveIndex(index)}
                      role="option"
                      type="button"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">
                            {result.primary_text}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {presentation.label}
                          </span>
                        </span>
                        {result.secondary_text ? (
                          <span className="block truncate text-xs text-slate-500">
                            {result.secondary_text}
                          </span>
                        ) : null}
                      </span>
                      {result.status_text ? (
                        <Badge
                          value={
                            statusLabels[result.status_text] ??
                            result.status_text
                          }
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
