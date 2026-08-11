import { FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { useAuth } from "@/features/auth/use-auth";
import {
  CANDIDATE_CSV_MAX_BYTES,
  autoMapCandidateHeaders,
  buildCandidateImportRows,
  candidateImportFields,
  parseCandidateCsv,
  type CandidateColumnMapping,
  type ParsedCandidateCsv,
} from "@/features/candidates/candidate-import-model";
import {
  useCandidatesQuery,
  useCreateCandidatesMutation,
} from "@/features/candidates/candidate-queries";
import { toCandidateValues } from "@/features/candidates/candidate-form-model";

async function readCsv(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("shift-jis").decode(bytes);
}

export function CandidateCsvImportPanel() {
  const { user } = useAuth();
  const candidatesQuery = useCandidatesQuery();
  const createMutation = useCreateCandidatesMutation();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCandidateCsv | null>(null);
  const [mapping, setMapping] = useState<CandidateColumnMapping>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const rows = useMemo(
    () =>
      parsed
        ? buildCandidateImportRows(parsed, mapping, candidatesQuery.data ?? [])
        : [],
    [candidatesQuery.data, mapping, parsed],
  );
  const selected = rows.filter((row) => selectedRows.has(row.rowNumber));
  const hasNameMapping = mapping.includes("full_name");
  const hasDuplicateMapping = mapping.some(
    (field, index) => field !== "ignore" && mapping.indexOf(field) !== index,
  );

  const chooseFile = async (file: File | null) => {
    setError(null);
    setSuccessCount(null);
    setParsed(null);
    setMapping([]);
    setSelectedRows(new Set());
    if (!file) return;
    if (file.size > CANDIDATE_CSV_MAX_BYTES) {
      setError("CSVは2MB以内にしてください。");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("CSVファイルを選択してください。");
      return;
    }
    try {
      const nextParsed = parseCandidateCsv(await readCsv(file));
      const nextMapping = autoMapCandidateHeaders(nextParsed.headers);
      const nextRows = buildCandidateImportRows(
        nextParsed,
        nextMapping,
        candidatesQuery.data ?? [],
      );
      setFileName(file.name);
      setParsed(nextParsed);
      setMapping(nextMapping);
      setSelectedRows(
        new Set(
          nextRows
            .filter((row) => !row.errors.length && !row.duplicates.length)
            .map((row) => row.rowNumber),
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "CSVを読み込めませんでした。",
      );
    }
  };

  const updateMapping = (columnIndex: number, value: string) => {
    const next = mapping.map((field, index) =>
      index === columnIndex ? (value as CandidateColumnMapping[number]) : field,
    );
    setMapping(next);
    if (parsed) {
      const nextRows = buildCandidateImportRows(
        parsed,
        next,
        candidatesQuery.data ?? [],
      );
      setSelectedRows(
        new Set(
          nextRows
            .filter((row) => !row.errors.length && !row.duplicates.length)
            .map((row) => row.rowNumber),
        ),
      );
    }
  };

  const register = async () => {
    if (!user || !selected.length || !hasNameMapping || hasDuplicateMapping)
      return;
    setError(null);
    setSuccessCount(null);
    try {
      const created = await createMutation.mutateAsync(
        selected.map((row) => ({
          ...toCandidateValues(row.values),
          owner_id: user.id,
        })),
      );
      setSuccessCount(created.length);
      setSelectedRows(new Set());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "候補者を一括登録できませんでした。",
      );
    }
  };

  return (
    <SectionCard
      description="UTF-8またはShift_JISのCSVを最大1,000名まで確認してから一括登録します。重複候補は初期選択から除外し、別人と確認できた行だけ再選択できます。"
      title="CSVから一括登録"
    >
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50">
        <Upload className="size-5 text-blue-700" />
        {fileName || "CSVファイルを選択"}
        <input
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>

      {error ? (
        <p
          className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {successCount !== null ? (
        <div
          className="mt-3 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          <span>{successCount}名を登録しました。</span>
          <Link className="font-medium underline" to="/candidates">
            候補者一覧を確認
          </Link>
        </div>
      ) : null}

      {parsed ? (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">列の対応</h3>
            <p className="mt-1 text-xs text-slate-500">
              自動判定が違う場合は変更してください。同じ項目を複数列へ割り当てることはできません。
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {parsed.headers.map((header, index) => (
                <label
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-xs"
                  key={`${header}-${index}`}
                >
                  <span
                    className="truncate font-medium text-slate-700"
                    title={header}
                  >
                    {header || `列${index + 1}`}
                  </span>
                  <Select
                    aria-label={`${header || `列${index + 1}`}の登録先`}
                    className="min-w-0"
                    onChange={(event) =>
                      updateMapping(index, event.target.value)
                    }
                    value={mapping[index] ?? "ignore"}
                  >
                    <option value="ignore">取り込まない</option>
                    {candidateImportFields.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
            {!hasNameMapping ? (
              <p className="mt-2 text-xs text-rose-700">
                「氏名（必須）」へ対応する列を指定してください。
              </p>
            ) : null}
            {hasDuplicateMapping ? (
              <p className="mt-2 text-xs text-rose-700">
                同じ登録先が複数の列に指定されています。
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              全{rows.length}件・登録対象{selected.length}件・重複
              {rows.filter((row) => row.duplicates.length).length}件・入力エラー
              {rows.filter((row) => row.errors.length).length}件
            </div>
            <Button
              disabled={
                !selected.length ||
                !hasNameMapping ||
                hasDuplicateMapping ||
                createMutation.isPending
              }
              onClick={() => void register()}
              size="sm"
            >
              {createMutation.isPending ? (
                <LoaderCircle className="mr-1.5 size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-1.5 size-4" />
              )}
              選択した{selected.length}名を登録
            </Button>
          </div>

          <TableContainer>
            <Table>
              <thead>
                <tr>
                  <Th>登録</Th>
                  <Th>行</Th>
                  <Th>氏名</Th>
                  <Th>メール</Th>
                  <Th>勤務先・職種</Th>
                  <Th>確認結果</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((row) => {
                  const selectable = !row.errors.length;
                  return (
                    <tr key={row.rowNumber}>
                      <Td>
                        <input
                          aria-label={`${row.rowNumber}行目を登録`}
                          checked={selectedRows.has(row.rowNumber)}
                          disabled={!selectable || createMutation.isPending}
                          onChange={(event) =>
                            setSelectedRows((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(row.rowNumber);
                              else next.delete(row.rowNumber);
                              return next;
                            })
                          }
                          type="checkbox"
                        />
                      </Td>
                      <Td>{row.rowNumber}</Td>
                      <Td className="font-medium">
                        {row.values.full_name || "-"}
                      </Td>
                      <Td>{row.values.email || "-"}</Td>
                      <Td>
                        {[
                          row.values.current_company,
                          row.values.current_occupation,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </Td>
                      <Td>
                        {row.errors.length ? (
                          <span className="text-rose-700">
                            {row.errors.join(" ")}
                          </span>
                        ) : row.duplicates.length ? (
                          <span className="text-amber-700">
                            既存候補者またはCSV内の別行と一致（
                            {row.duplicates
                              .flatMap((item) => item.matchedFields)
                              .join("・")}
                            ）
                          </span>
                        ) : (
                          <span className="text-emerald-700">登録可能</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableContainer>
          {rows.length > 100 ? (
            <p className="text-xs text-slate-500">
              画面には先頭100件を表示しています。登録対象には選択済みの全行が含まれます。
            </p>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
