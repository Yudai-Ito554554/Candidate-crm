import { ArrowRight, History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { applicationStatusLabels } from "@/features/applications/application-model";
import { useProfilesQuery } from "@/features/candidates/candidate-queries";
import type {
  ApplicationRow,
  ApplicationStatusHistoryRow,
  CompanyRow,
  JobRow,
} from "@/types/database";

interface ApplicationStatusHistoryProps {
  applications: ApplicationRow[];
  companies: CompanyRow[];
  histories: ApplicationStatusHistoryRow[];
  jobs: JobRow[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function ApplicationStatusHistory({
  applications,
  companies,
  histories,
  jobs,
}: ApplicationStatusHistoryProps) {
  const profilesQuery = useProfilesQuery();
  const applicationsById = new Map(
    applications.map((application) => [application.id, application]),
  );
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const companiesById = new Map(
    companies.map((company) => [company.id, company]),
  );
  const profilesById = new Map(
    (profilesQuery.data ?? []).map((profile) => [profile.id, profile]),
  );
  const visibleHistories = histories
    .filter((history) => applicationsById.has(history.application_id))
    .sort((left, right) => right.changed_at.localeCompare(left.changed_at))
    .slice(0, 20);

  return (
    <section
      aria-labelledby="application-status-history-title"
      className="rounded-lg border border-slate-200 bg-white"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <History className="size-4 text-slate-400" />
        <div>
          <h3
            className="text-sm font-semibold text-slate-900"
            id="application-status-history-title"
          >
            選考ステータス履歴
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            最新20件の選考状態変更を表示します
          </p>
        </div>
      </div>

      {visibleHistories.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          ステータス履歴はまだありません。
        </p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {visibleHistories.map((history) => {
            const application = applicationsById.get(history.application_id);
            const job = application
              ? jobsById.get(application.job_id)
              : undefined;
            const company = job ? companiesById.get(job.company_id) : undefined;
            const profile = history.changed_by
              ? profilesById.get(history.changed_by)
              : undefined;
            const fromLabel = history.from_status
              ? applicationStatusLabels[history.from_status]
              : null;
            const toLabel = applicationStatusLabels[history.to_status];
            return (
              <li
                aria-label={
                  fromLabel
                    ? `${fromLabel}から${toLabel}へ変更`
                    : `${toLabel}を初期状態として記録`
                }
                className="grid gap-3 px-4 py-3 md:grid-cols-[150px_minmax(180px,1fr)_minmax(220px,1.3fr)_140px] md:items-center"
                key={history.id}
              >
                <time
                  className="text-xs tabular-nums text-slate-500"
                  dateTime={history.changed_at}
                >
                  {formatDateTime(history.changed_at)}
                </time>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {company?.name ?? "企業未設定"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {job?.title ?? "求人未設定"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {fromLabel ? (
                    <>
                      <Badge value={fromLabel} />
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 text-slate-400"
                      />
                    </>
                  ) : null}
                  <Badge value={toLabel} />
                  {history.is_backfilled ? (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      移行時点の状態
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  {profile?.display_name ?? profile?.email ?? "システム"}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
