import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarPlus,
  Check,
  LoaderCircle,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { CandidateAi } from "@/components/candidate/candidate-ai";
import { CandidateApplications } from "@/components/candidate/candidate-applications";
import { CandidateExperiences } from "@/components/candidate/candidate-experiences";
import { CandidateOverview } from "@/components/candidate/candidate-overview";
import { CandidateTags } from "@/components/candidate/candidate-tags";
import { CandidateTasks } from "@/components/candidate/candidate-tasks";
import { CandidateTimeline } from "@/components/candidate/candidate-timeline";
import { EntityFiles } from "@/components/common/entity-files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EditorOnly } from "@/features/access/editor-only";
import {
  useApplicationsQuery,
  useCandidateQuery,
  useCompleteCandidateNextActionMutation,
  useProfilesQuery,
  useRecordCandidateViewMutation,
} from "@/features/candidates/candidate-queries";
import { toCandidateView } from "@/features/candidates/candidate-view";
import { useAuth } from "@/features/auth/use-auth";
import { formatDate, isOverdueDate } from "@/lib/format";
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
  const auth = useAuth();
  const candidateQuery = useCandidateQuery(candidateId);
  const recordViewMutation = useRecordCandidateViewMutation();
  const recordView = recordViewMutation.mutate;
  const profilesQuery = useProfilesQuery();
  const applicationsQuery = useApplicationsQuery();
  const candidate = useMemo(
    () =>
      candidateQuery.data
        ? toCandidateView(
            candidateQuery.data,
            profilesQuery.data ?? [],
            applicationsQuery.data ?? [],
          )
        : null,
    [applicationsQuery.data, candidateQuery.data, profilesQuery.data],
  );
  const [activeTab, setActiveTab] = useState<DetailTab>("タイムライン");
  const [activityComposer, setActivityComposer] = useState(0);
  const [applicationComposer, setApplicationComposer] = useState(0);
  const [taskComposer, setTaskComposer] = useState(0);
  const [confirmNextActionCompletion, setConfirmNextActionCompletion] =
    useState(false);
  const completeNextAction =
    useCompleteCandidateNextActionMutation(candidateId);

  useEffect(() => {
    if (!candidateQuery.data?.id || !auth.user?.id) return;
    recordView({
      candidateId: candidateQuery.data.id,
    });
  }, [auth.user?.id, candidateQuery.data?.id, recordView]);

  if (candidateQuery.isPending)
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin" />
        候補者情報を読み込んでいます…
      </div>
    );

  if (candidateQuery.isError)
    return (
      <div>
        <Link
          className="mb-4 inline-flex items-center gap-2 text-sm text-blue-700"
          to="/candidates"
        >
          <ArrowLeft className="size-4" />
          候補者一覧へ戻る
        </Link>
        <EmptyState
          message={
            candidateQuery.error instanceof Error
              ? candidateQuery.error.message
              : "候補者を読み込めませんでした"
          }
        />
      </div>
    );

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
  const isOverdue = isOverdueDate(candidate.nextContactDate);
  const hasNextAction = Boolean(candidateQuery.data?.next_action?.trim());
  const priority = isOverdue ? "高" : "中";
  const waitingState =
    candidate.status === "選考中" || candidate.status === "応募意思確認"
      ? "相手待ち"
      : "自分待ち";

  return (
    <div>
      {recordViewMutation.error ? (
        <p
          className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="alert"
        >
          閲覧履歴を更新できませんでした。候補者情報の操作は継続できます。
        </p>
      ) : null}
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
              <EditorOnly>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    className="h-8 gap-1"
                    onClick={() => {
                      setActiveTab("タイムライン");
                      setActivityComposer((value) => value + 1);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <MessageSquarePlus className="size-3.5" />
                    活動追加
                  </Button>
                  <Button
                    className="h-8 gap-1"
                    onClick={() => {
                      setActiveTab("求人・選考");
                      setApplicationComposer((value) => value + 1);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <BriefcaseBusiness className="size-3.5" />
                    求人提案
                  </Button>
                  <Button
                    className="h-8 gap-1"
                    onClick={() => {
                      setActiveTab("タスク");
                      setTaskComposer((value) => value + 1);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <CalendarPlus className="size-3.5" />
                    タスク追加
                  </Button>
                  <Button
                    aria-label="候補者を編集"
                    asChild
                    className="h-8 px-2"
                    size="sm"
                  >
                    <Link to={`/candidates/${candidate.id}/edit`}>
                      <Pencil className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </EditorOnly>
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
                    isOverdue && "text-rose-700",
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
                  isOverdue ? "font-semibold text-rose-700" : "text-amber-800",
                )}
              >
                期限：{formatDate(candidate.nextContactDate)}
              </p>
              <EditorOnly>
                {confirmNextActionCompletion ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      className="h-7"
                      disabled={completeNextAction.isPending}
                      onClick={() => setConfirmNextActionCompletion(false)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      戻る
                    </Button>
                    <Button
                      className="h-7 gap-1 bg-amber-700 text-white hover:bg-amber-800"
                      disabled={completeNextAction.isPending}
                      onClick={() => {
                        completeNextAction.mutate(undefined, {
                          onSuccess: () => {
                            setConfirmNextActionCompletion(false);
                            setActiveTab("タイムライン");
                          },
                        });
                      }}
                      size="sm"
                      type="button"
                    >
                      {completeNextAction.isPending ? (
                        <LoaderCircle className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      完了を確定
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="h-7 gap-1 bg-amber-700 text-white hover:bg-amber-800"
                    disabled={!hasNextAction}
                    onClick={() => setConfirmNextActionCompletion(true)}
                    size="sm"
                    type="button"
                  >
                    <Check className="size-3" />
                    完了
                  </Button>
                )}
              </EditorOnly>
            </div>
            {confirmNextActionCompletion ? (
              <p
                className="mt-2 text-xs font-medium text-amber-900"
                role="status"
              >
                完了すると内容をタイムラインへ記録し、次回対応を未設定にします。
              </p>
            ) : null}
            {completeNextAction.error ? (
              <p
                className="mt-2 text-xs font-medium text-rose-700"
                role="alert"
              >
                {completeNextAction.error.message}
              </p>
            ) : null}
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
          <CandidateTimeline
            candidateId={candidate.id}
            initiallyAdding={activityComposer > 0}
            key={`${candidate.id}-activities-${activityComposer}`}
          />
        ) : null}
        {activeTab === "概要" ? (
          <div className="space-y-4">
            <CandidateTags candidateId={candidate.id} />
            <CandidateOverview candidate={candidate} />
          </div>
        ) : null}
        {activeTab === "職務経歴" ? (
          <CandidateExperiences candidateId={candidate.id} />
        ) : null}
        {activeTab === "求人・選考" ? (
          <CandidateApplications
            candidateId={candidate.id}
            initiallyAdding={applicationComposer > 0}
            key={`${candidate.id}-applications-${applicationComposer}`}
          />
        ) : null}
        {activeTab === "タスク" ? (
          <CandidateTasks
            candidateId={candidate.id}
            initiallyAdding={taskComposer > 0}
            key={`${candidate.id}-tasks-${taskComposer}`}
          />
        ) : null}
        {activeTab === "ファイル" ? (
          <EntityFiles target={{ candidateId: candidate.id }} />
        ) : null}
        {activeTab === "AI" ? <CandidateAi candidateId={candidate.id} /> : null}
      </div>
    </div>
  );
}
