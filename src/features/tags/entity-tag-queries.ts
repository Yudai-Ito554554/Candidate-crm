import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveCompanyTag,
  archiveJobTag,
  archiveUnusedTag,
  attachCompanyTag,
  attachJobTag,
  createTag,
  listCompanyTags,
  listJobTags,
  listTags,
  updateTag,
} from "@/services/tags-repository";
import type { CompanyTagRow, JobTagRow, TagRow } from "@/types/database";

export type EntityTagTarget =
  { kind: "company"; id: string } | { kind: "job"; id: string };
type EntityTagRelation = CompanyTagRow | JobTagRow;

const entityTagKeys = {
  tags: ["tags"] as const,
  relations: (target: EntityTagTarget) =>
    [target.kind, target.id, "tags"] as const,
};

async function unwrap<T>(
  promise: Promise<
    { data: T; error: null } | { data: null; error: { message: string } }
  >,
): Promise<T> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("タグ情報を確認できませんでした。");
  return result.data;
}

function attachTag(target: EntityTagTarget, tagId: string) {
  return target.kind === "company"
    ? unwrap<CompanyTagRow>(
        attachCompanyTag({ company_id: target.id, tag_id: tagId }),
      )
    : unwrap<JobTagRow>(attachJobTag({ job_id: target.id, tag_id: tagId }));
}

export function useEntityTagsQuery(target: EntityTagTarget) {
  return useQuery<EntityTagRelation[]>({
    queryKey: entityTagKeys.relations(target),
    queryFn: async (): Promise<EntityTagRelation[]> =>
      target.kind === "company"
        ? await unwrap<CompanyTagRow[]>(listCompanyTags(target.id))
        : await unwrap<JobTagRow[]>(listJobTags(target.id)),
    enabled: Boolean(target.id),
  });
}

export function useSharedTagsQuery() {
  return useQuery({
    queryKey: entityTagKeys.tags,
    queryFn: () => unwrap<TagRow[]>(listTags()),
  });
}

export function useCreateSharedTagMutation() {
  const queryClient = useQueryClient();
  return useMutation<TagRow, Error, string>({
    mutationFn: (name) => unwrap<TagRow>(createTag({ name })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: entityTagKeys.tags }),
  });
}

export function useUpdateSharedTagMutation() {
  const queryClient = useQueryClient();
  return useMutation<TagRow, Error, { tagId: string; name: string }>({
    mutationFn: ({ tagId, name }) => unwrap<TagRow>(updateTag(tagId, { name })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: entityTagKeys.tags }),
  });
}

export function useArchiveSharedTagMutation() {
  const queryClient = useQueryClient();
  return useMutation<TagRow, Error, string>({
    mutationFn: (tagId) => unwrap<TagRow>(archiveUnusedTag(tagId)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: entityTagKeys.tags }),
  });
}

function useInvalidateEntityTags(target: EntityTagTarget) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: entityTagKeys.relations(target),
    });
}

export function useAttachEntityTagMutation(target: EntityTagTarget) {
  const invalidate = useInvalidateEntityTags(target);
  return useMutation<EntityTagRelation, Error, string>({
    mutationFn: (tagId) => attachTag(target, tagId),
    onSuccess: invalidate,
  });
}

export function useCreateAndAttachEntityTagMutation(target: EntityTagTarget) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateEntityTags(target);
  return useMutation<EntityTagRelation, Error, string>({
    mutationFn: async (name) => {
      const tag = await unwrap<TagRow>(createTag({ name }));
      return attachTag(target, tag.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entityTagKeys.tags });
      return invalidate();
    },
  });
}

export function useArchiveEntityTagMutation(target: EntityTagTarget) {
  const invalidate = useInvalidateEntityTags(target);
  return useMutation<EntityTagRelation, Error, string>({
    mutationFn: (relationId) =>
      target.kind === "company"
        ? unwrap<CompanyTagRow>(archiveCompanyTag(relationId))
        : unwrap<JobTagRow>(archiveJobTag(relationId)),
    onSuccess: invalidate,
  });
}
