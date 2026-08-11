import {
  candidateFormSchema,
  emptyCandidateFormValues,
  findCandidateDuplicates,
  type CandidateDuplicateMatch,
  type CandidateFormValues,
} from "@/features/candidates/candidate-form-model";
import type { CandidateRow, CandidateStatus } from "@/types/database";

export const CANDIDATE_CSV_MAX_BYTES = 2 * 1024 * 1024;
export const CANDIDATE_CSV_MAX_ROWS = 1_000;
export const CANDIDATE_TEXT_MAX_LENGTH = 50_000;

export const candidateImportFields = [
  { value: "full_name", label: "氏名（必須）" },
  { value: "full_name_kana", label: "氏名カナ" },
  { value: "email", label: "メールアドレス" },
  { value: "phone", label: "電話番号" },
  { value: "birth_date", label: "生年月日" },
  { value: "prefecture", label: "居住都道府県" },
  { value: "current_company", label: "現勤務先" },
  { value: "current_department", label: "部署" },
  { value: "current_job_title", label: "役職" },
  { value: "current_occupation", label: "職種" },
  { value: "candidate_status", label: "候補者ステータス" },
  { value: "desired_occupations", label: "希望職種" },
  { value: "desired_locations", label: "希望勤務地" },
  { value: "current_salary_min", label: "現年収下限（万円）" },
  { value: "current_salary_max", label: "現年収上限（万円）" },
  { value: "desired_salary_min", label: "希望年収下限（万円）" },
  { value: "desired_salary_max", label: "希望年収上限（万円）" },
  { value: "available_from", label: "入社可能日" },
  { value: "reason_for_change", label: "転職理由" },
  { value: "priority_conditions", label: "転職優先条件" },
  { value: "strengths", label: "強み" },
  { value: "concerns", label: "懸念点" },
  { value: "source", label: "流入経路" },
] as const;

export type CandidateImportField =
  (typeof candidateImportFields)[number]["value"];
export type CandidateColumnMapping = Array<CandidateImportField | "ignore">;

export interface ParsedCandidateCsv {
  headers: string[];
  rows: string[][];
}

export interface CandidateImportRow {
  rowNumber: number;
  values: CandidateFormValues;
  errors: string[];
  duplicates: CandidateDuplicateMatch[];
}

const aliases: Record<CandidateImportField, string[]> = {
  full_name: ["氏名", "名前", "候補者名", "fullname", "name"],
  full_name_kana: ["氏名カナ", "フリガナ", "カナ", "fullnamekana", "kana"],
  email: ["メール", "メールアドレス", "email", "emailaddress"],
  phone: ["電話", "電話番号", "携帯", "携帯番号", "tel", "phone"],
  birth_date: ["生年月日", "誕生日", "birthdate", "birthday"],
  prefecture: ["居住地", "都道府県", "居住都道府県", "prefecture"],
  current_company: [
    "勤務先",
    "現勤務先",
    "会社名",
    "currentcompany",
    "company",
  ],
  current_department: ["部署", "所属部署", "department"],
  current_job_title: ["役職", "肩書", "jobtitle", "position"],
  current_occupation: ["職種", "現職種", "occupation", "role"],
  candidate_status: ["ステータス", "候補者ステータス", "status"],
  desired_occupations: ["希望職種", "desiredoccupation", "desiredoccupations"],
  desired_locations: ["希望勤務地", "desiredlocation", "desiredlocations"],
  current_salary_min: ["現年収下限", "現在年収下限", "currentsalarymin"],
  current_salary_max: ["現年収", "現在年収", "現年収上限", "currentsalarymax"],
  desired_salary_min: ["希望年収下限", "desiredsalarymin"],
  desired_salary_max: ["希望年収", "希望年収上限", "desiredsalarymax"],
  available_from: ["入社可能日", "入社可能時期", "availablefrom"],
  reason_for_change: ["転職理由", "reasonforchange"],
  priority_conditions: ["転職優先条件", "希望条件", "priorityconditions"],
  strengths: ["強み", "strengths"],
  concerns: ["懸念点", "concerns"],
  source: ["流入経路", "登録経路", "source"],
};

const statusAliases: Record<string, CandidateStatus> = {
  新規: "new",
  初回連絡: "contacted",
  面談調整: "interview_scheduling",
  面談済み: "interviewed",
  求人提案: "job_proposed",
  応募意思確認: "intention_confirming",
  選考中: "active_selection",
  内定: "offered",
  入社: "joined",
  保留: "on_hold",
  終了: "closed",
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-・()（）]/g, "");
}

function normalizeDate(value: string): string {
  const trimmed = value.normalize("NFKC").trim();
  const matched =
    /(\d{4})\s*[/.年-]\s*(\d{1,2})\s*[/.月-]\s*(\d{1,2})\s*日?/.exec(trimmed);
  if (!matched) return trimmed;
  return `${matched[1]}-${matched[2]?.padStart(2, "0")}-${matched[3]?.padStart(2, "0")}`;
}

function cellsFromResumeLine(line: string): string[] {
  return line
    .normalize("NFKC")
    .split(/\t+/)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function valueAfterResumeLabel(
  lines: string[],
  labels: string[],
  endIndex = lines.length,
): string {
  const normalizedLabels = labels.map(normalizeHeader);
  for (let index = 0; index < endIndex; index += 1) {
    const cells = cellsFromResumeLine(lines[index] ?? "");
    const labelIndex = cells.findIndex((cell) =>
      normalizedLabels.includes(normalizeHeader(cell)),
    );
    if (labelIndex >= 0 && cells[labelIndex + 1]) return cells[labelIndex + 1];
  }
  return "";
}

function sectionBetween(
  lines: string[],
  start: RegExp,
  ends: RegExp[],
): string {
  const startIndex = lines.findIndex((line) => start.test(line));
  if (startIndex < 0) return "";
  const result: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (ends.some((pattern) => pattern.test(line))) break;
    if (line) result.push(line);
  }
  return result.join("\n").trim();
}

function extractResumeAddress(lines: string[]): string {
  const addressIndex = lines.findIndex((line) => /現住所/.test(line));
  if (addressIndex < 0) return "";
  const sameLine = cellsFromResumeLine(lines[addressIndex] ?? "").find(
    (cell) => !/現住所|〒|ふりがな/.test(cell) && /都|道|府|県/.test(cell),
  );
  if (sameLine) return sameLine;
  for (
    let index = addressIndex + 1;
    index <= Math.min(addressIndex + 3, lines.length - 1);
    index += 1
  ) {
    const line = (lines[index] ?? "").normalize("NFKC").trim();
    if (line && /都|道|府|県/.test(line)) return line;
  }
  return "";
}

function extractPrefecture(address: string): string {
  return address.match(/北海道|東京都|京都府|大阪府|.{2,3}県/)?.[0] ?? "";
}

function normalizeSalary(value: string): string {
  const matched = value.normalize("NFKC").replace(/,/g, "").match(/\d+/);
  return matched?.[0] ?? value.trim();
}

function normalizeStatus(value: string): CandidateStatus {
  const normalized = value.trim();
  const valid = [
    "new",
    "contacted",
    "interview_scheduling",
    "interviewed",
    "job_proposed",
    "intention_confirming",
    "active_selection",
    "offered",
    "joined",
    "on_hold",
    "closed",
  ] as const;
  return valid.includes(normalized as CandidateStatus)
    ? (normalized as CandidateStatus)
    : (statusAliases[normalized] ?? "new");
}

export function parseCandidateCsv(text: string): ParsedCandidateCsv {
  const source = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      record.push(cell);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV内の引用符が閉じられていません。");
  record.push(cell);
  if (record.some((value) => value.trim())) records.push(record);
  if (records.length < 2)
    throw new Error("見出し行と1件以上の候補者データが必要です。");
  if (records.length - 1 > CANDIDATE_CSV_MAX_ROWS)
    throw new Error(
      `一度に登録できる候補者は${CANDIDATE_CSV_MAX_ROWS}名までです。`,
    );

  const headers = records[0]?.map((value) => value.trim()) ?? [];
  if (!headers.length || headers.every((header) => !header))
    throw new Error("CSVの見出し行を確認してください。");
  const rows = records
    .slice(1)
    .map((row) => headers.map((_, index) => row[index]?.trim() ?? ""));
  return { headers, rows };
}

export function autoMapCandidateHeaders(
  headers: string[],
): CandidateColumnMapping {
  const used = new Set<CandidateImportField>();
  return headers.map((header) => {
    const normalized = normalizeHeader(header);
    const match = candidateImportFields.find(({ value }) =>
      aliases[value].some((alias) => normalizeHeader(alias) === normalized),
    )?.value;
    if (!match || used.has(match)) return "ignore";
    used.add(match);
    return match;
  });
}

function assignImportedValue(
  values: CandidateFormValues,
  field: CandidateImportField,
  rawValue: string,
) {
  const value = rawValue.trim();
  if (field === "candidate_status") values[field] = normalizeStatus(value);
  else if (field === "birth_date" || field === "available_from")
    values[field] = normalizeDate(value);
  else if (
    field === "current_salary_min" ||
    field === "current_salary_max" ||
    field === "desired_salary_min" ||
    field === "desired_salary_max"
  )
    values[field] = normalizeSalary(value);
  else values[field] = value;
}

export function buildCandidateImportRows(
  parsed: ParsedCandidateCsv,
  mapping: CandidateColumnMapping,
  candidates: CandidateRow[],
): CandidateImportRow[] {
  const importedCandidates: CandidateRow[] = [];
  return parsed.rows.map((row, rowIndex) => {
    const values = emptyCandidateFormValues();
    mapping.forEach((field, columnIndex) => {
      if (field !== "ignore")
        assignImportedValue(values, field, row[columnIndex] ?? "");
    });
    if (!values.source) values.source = "CSV一括登録";
    const parsedValues = candidateFormSchema.safeParse(values);
    const errors = parsedValues.success
      ? []
      : parsedValues.error.issues.map((issue) => issue.message);
    const duplicates = findCandidateDuplicates(values, [
      ...candidates,
      ...importedCandidates,
    ]);
    if (!errors.length && !duplicates.length) {
      importedCandidates.push({
        id: `csv-row-${rowIndex + 2}`,
        full_name: values.full_name,
        email: values.email || null,
        phone: values.phone || null,
      } as CandidateRow);
    }
    return {
      rowNumber: rowIndex + 2,
      values,
      errors: [...new Set(errors)],
      duplicates,
    };
  });
}

export function parseCandidateResumeText(text: string): CandidateFormValues {
  const source = text.trim();
  if (source.length < 10)
    throw new Error("履歴書または候補者情報を10文字以上貼り付けてください。");
  if (source.length > CANDIDATE_TEXT_MAX_LENGTH)
    throw new Error("貼り付ける文章は50,000文字以内にしてください。");

  const values = emptyCandidateFormValues();
  values.source = "履歴書・テキスト取り込み";
  const lines = source.split(/\r?\n/);
  const labelMap = new Map<string, CandidateImportField>();
  for (const { value } of candidateImportFields)
    for (const alias of aliases[value])
      labelMap.set(normalizeHeader(alias), value);

  for (const line of lines) {
    const match = /^\s*([^:：]{1,24})\s*[:：]\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const field = labelMap.get(normalizeHeader(match[1] ?? ""));
    if (field) assignImportedValue(values, field, match[2] ?? "");
  }

  const nameLineIndex = lines.findIndex((line) =>
    cellsFromResumeLine(line).some((cell) => normalizeHeader(cell) === "氏名"),
  );
  if (!values.full_name)
    values.full_name = valueAfterResumeLabel(lines, ["氏名", "名前"]);
  if (!values.full_name_kana)
    values.full_name_kana = valueAfterResumeLabel(
      lines,
      ["ふりがな", "フリガナ", "氏名カナ"],
      nameLineIndex >= 0 ? nameLineIndex : lines.length,
    );

  if (!values.email)
    values.email =
      source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  if (!values.phone)
    values.phone =
      source.match(/(?:0\d{1,4}[-ー]?\d{1,4}[-ー]?\d{3,4})/)?.[0] ?? "";
  if (!values.birth_date) {
    const birthLine = source.match(
      /(?:生年月日|誕生日)\s*[:：]?\s*([^\n]+)/,
    )?.[1];
    if (birthLine) values.birth_date = normalizeDate(birthLine);
  }

  const address = extractResumeAddress(lines);
  if (!values.prefecture) values.prefecture = extractPrefecture(address);

  if (!values.current_company) {
    const companyMatches = [
      ...source
        .normalize("NFKC")
        .matchAll(/((?:株式会社|有限会社|合同会社)[^\s\t、,。]+)\s*入社/g),
    ];
    values.current_company = companyMatches.at(-1)?.[1] ?? "";
  }
  if (!values.current_department) {
    const departmentMatches = [
      ...source
        .normalize("NFKC")
        .matchAll(
          /(?:株式会社|有限会社|合同会社)[^\s\t、,。]+[\s\t]+(.+?事業部)(?:配属|に異動)/g,
        ),
    ];
    values.current_department = departmentMatches.at(-1)?.[1]?.trim() ?? "";
  }
  if (!values.current_job_title) {
    const titleMatches = [
      ...source.normalize("NFKC").matchAll(/([^\s\t、。]+)(?:昇格|就任)/g),
    ];
    values.current_job_title = titleMatches.at(-1)?.[1] ?? "";
  }

  if (!values.strengths)
    values.strengths = sectionBetween(lines, /自己\s*PR/i, [/その他記入欄/]);

  const career = sectionBetween(lines, /学\s*歴・職\s*歴/, [
    /免\s*許・資\s*格/,
    /自己\s*PR/i,
    /その他記入欄/,
  ]);
  const qualifications = sectionBetween(lines, /免\s*許・資\s*格/, [
    /自己\s*PR/i,
    /その他記入欄/,
  ]);
  const otherNotes = sectionBetween(lines, /その他記入欄/, []);
  const privateNoteSections = [
    address ? `現住所（履歴書取込）\n${address}` : "",
    career ? `学歴・職歴（履歴書取込）\n${career}` : "",
    qualifications ? `免許・資格（履歴書取込）\n${qualifications}` : "",
    otherNotes ? `その他記入欄（履歴書取込）\n${otherNotes}` : "",
  ].filter(Boolean);
  if (!values.private_notes && privateNoteSections.length)
    values.private_notes = privateNoteSections.join("\n\n");

  return values;
}
