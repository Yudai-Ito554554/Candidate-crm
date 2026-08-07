import { getSupabaseClient } from "@/lib/supabase";
import {
  executeSelect,
  executeSingle,
  toRepositoryError,
  type RepositoryResult,
} from "@/services/repository";
import type {
  FileCategory,
  FileInsert,
  FileRow,
  FileUpdate,
} from "@/types/database";

export const CRM_FILES_BUCKET = "crm-files";

export interface UploadCrmFileInput {
  ownerId: string;
  candidateId?: string;
  companyId?: string;
  jobId?: string;
  file: File;
  category: FileCategory;
  storagePath: string;
}

function storageFailure(message: string): RepositoryResult<never> {
  return {
    data: null,
    error: { kind: "unknown", message },
  };
}

export function listCandidateFiles(
  candidateId: string,
): Promise<RepositoryResult<FileRow[]>> {
  return executeSelect<FileRow>((client) =>
    client
      .from("files")
      .select("*")
      .eq("candidate_id", candidateId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  );
}

export function listJobFiles(
  jobId: string,
): Promise<RepositoryResult<FileRow[]>> {
  return executeSelect<FileRow>((client) =>
    client
      .from("files")
      .select("*")
      .eq("job_id", jobId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  );
}

export function listCompanyFiles(
  companyId: string,
): Promise<RepositoryResult<FileRow[]>> {
  return executeSelect<FileRow>((client) =>
    client
      .from("files")
      .select("*")
      .eq("company_id", companyId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  );
}

export async function uploadCrmFile(
  input: UploadCrmFileInput,
): Promise<RepositoryResult<FileRow>> {
  const client = await getSupabaseClient();
  if (!client)
    return {
      data: null,
      error: {
        kind: "configuration",
        message: "Supabaseの接続設定を確認してください。",
      },
    };

  try {
    const upload = await client.storage
      .from(CRM_FILES_BUCKET)
      .upload(input.storagePath, input.file, {
        contentType: input.file.type,
        upsert: false,
      });
    if (upload.error)
      return storageFailure(
        "ファイルをアップロードできませんでした。形式とサイズを確認してください。",
      );

    const values: FileInsert = {
      owner_id: input.ownerId,
      candidate_id: input.candidateId ?? null,
      company_id: input.companyId ?? null,
      job_id: input.jobId ?? null,
      application_id: null,
      file_name: input.file.name,
      storage_path: input.storagePath,
      mime_type: input.file.type,
      file_size: input.file.size,
      category: input.category,
    };
    const metadata = await client
      .from("files")
      .insert(values)
      .select("*")
      .single();
    if (metadata.error) {
      await client.storage.from(CRM_FILES_BUCKET).remove([input.storagePath]);
      return { data: null, error: toRepositoryError(metadata.error) };
    }
    return { data: metadata.data as FileRow, error: null };
  } catch {
    return storageFailure(
      "ファイルをアップロードできませんでした。ネットワーク接続を確認してください。",
    );
  }
}

export function updateFile(
  fileId: string,
  values: FileUpdate,
): Promise<RepositoryResult<FileRow>> {
  return executeSingle<FileRow>((client) =>
    client
      .from("files")
      .update(values)
      .eq("id", fileId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveFile(
  fileId: string,
): Promise<RepositoryResult<FileRow>> {
  return updateFile(fileId, { archived_at: new Date().toISOString() });
}

export async function downloadCrmFile(
  storagePath: string,
): Promise<RepositoryResult<Blob>> {
  const client = await getSupabaseClient();
  if (!client)
    return {
      data: null,
      error: {
        kind: "configuration",
        message: "Supabaseの接続設定を確認してください。",
      },
    };
  try {
    const result = await client.storage
      .from(CRM_FILES_BUCKET)
      .download(storagePath);
    if (result.error || !result.data)
      return storageFailure("ファイルをダウンロードできませんでした。");
    return { data: result.data, error: null };
  } catch {
    return storageFailure(
      "ファイルをダウンロードできませんでした。ネットワーク接続を確認してください。",
    );
  }
}
