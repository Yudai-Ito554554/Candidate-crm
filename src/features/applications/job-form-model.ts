import { z } from "zod";

import type { JobRow } from "@/types/database";

const optionalInteger = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^\d+$/.test(value),
    "0以上の整数を入力してください。",
  );

export const jobFormSchema = z
  .object({
    company_id: z.string().min(1, "企業を選択してください。"),
    contact_id: z.string(),
    title: z.string().trim().min(1, "求人名を入力してください。"),
    division: z.string().trim(),
    occupation: z.string().trim(),
    employment_type: z.string().trim(),
    locations: z.string().trim(),
    salary_min: optionalInteger,
    salary_max: optionalInteger,
    job_status: z.enum(["draft", "open", "paused", "closed"]),
    required_conditions: z.string().trim(),
    preferred_conditions: z.string().trim(),
    description: z.string().trim(),
    internal_notes: z.string().trim(),
    opened_at: z.string(),
    closed_at: z.string(),
  })
  .superRefine((values, context) => {
    if (
      values.salary_min &&
      values.salary_max &&
      Number(values.salary_min) > Number(values.salary_max)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salary_max"],
        message: "上限は下限以上にしてください。",
      });
    if (
      values.opened_at &&
      values.closed_at &&
      values.closed_at < values.opened_at
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closed_at"],
        message: "終了日は開始日以降にしてください。",
      });
  });

export type JobFormValues = z.infer<typeof jobFormSchema>;
export type JobDuplicateMatch = {
  job: JobRow;
  matchedFields: Array<"求人名" | "事業部" | "職種" | "勤務地">;
};

function normalizeText(value: string | null): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function normalizedLocations(value: string | string[]): string[] {
  const locations = Array.isArray(value) ? value : value.split(/[、,\n]/);
  return locations.map(normalizeText).filter(Boolean).sort();
}

function listsMatch(left: string[], right: string[]): boolean {
  return (
    left.length > 0 &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function findJobDuplicates(
  values: Pick<
    JobFormValues,
    "company_id" | "title" | "division" | "occupation" | "locations"
  >,
  jobs: JobRow[],
): JobDuplicateMatch[] {
  const title = normalizeText(values.title);
  const locations = normalizedLocations(values.locations);

  return jobs.flatMap((job) => {
    if (
      !values.company_id ||
      job.company_id !== values.company_id ||
      !title ||
      normalizeText(job.title) !== title
    )
      return [];

    const matchedFields: JobDuplicateMatch["matchedFields"] = ["求人名"];
    if (
      values.division &&
      normalizeText(job.division) === normalizeText(values.division)
    )
      matchedFields.push("事業部");
    if (
      values.occupation &&
      normalizeText(job.occupation) === normalizeText(values.occupation)
    )
      matchedFields.push("職種");
    if (listsMatch(normalizedLocations(job.locations), locations))
      matchedFields.push("勤務地");
    return [{ job, matchedFields }];
  });
}

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}

export function toJobFormValues(job?: JobRow): JobFormValues {
  return {
    company_id: job?.company_id ?? "",
    contact_id: job?.contact_id ?? "",
    title: job?.title ?? "",
    division: job?.division ?? "",
    occupation: job?.occupation ?? "",
    employment_type: job?.employment_type ?? "",
    locations: job?.locations.join("、") ?? "",
    salary_min: job?.salary_min?.toString() ?? "",
    salary_max: job?.salary_max?.toString() ?? "",
    job_status: job?.job_status ?? "draft",
    required_conditions: job?.required_conditions ?? "",
    preferred_conditions: job?.preferred_conditions ?? "",
    description: job?.description ?? "",
    internal_notes: job?.internal_notes ?? "",
    opened_at: job?.opened_at ?? "",
    closed_at: job?.closed_at ?? "",
  };
}

export function toJobValues(values: JobFormValues) {
  return {
    company_id: values.company_id,
    contact_id: emptyToNull(values.contact_id),
    title: values.title.trim(),
    division: emptyToNull(values.division),
    occupation: emptyToNull(values.occupation),
    employment_type: emptyToNull(values.employment_type),
    locations: values.locations
      .split(/[、,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    salary_min: values.salary_min ? Number(values.salary_min) : null,
    salary_max: values.salary_max ? Number(values.salary_max) : null,
    job_status: values.job_status,
    required_conditions: emptyToNull(values.required_conditions),
    preferred_conditions: emptyToNull(values.preferred_conditions),
    description: emptyToNull(values.description),
    internal_notes: emptyToNull(values.internal_notes),
    opened_at: values.opened_at || null,
    closed_at: values.closed_at || null,
  };
}
