import type { Candidate } from "@/types";
import type {
  ApplicationRow,
  CandidateRow,
  CandidateStatus as DatabaseCandidateStatus,
  ProfileRow,
} from "@/types/database";

export const candidateStatusLabels: Record<
  DatabaseCandidateStatus,
  Candidate["status"]
> = {
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
};

function dateOnly(value: string | null): string {
  if (!value) return "-";
  if (!value.includes("T")) return value.slice(0, 10);
  const date = new Date(value);
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 10);
}

function calculateAge(birthDate: string | null): number {
  if (!birthDate) return 0;
  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() >= birth.getDate());
  if (!birthdayPassed) age -= 1;
  return Math.max(age, 0);
}

function splitPriorityConditions(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toCandidateView(
  candidate: CandidateRow,
  profiles: ProfileRow[] = [],
  applications: ApplicationRow[] = [],
): Candidate {
  const owner = profiles.find((profile) => profile.id === candidate.owner_id);
  const activeApplications = applications.filter(
    (application) =>
      application.candidate_id === candidate.id &&
      application.archived_at === null &&
      !["joined", "withdrawn", "rejected"].includes(
        application.application_status,
      ),
  ).length;

  return {
    id: candidate.id,
    name: candidate.full_name,
    birthDate: dateOnly(candidate.birth_date),
    age: calculateAge(candidate.birth_date),
    phone: candidate.phone ?? "-",
    email: candidate.email ?? "-",
    location: candidate.prefecture ?? "-",
    company: candidate.current_company ?? "-",
    department: candidate.current_department ?? "-",
    currentRole:
      candidate.current_occupation ?? candidate.current_job_title ?? "-",
    employmentPeriod: "-",
    experienceArea: "-",
    experienceYears: 0,
    desiredRole: candidate.desired_occupations.join("、") || "-",
    desiredLocation: candidate.desired_locations.join("、") || "-",
    desiredSalary:
      candidate.desired_salary_min ?? candidate.desired_salary_max ?? 0,
    availableFrom: dateOnly(candidate.available_from),
    reasonForChange: candidate.reason_for_change ?? "-",
    priorities: splitPriorityConditions(candidate.priority_conditions),
    status: candidateStatusLabels[candidate.candidate_status],
    lastContactDate: dateOnly(candidate.last_contacted_at),
    nextContactDate: dateOnly(candidate.next_action_due_at),
    nextAction: candidate.next_action ?? "次回対応は未設定です",
    owner: owner?.display_name ?? owner?.email ?? "未設定",
    strengths: candidate.strengths ?? "-",
    concerns: candidate.concerns ?? "-",
    interviewNotes: candidate.interview_summary ?? "-",
    activeApplications,
  };
}
