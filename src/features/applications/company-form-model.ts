import { z } from "zod";

import type { CompanyContactRow, CompanyRow } from "@/types/database";

const optionalNonNegativeInteger = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^\d+$/.test(value),
    "0以上の整数を入力してください。",
  );

export const companyWebsiteSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "http://またはhttps://で始まる有効なURLを入力してください。");

const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "有効なメールアドレスを入力してください。",
  );

export const companyFormSchema = z.object({
  name: z.string().trim().min(1, "企業名を入力してください。"),
  name_kana: z.string().trim(),
  industry: z.string().trim(),
  employees: optionalNonNegativeInteger,
  capital: optionalNonNegativeInteger,
  listed: z.enum(["", "true", "false"]),
  website: companyWebsiteSchema,
  address: z.string().trim(),
  notes: z.string().trim(),
});

export const quickCompanyFormSchema = companyFormSchema.pick({
  name: true,
  industry: true,
  website: true,
});

export const contactFormSchema = z.object({
  full_name: z.string().trim().min(1, "担当者名を入力してください。"),
  department: z.string().trim(),
  position: z.string().trim(),
  email: optionalEmail,
  phone: z.string().trim(),
  notes: z.string().trim(),
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;
export type QuickCompanyFormValues = z.infer<typeof quickCompanyFormSchema>;
export type ContactFormValues = z.infer<typeof contactFormSchema>;
export type CompanyDuplicateMatch = {
  company: CompanyRow;
  matchedFields: Array<"企業名" | "Webサイト">;
};

function normalizeCompanyName(value: string | null): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function normalizeWebsite(value: string | null): string {
  const trimmed = (value ?? "").normalize("NFKC").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${hostname}${pathname}`;
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
  }
}

export function findCompanyDuplicates(
  values: Pick<CompanyFormValues, "name" | "website">,
  companies: CompanyRow[],
): CompanyDuplicateMatch[] {
  const name = normalizeCompanyName(values.name);
  const website = normalizeWebsite(values.website);

  return companies.flatMap((company) => {
    const matchedFields: CompanyDuplicateMatch["matchedFields"] = [];
    if (name && normalizeCompanyName(company.name) === name)
      matchedFields.push("企業名");
    if (website && normalizeWebsite(company.website) === website)
      matchedFields.push("Webサイト");
    return matchedFields.length ? [{ company, matchedFields }] : [];
  });
}

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}

export function toCompanyFormValues(company?: CompanyRow): CompanyFormValues {
  return {
    name: company?.name ?? "",
    name_kana: company?.name_kana ?? "",
    industry: company?.industry ?? "",
    employees: company?.employees?.toString() ?? "",
    capital: company?.capital?.toString() ?? "",
    listed:
      company?.listed === null || company?.listed === undefined
        ? ""
        : (String(company.listed) as "true" | "false"),
    website: company?.website ?? "",
    address: company?.address ?? "",
    notes: company?.notes ?? "",
  };
}

export function toCompanyValues(values: CompanyFormValues) {
  return {
    name: values.name.trim(),
    name_kana: emptyToNull(values.name_kana),
    industry: emptyToNull(values.industry),
    employees: values.employees ? Number(values.employees) : null,
    capital: values.capital ? Number(values.capital) : null,
    listed: values.listed ? values.listed === "true" : null,
    website: emptyToNull(values.website),
    address: emptyToNull(values.address),
    notes: emptyToNull(values.notes),
  };
}

export function toContactFormValues(
  contact?: CompanyContactRow,
): ContactFormValues {
  return {
    full_name: contact?.full_name ?? "",
    department: contact?.department ?? "",
    position: contact?.position ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    notes: contact?.notes ?? "",
  };
}

export function toContactValues(companyId: string, values: ContactFormValues) {
  return {
    company_id: companyId,
    full_name: values.full_name.trim(),
    department: emptyToNull(values.department),
    position: emptyToNull(values.position),
    email: emptyToNull(values.email),
    phone: emptyToNull(values.phone),
    notes: emptyToNull(values.notes),
  };
}
