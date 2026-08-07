import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { buildStoragePath, type FileTarget } from "@/features/files/file-model";
import {
  archiveFile,
  listCandidateFiles,
  listCompanyFiles,
  listJobFiles,
  uploadCrmFile,
} from "@/services/files-repository";
import type { RepositoryResult } from "@/services/repository";
import type { FileCategory, FileRow } from "@/types/database";

export const fileQueryKeys = {
  candidate: (candidateId: string) =>
    ["candidates", candidateId, "files"] as const,
  company: (companyId: string) => ["companies", companyId, "files"] as const,
  job: (jobId: string) => ["jobs", jobId, "files"] as const,
};

function targetKey(target: FileTarget) {
  if ("candidateId" in target)
    return fileQueryKeys.candidate(target.candidateId);
  if ("companyId" in target) return fileQueryKeys.company(target.companyId);
  return fileQueryKeys.job(target.jobId);
}

function listTargetFiles(target: FileTarget) {
  if ("candidateId" in target) return listCandidateFiles(target.candidateId);
  if ("companyId" in target) return listCompanyFiles(target.companyId);
  return listJobFiles(target.jobId);
}

async function unwrap<T>(result: Promise<RepositoryResult<T>>): Promise<T> {
  const resolved = await result;
  if (resolved.error) throw new Error(resolved.error.message);
  return resolved.data;
}

export function useEntityFilesQuery(target: FileTarget) {
  return useQuery({
    queryKey: targetKey(target),
    queryFn: () => unwrap(listTargetFiles(target)),
  });
}

export function useUploadFileMutation(target: FileTarget) {
  const client = useQueryClient();
  return useMutation<
    FileRow,
    Error,
    { ownerId: string; file: File; category: FileCategory }
  >({
    mutationFn: ({ ownerId, file, category }) =>
      unwrap(
        uploadCrmFile({
          ownerId,
          candidateId: "candidateId" in target ? target.candidateId : undefined,
          companyId: "companyId" in target ? target.companyId : undefined,
          jobId: "jobId" in target ? target.jobId : undefined,
          file,
          category,
          storagePath: buildStoragePath(ownerId, target, file),
        }),
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: targetKey(target) }),
  });
}

export function useArchiveFileMutation(target: FileTarget) {
  const client = useQueryClient();
  return useMutation<FileRow, Error, string>({
    mutationFn: (fileId) => unwrap(archiveFile(fileId)),
    onSuccess: () => client.invalidateQueries({ queryKey: targetKey(target) }),
  });
}
