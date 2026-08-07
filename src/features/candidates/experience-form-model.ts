import { z } from "zod";

import type {
  CandidateExperienceInsert,
  CandidateExperienceRow,
} from "@/types/database";

export const experienceFormSchema = z
  .object({
    company_name: z.string().trim().min(1, "勤務先を入力してください。"),
    department: z.string().trim(),
    job_title: z.string().trim(),
    occupation: z.string().trim(),
    started_on: z.string(),
    ended_on: z.string(),
    is_current: z.boolean(),
    experience_domain: z.string().trim(),
    responsibilities: z.string().trim(),
    achievements: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (
      !values.is_current &&
      values.started_on &&
      values.ended_on &&
      values.ended_on < values.started_on
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ended_on"],
        message: "終了日は開始日以降にしてください。",
      });
    }
  });

export type ExperienceFormValues = z.infer<typeof experienceFormSchema>;

const emptyValues: ExperienceFormValues = {
  company_name: "",
  department: "",
  job_title: "",
  occupation: "",
  started_on: "",
  ended_on: "",
  is_current: false,
  experience_domain: "",
  responsibilities: "",
  achievements: "",
};

export function toExperienceFormValues(
  experience?: CandidateExperienceRow,
): ExperienceFormValues {
  if (!experience) return emptyValues;
  return {
    company_name: experience.company_name ?? "",
    department: experience.department ?? "",
    job_title: experience.job_title ?? "",
    occupation: experience.occupation ?? "",
    started_on: experience.started_on ?? "",
    ended_on: experience.ended_on ?? "",
    is_current: experience.is_current,
    experience_domain: experience.experience_domain ?? "",
    responsibilities: experience.responsibilities ?? "",
    achievements: experience.achievements ?? "",
  };
}

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}

export function toExperienceValues(
  candidateId: string,
  values: ExperienceFormValues,
  sortOrder: number,
): CandidateExperienceInsert {
  return {
    candidate_id: candidateId,
    company_name: values.company_name.trim(),
    department: emptyToNull(values.department),
    job_title: emptyToNull(values.job_title),
    occupation: emptyToNull(values.occupation),
    started_on: values.started_on || null,
    ended_on: values.is_current ? null : values.ended_on || null,
    is_current: values.is_current,
    experience_domain: emptyToNull(values.experience_domain),
    responsibilities: emptyToNull(values.responsibilities),
    achievements: emptyToNull(values.achievements),
    sort_order: sortOrder,
  };
}
