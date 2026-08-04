import { Bot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getCandidateAiAnalysis } from "@/data/workspace-data";

export function CandidateAi({ candidateId }: { candidateId: string }) {
  const analysis = getCandidateAiAnalysis(candidateId);
  if (!analysis) return null;
  const cards = [
    { title: "候補者サマリー", content: analysis.summary },
    { title: "転職理由の整理", content: analysis.motivation },
    { title: "強み", content: analysis.strengths },
    { title: "懸念点", content: analysis.concerns },
    {
      title: "面談で確認すべきこと",
      content: analysis.interviewQuestions.join(" / "),
    },
    { title: "推奨求人", content: analysis.recommendedJobs.join("\n") },
    { title: "次回アクション", content: analysis.nextAction },
    { title: "メール下書き", content: analysis.emailDraft },
  ];
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
        <Bot className="size-4" />
        AI機能は次のPhaseで接続予定です。現在は配置と情報構造のみ確認できます。
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {cards.map((card) => (
          <section
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            key={card.title}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {card.title}
              </h2>
              <Badge className="bg-violet-50 text-violet-700 ring-violet-600/20">
                AI生成予定
              </Badge>
            </div>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-slate-600">
              {card.content}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
