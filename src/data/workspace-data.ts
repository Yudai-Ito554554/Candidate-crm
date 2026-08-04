import { activities, candidates, currentUser, jobs } from "@/data/mock-data";
import type {
  CandidateAiAnalysis,
  InboxMessage,
  ScheduleItem,
  TimelineCategory,
  TimelineEvent,
  TimelineEventType,
} from "@/types";

const activityTypeMap: Record<
  (typeof activities)[number]["type"],
  { type: TimelineEventType; category: TimelineCategory }
> = {
  面談: { type: "Zoom面談", category: "面談・電話" },
  メール: { type: "メール送信", category: "メール" },
  電話: { type: "電話", category: "面談・電話" },
  求人提案: { type: "求人提案", category: "求人・選考" },
  応募: { type: "応募", category: "求人・選考" },
  企業確認: { type: "企業確認", category: "求人・選考" },
};

const activityTimeline: TimelineEvent[] = activities.map((activity) => ({
  id: `timeline-${activity.id}`,
  candidateId: activity.candidateId,
  occurredAt: activity.occurredAt,
  type: activityTypeMap[activity.type].type,
  category: activityTypeMap[activity.type].category,
  title: activity.content.split("。")[0] ?? activity.content,
  content: activity.content,
  owner: currentUser,
  jobId: activity.jobId,
  hasAttachment: activity.type === "応募",
}));

const registrationTimeline: TimelineEvent[] = candidates.map(
  (candidate, index) => ({
    id: `timeline-registration-${candidate.id}`,
    candidateId: candidate.id,
    occurredAt: `2026-07-${String(18 + (index % 10)).padStart(2, "0")} 09:30`,
    type: "メモ",
    category: "タスク・メモ",
    title: "候補者情報を登録",
    content: `${candidate.currentRole}としての経験と希望条件を登録しました。`,
    owner: candidate.owner,
    hasAttachment: false,
  }),
);

const additionalTimeline: TimelineEvent[] = [
  {
    id: "tl-001",
    candidateId: "c-001",
    occurredAt: "2026-08-03 09:15",
    type: "メール受信",
    category: "メール",
    title: "一次面接のお礼と追加質問を受信",
    content: "面接官の所属部署と、入社後の担当製品について確認したいとの連絡。",
    owner: currentUser,
    jobId: "j-001",
    hasAttachment: false,
  },
  {
    id: "tl-002",
    candidateId: "c-001",
    occurredAt: "2026-08-03 08:50",
    type: "タスク作成",
    category: "タスク・メモ",
    title: "面接フィードバック確認タスクを作成",
    content: "本日17時までに企業と候補者双方の所感を回収する。",
    owner: currentUser,
    jobId: "j-001",
    hasAttachment: false,
  },
  {
    id: "tl-003",
    candidateId: "c-001",
    occurredAt: "2026-08-01 14:00",
    type: "面接",
    category: "求人・選考",
    title: "一次面接を実施",
    content: "営業部長・人事とのオンライン面接。循環器領域の実績を中心に確認。",
    owner: currentUser,
    jobId: "j-001",
    hasAttachment: false,
  },
  {
    id: "tl-004",
    candidateId: "c-001",
    occurredAt: "2026-08-01 10:20",
    type: "書類提出",
    category: "求人・選考",
    title: "英文レジュメを追加提出",
    content: "企業指定フォーマットの英文レジュメを採用担当へ送付。",
    owner: currentUser,
    jobId: "j-001",
    hasAttachment: true,
  },
  {
    id: "tl-005",
    candidateId: "c-002",
    occurredAt: "2026-08-03 10:40",
    type: "応募意思確認",
    category: "求人・選考",
    title: "応募意思の回答待ち",
    content: "家族と相談後、8月5日までに回答予定。",
    owner: currentUser,
    jobId: "j-002",
    hasAttachment: false,
  },
  {
    id: "tl-006",
    candidateId: "c-004",
    occurredAt: "2026-08-03 11:30",
    type: "メール受信",
    category: "メール",
    title: "履歴書・職務経歴書を受信",
    content: "応募書類2点を受領。推薦状作成へ進む。",
    owner: "田中 彩",
    jobId: "j-004",
    hasAttachment: true,
  },
  {
    id: "tl-007",
    candidateId: "c-006",
    occurredAt: "2026-08-03 13:00",
    type: "選考結果",
    category: "求人・選考",
    title: "オファー条件を提示",
    content: "年収720万円、入社日10月1日の条件を提示。",
    owner: "山本 淳",
    jobId: "j-004",
    hasAttachment: true,
  },
];

export const timelineEvents: TimelineEvent[] = [
  ...additionalTimeline,
  ...activityTimeline,
  ...registrationTimeline,
].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

export const recentlyViewedCandidates = [
  { candidateId: "c-001", viewedAt: "2026-08-03 10:42" },
  { candidateId: "c-006", viewedAt: "2026-08-03 09:18" },
  { candidateId: "c-002", viewedAt: "2026-08-02 18:05" },
  { candidateId: "c-004", viewedAt: "2026-08-02 16:31" },
];

export const inboxMessages: InboxMessage[] = [
  {
    id: "mail-001",
    category: "未対応",
    sender: "佐藤 健太",
    subject: "一次面接後の追加確認について",
    preview: "本日はありがとうございました。担当製品について…",
    body: "伊東様\n\n本日は面接のご調整ありがとうございました。入社後に担当する製品群と営業エリアについて、追加で確認できますでしょうか。\n\n佐藤 健太",
    candidateId: "c-001",
    jobId: "j-001",
    receivedAt: "2026-08-03 09:15",
    responseStatus: "未対応",
    hasAiDraft: true,
  },
  {
    id: "mail-002",
    category: "企業から",
    sender: "ノースメディカル 採用担当",
    subject: "佐藤様 一次面接フィードバック",
    preview: "社内評価は良好です。次回面接の日程を…",
    body: "伊東様\n\n佐藤様の一次面接評価は良好でした。次回は営業本部長との面接を予定しています。候補日をご確認ください。",
    candidateId: "c-001",
    jobId: "j-001",
    receivedAt: "2026-08-03 08:45",
    responseStatus: "未対応",
    hasAiDraft: false,
  },
  {
    id: "mail-003",
    category: "候補者から",
    sender: "田中 愛",
    subject: "応募書類をお送りします",
    preview: "履歴書と職務経歴書を添付いたします…",
    body: "田中です。履歴書と職務経歴書を添付いたします。内容をご確認いただけますと幸いです。",
    candidateId: "c-004",
    jobId: "j-004",
    receivedAt: "2026-08-03 11:30",
    responseStatus: "未対応",
    hasAiDraft: true,
  },
  {
    id: "mail-004",
    category: "返信待ち",
    sender: "伊東 勇大 → 鈴木 美咲",
    subject: "オンコロジーMR求人のご検討状況",
    preview: "ご家族とのご相談状況はいかがでしょうか…",
    body: "鈴木様\n\n先日ご案内した求人について、ご検討状況はいかがでしょうか。ご不明点があればお知らせください。",
    candidateId: "c-002",
    jobId: "j-002",
    receivedAt: "2026-08-02 17:45",
    responseStatus: "返信待ち",
    hasAiDraft: false,
  },
  {
    id: "mail-005",
    category: "企業から",
    sender: "アークファーマ 採用担当",
    subject: "求人票更新のお知らせ",
    preview: "オンコロジーMRの採用要件を更新しました…",
    body: "採用要件と想定年収レンジを更新しました。候補者へのご案内時にご確認ください。",
    jobId: "j-002",
    receivedAt: "2026-08-02 15:20",
    responseStatus: "対応済み",
    hasAiDraft: false,
  },
  {
    id: "mail-006",
    category: "対応済み",
    sender: "山本 結衣",
    subject: "オファー面談のお礼",
    preview: "条件面について家族と相談いたします…",
    body: "オファー面談ありがとうございました。条件面について家族と相談し、期日までに回答いたします。",
    candidateId: "c-006",
    jobId: "j-004",
    receivedAt: "2026-08-02 14:10",
    responseStatus: "対応済み",
    hasAiDraft: false,
  },
];

export const todaySchedule: ScheduleItem[] = [
  {
    id: "schedule-001",
    time: "09:00",
    type: "企業確認",
    candidateId: "c-001",
    jobId: "j-001",
    content: "一次面接の企業フィードバックを回収",
    status: "期限超過",
    priority: "高",
  },
  {
    id: "schedule-002",
    time: "10:00",
    type: "面談",
    candidateId: "c-008",
    jobId: "j-007",
    content: "初回キャリア面談（Zoom）",
    status: "完了",
    priority: "中",
  },
  {
    id: "schedule-003",
    time: "11:30",
    type: "書類作成",
    candidateId: "c-004",
    jobId: "j-004",
    content: "推薦状を作成して企業へ提出",
    status: "未完了",
    priority: "高",
  },
  {
    id: "schedule-004",
    time: "13:00",
    type: "電話",
    candidateId: "c-006",
    jobId: "j-004",
    content: "オファー条件に関する質問へ回答",
    status: "未完了",
    priority: "高",
  },
  {
    id: "schedule-005",
    time: "15:00",
    type: "候補者対応",
    candidateId: "c-002",
    jobId: "j-002",
    content: "応募意思の確認メールを送信",
    status: "未完了",
    priority: "中",
  },
  {
    id: "schedule-006",
    time: "16:30",
    type: "面談",
    candidateId: "c-009",
    jobId: "j-008",
    content: "キャリア志向と希望条件の確認",
    status: "未完了",
    priority: "中",
  },
  {
    id: "schedule-007",
    time: "17:00",
    type: "選考期限",
    candidateId: "c-001",
    jobId: "j-010",
    content: "書類選考結果の回答期限",
    status: "未完了",
    priority: "高",
  },
];

export const candidateAiAnalyses: CandidateAiAnalysis[] = candidates.map(
  (candidate) => ({
    candidateId: candidate.id,
    summary: `${candidate.experienceArea}に強みを持つ${candidate.currentRole}。${candidate.experienceYears}年の経験があります。`,
    motivation: candidate.reasonForChange,
    strengths: candidate.strengths,
    concerns: candidate.concerns,
    interviewQuestions: [
      "転職時期の優先度",
      "希望条件で譲歩できる点",
      "次の職場で実現したい成果",
    ],
    recommendedJobs: jobs
      .filter((job) => job.status === "募集中")
      .slice(0, 3)
      .map((job) => `${job.company} / ${job.title}`),
    nextAction: candidate.nextAction,
    emailDraft: `${candidate.name}様への次回連絡メール案を生成予定です。`,
  }),
);

export function getCandidateTimeline(candidateId: string) {
  return timelineEvents.filter((event) => event.candidateId === candidateId);
}

export function getCandidateAiAnalysis(candidateId: string) {
  return candidateAiAnalyses.find(
    (analysis) => analysis.candidateId === candidateId,
  );
}
