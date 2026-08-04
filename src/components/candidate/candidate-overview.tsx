import { DefinitionGrid } from "@/components/common/definition-grid";
import { SectionCard } from "@/components/common/section-card";
import { formatDate, formatSalary } from "@/lib/format";
import type { Candidate } from "@/types";

export function CandidateOverview({ candidate }: { candidate: Candidate }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <SectionCard title="基本情報">
        <DefinitionGrid
          items={[
            { label: "氏名", value: candidate.name },
            { label: "生年月日", value: formatDate(candidate.birthDate) },
            { label: "年齢", value: `${candidate.age}歳` },
            { label: "居住地", value: candidate.location },
            { label: "電話番号", value: candidate.phone },
            { label: "メールアドレス", value: candidate.email },
          ]}
        />
      </SectionCard>
      <SectionCard title="希望条件">
        <DefinitionGrid
          items={[
            { label: "希望職種", value: candidate.desiredRole },
            { label: "希望勤務地", value: candidate.desiredLocation },
            { label: "希望年収", value: formatSalary(candidate.desiredSalary) },
            { label: "入社可能時期", value: candidate.availableFrom },
          ]}
        />
      </SectionCard>
      <SectionCard className="xl:col-span-2" title="キャリア情報">
        <div className="max-w-4xl space-y-5">
          <div>
            <h3 className="text-xs font-medium text-slate-500">転職理由</h3>
            <p className="mt-1 text-sm leading-7 text-slate-800">
              {candidate.reasonForChange}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500">転職優先条件</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidate.priorities.map((priority) => (
                <span
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700"
                  key={priority}
                >
                  {priority}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium text-slate-500">強み</h3>
              <p className="mt-1 text-sm leading-7 text-slate-800">
                {candidate.strengths}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-slate-500">懸念点</h3>
              <p className="mt-1 text-sm leading-7 text-slate-800">
                {candidate.concerns}
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-medium text-slate-500">面談サマリー</h3>
            <p className="mt-1 text-sm leading-7 text-slate-800">
              {candidate.interviewNotes}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
