import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarPlus,
  Check,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { CandidateAi } from "@/components/candidate/candidate-ai";
import { CandidateApplications } from "@/components/candidate/candidate-applications";
import { CandidateOverview } from "@/components/candidate/candidate-overview";
import { CandidateTasks } from "@/components/candidate/candidate-tasks";
import { CandidateTimeline } from "@/components/candidate/candidate-timeline";
import { DefinitionGrid } from "@/components/common/definition-grid";
import { PlannedButton } from "@/components/common/planned-button";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getCandidate } from "@/data/mock-data";
import { formatDate, mockToday } from "@/lib/format";
import { cn } from "@/lib/utils";

const tabs = [
  "タイムライン",
  "概要",
  "職務経歴",
  "求人・選考",
  "タスク",
  "ファイル",
  "AI",
] as const;
type DetailTab = (typeof tabs)[number];

export function CandidateDetailPage() {
  const { candidateId = "" } = useParams();
  const candidate = getCandidate(candidateId);
  const [activeTab, setActiveTab] = useState<DetailTab>("タイムライン");

  if (!candidate)
    return (
      <div>
        <Link
          className="mb-4 inline-flex items-center gap-2 text-sm text-blue-700"
          to="/candidates"
        >
          <ArrowLeft className="size-4" />
          候補者一覧へ戻る
        </Link>
        <EmptyState message="候補者が見つかりません" />
      </div>
    );
  const priority = candidate.nextContactDate <= mockToday ? "高" : "中";
  const waitingState =
    candidate.status === "選考中" || candidate.status === "応募意思確認"
      ? "相手待ち"
      : "自分待ち";

  return (
    <div>
      <Link
        className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        to="/candidates"
      >
        <ArrowLeft className="size-3.5" />
        候補者へ戻る
      </Link>
      <section
        aria-label="候補者サマリー"
        className="sticky top-16 z-10 rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <div className="grid gap-4 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <UserRound className="size-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-950">
                      {candidate.name}
                    </h2>
                    <Badge value={candidate.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {candidate.company} / {candidate.currentRole} ・{" "}
                    {candidate.location}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <PlannedButton
                  className="h-8 gap-1"
                  size="sm"
                  variant="outline"
                >
                  <MessageSquarePlus className="size-3.5" />
                  活動追加
                </PlannedButton>
                <PlannedButton
                  className="h-8 gap-1"
                  size="sm"
                  variant="outline"
                >
                  <Mail className="size-3.5" />
                  メール作成
                </PlannedButton>
                <PlannedButton
                  className="h-8 gap-1"
                  size="sm"
                  variant="outline"
                >
                  <BriefcaseBusiness className="size-3.5" />
                  求人提案
                </PlannedButton>
                <PlannedButton
                  className="h-8 gap-1"
                  size="sm"
                  variant="outline"
                >
                  <CalendarPlus className="size-3.5" />
                  タスク追加
                </PlannedButton>
                <PlannedButton
                  aria-label="候補者を編集"
                  className="h-8 px-2"
                  size="sm"
                >
                  <Pencil className="size-3.5" />
                </PlannedButton>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs md:grid-cols-4 xl:grid-cols-6">
              <div>
                <dt className="text-slate-400">最終対応日</dt>
                <dd className="mt-0.5 font-medium">
                  {formatDate(candidate.lastContactDate)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">次回対応日</dt>
                <dd
                  className={cn(
                    "mt-0.5 font-semibold",
                    candidate.nextContactDate <= mockToday && "text-rose-700",
                  )}
                >
                  {formatDate(candidate.nextContactDate)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">担当者</dt>
                <dd className="mt-0.5 font-medium">{candidate.owner}</dd>
              </div>
              <div>
                <dt className="text-slate-400">電話</dt>
                <dd className="mt-0.5 inline-flex items-center gap-1 whitespace-nowrap font-medium">
                  <Phone className="size-3" />
                  {candidate.phone}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-400">メール</dt>
                <dd className="mt-0.5 inline-flex items-center gap-1 font-medium">
                  <Mail className="size-3" />
                  {candidate.email}
                </dd>
              </div>
            </dl>
          </div>
          <aside
            aria-label="次にやること"
            className="rounded-md border border-amber-200 bg-amber-50 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-900">
                次にやること
              </p>
              <div className="flex gap-1">
                <Badge value={priority} />
                <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                  {waitingState}
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {candidate.nextAction}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p
                className={cn(
                  "text-xs",
                  candidate.nextContactDate <= mockToday
                    ? "font-semibold text-rose-700"
                    : "text-amber-800",
                )}
              >
                期限：{formatDate(candidate.nextContactDate)}
              </p>
              <PlannedButton
                className="h-7 gap-1 bg-amber-700 text-white hover:bg-amber-800"
                size="sm"
              >
                <Check className="size-3" />
                完了
              </PlannedButton>
            </div>
          </aside>
        </div>
        <div
          className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                activeTab === tab
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-3" role="tabpanel">
        {activeTab === "タイムライン" ? (
          <CandidateTimeline candidateId={candidate.id} />
        ) : null}
        {activeTab === "概要" ? (
          <CandidateOverview candidate={candidate} />
        ) : null}
        {activeTab === "職務経歴" ? (
          <SectionCard title="現在の職務経歴">
            <DefinitionGrid
              items={[
                { label: "勤務先", value: candidate.company },
                { label: "部署", value: candidate.department },
                { label: "職種", value: candidate.currentRole },
                { label: "在籍期間", value: candidate.employmentPeriod },
                { label: "経験領域", value: candidate.experienceArea },
                { label: "経験年数", value: `${candidate.experienceYears}年` },
              ]}
            />
            <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
              詳細な職務経歴の編集は次のPhaseで実装予定です
            </div>
          </SectionCard>
        ) : null}
        {activeTab === "求人・選考" ? (
          <CandidateApplications candidateId={candidate.id} />
        ) : null}
        {activeTab === "タスク" ? (
          <CandidateTasks candidateId={candidate.id} />
        ) : null}
        {activeTab === "ファイル" ? (
          <SectionCard title="ファイル">
            <EmptyState message="ファイルアップロードは次のPhaseで実装予定です" />
          </SectionCard>
        ) : null}
        {activeTab === "AI" ? <CandidateAi candidateId={candidate.id} /> : null}
      </div>
    </div>
  );
}
