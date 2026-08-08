import {
  Archive,
  Download,
  FileText,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { EditorOnly } from "@/features/access/editor-only";
import { useAuth } from "@/features/auth/use-auth";
import {
  acceptedCrmFileTypes,
  fileCategories,
  fileCategoryLabels,
  formatFileSize,
  validateCrmFile,
  type FileTarget,
} from "@/features/files/file-model";
import {
  useArchiveFileMutation,
  useEntityFilesQuery,
  useUploadFileMutation,
} from "@/features/files/file-queries";
import { formatDate } from "@/lib/format";
import { downloadCrmFile } from "@/services/files-repository";
import type { FileCategory, FileRow } from "@/types/database";

export function EntityFiles({ target }: { target: FileTarget }) {
  const { user } = useAuth();
  const query = useEntityFilesQuery(target);
  const uploadMutation = useUploadFileMutation(target);
  const archiveMutation = useArchiveFileMutation(target);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<FileCategory>(
    "candidateId" in target
      ? "resume"
      : "jobId" in target
        ? "job_description"
        : "other",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<FileRow | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const archiveTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!pendingArchive) return;
    dialogRef.current
      ?.querySelector<HTMLButtonElement>('[data-dialog-initial-focus="true"]')
      ?.focus();
  }, [pendingArchive]);

  async function handleUpload() {
    if (!selectedFile || !user) return;
    const validationMessage = validateCrmFile(selectedFile);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    setMessage(null);
    try {
      await uploadMutation.mutateAsync({
        ownerId: user.id,
        file: selectedFile,
        category,
      });
      setSelectedFile(null);
      setMessage("ファイルをアップロードしました。");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ファイルをアップロードできませんでした。",
      );
    }
  }

  async function handleDownload(file: FileRow) {
    setDownloadingId(file.id);
    setMessage(null);
    const result = await downloadCrmFile(file.storage_path);
    setDownloadingId(null);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    const url = URL.createObjectURL(result.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.file_name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function handleArchive(file: FileRow, trigger: HTMLButtonElement) {
    archiveTriggerRef.current = trigger;
    setPendingArchive(file);
  }

  function closeArchiveDialog() {
    setPendingArchive(null);
    archiveTriggerRef.current?.focus();
    archiveTriggerRef.current = null;
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    const file = pendingArchive;
    setMessage(null);
    archiveMutation.mutate(file.id, {
      onError: (error) => setMessage(error.message),
    });
    closeArchiveDialog();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeArchiveDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <section
        aria-label="ファイル管理"
        className="rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <EditorOnly>
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-48">
              <label
                className="mb-1 block text-xs font-medium text-slate-600"
                htmlFor="file-category"
              >
                種別
              </label>
              <Select
                id="file-category"
                onChange={(event) =>
                  setCategory(event.target.value as FileCategory)
                }
                value={category}
              >
                {fileCategories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-64 flex-1">
              <label
                className="mb-1 block text-xs font-medium text-slate-600"
                htmlFor="crm-file"
              >
                ファイル
              </label>
              <input
                accept={acceptedCrmFileTypes}
                className="block h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-medium"
                id="crm-file"
                key={selectedFile?.name ?? "empty"}
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setMessage(null);
                }}
                type="file"
              />
            </div>
            <Button
              className="h-9 gap-1.5"
              disabled={!selectedFile || !user || uploadMutation.isPending}
              onClick={() => void handleUpload()}
              type="button"
            >
              {uploadMutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              アップロード
            </Button>
            <p className="w-full text-xs text-slate-500">
              PDF・Word・JPEG・PNG、10MB以下。保存先は非公開です。
            </p>
            {message ? (
              <p
                aria-live="polite"
                className="w-full text-sm text-slate-700"
                role="status"
              >
                {message}
              </p>
            ) : null}
          </div>
        </EditorOnly>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-slate-500">
            ファイルを読み込んでいます…
          </p>
        ) : query.isError ? (
          <div className="p-4">
            <EmptyState message={query.error.message} />
          </div>
        ) : query.data.length ? (
          <TableContainer className="border-0 shadow-none">
            <Table>
              <thead>
                <tr>
                  <Th>ファイル名</Th>
                  <Th>種別</Th>
                  <Th>サイズ</Th>
                  <Th>追加日</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((file) => (
                  <tr key={file.id}>
                    <Td>
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <FileText className="size-4 shrink-0 text-blue-600" />
                        <span className="break-all">{file.file_name}</span>
                      </span>
                    </Td>
                    <Td>{fileCategoryLabels[file.category]}</Td>
                    <Td className="tabular-nums">
                      {formatFileSize(file.file_size)}
                    </Td>
                    <Td>{formatDate(file.created_at.slice(0, 10))}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button
                          aria-label={`${file.file_name}をダウンロード`}
                          className="h-8 gap-1 px-2"
                          disabled={downloadingId === file.id}
                          onClick={() => void handleDownload(file)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Download className="size-3.5" />
                          保存
                        </Button>
                        <EditorOnly>
                          <Button
                            aria-label={`${file.file_name}をアーカイブ`}
                            className="h-8 px-2 text-rose-700"
                            disabled={archiveMutation.isPending}
                            onClick={(event) =>
                              handleArchive(file, event.currentTarget)
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Archive className="size-3.5" />
                          </Button>
                        </EditorOnly>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        ) : (
          <div className="p-4">
            <EmptyState message="登録されたファイルはありません" />
          </div>
        )}
      </section>
      {pendingArchive ? (
        <div
          aria-labelledby="file-archive-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onKeyDown={handleDialogKeyDown}
          ref={dialogRef}
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h2
              className="text-sm font-semibold text-slate-900"
              id="file-archive-dialog-title"
            >
              ファイルの除外確認
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {pendingArchive.file_name}を一覧から除外しますか？
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                data-dialog-initial-focus="true"
                onClick={closeArchiveDialog}
                size="sm"
                type="button"
                variant="outline"
              >
                キャンセル
              </Button>
              <Button onClick={confirmArchive} size="sm" type="button">
                除外する
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
