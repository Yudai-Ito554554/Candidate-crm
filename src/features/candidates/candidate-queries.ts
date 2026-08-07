import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveCandidateExperience,
  archiveCandidate,
  completeCandidateNextAction,
  createCandidate,
  createCandidateExperience,
  getCandidate,
  listArchivedCandidates,
  listCandidateExperiences,
  listCandidateViews,
  listCandidates,
  recordCandidateView,
  restoreCandidate,
  updateCandidateExperience,
  updateCandidate,
} from "@/services/candidates-repository";
import { listApplications } from "@/services/applications-repository";
import { listProfiles } from "@/services/profiles-repository";
import {
  archiveCandidateTag,
  attachCandidateTag,
  createTag,
  listCandidateTags,
  listTags,
} from "@/services/tags-repository";
import type {
  ApplicationRow,
  CandidateExperienceInsert,
  CandidateExperienceRow,
  CandidateExperienceUpdate,
  CandidateInsert,
  CandidateRow,
  CandidateStatus,
  CandidateTagRow,
  CandidateUpdate,
  CandidateViewRow,
  ProfileRow,
  TagRow,
} from "@/types/database";
import { workQueryKeys } from "@/features/work/work-queries";

export const candidateQueryKeys = {
  all: ["candidates"] as const,
  archived: ["candidates", "archived"] as const,
  detail: (candidateId: string) => ["candidates", candidateId] as const,
  profiles: ["profiles"] as const,
  applications: ["applications"] as const,
  experiences: (candidateId: string) =>
    ["candidates", candidateId, "experiences"] as const,
  tags: ["tags"] as const,
  candidateTags: (candidateId: string) =>
    ["candidates", candidateId, "tags"] as const,
  views: ["candidate-views"] as const,
};

async function unwrap<T>(
  resultPromise: Promise<
    { data: T; error: null } | { data: null; error: { message: string } }
  >,
): Promise<T> {
  const result = await resultPromise;
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("データを確認できませんでした。");
  return result.data;
}

export function useCandidatesQuery() {
  return useQuery({
    queryKey: candidateQueryKeys.all,
    queryFn: () => unwrap<CandidateRow[]>(listCandidates()),
  });
}

export function useArchivedCandidatesQuery() {
  return useQuery({
    queryKey: candidateQueryKeys.archived,
    queryFn: () => unwrap<CandidateRow[]>(listArchivedCandidates()),
  });
}

export function useCandidateViewsQuery() {
  return useQuery({
    queryKey: candidateQueryKeys.views,
    queryFn: () => unwrap<CandidateViewRow[]>(listCandidateViews()),
  });
}

export function useRecordCandidateViewMutation() {
  const queryClient = useQueryClient();
  return useMutation<CandidateViewRow, Error, { candidateId: string }>({
    mutationFn: ({ candidateId }) =>
      unwrap<CandidateViewRow>(recordCandidateView(candidateId)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: candidateQueryKeys.views }),
  });
}

export function useCandidateQuery(candidateId: string) {
  return useQuery({
    queryKey: candidateQueryKeys.detail(candidateId),
    queryFn: () => unwrap<CandidateRow>(getCandidate(candidateId)),
    enabled: Boolean(candidateId),
  });
}

export function useProfilesQuery() {
  return useQuery({
    queryKey: candidateQueryKeys.profiles,
    queryFn: () => unwrap<ProfileRow[]>(listProfiles()),
  });
}

export function useApplicationsQuery() {
  return useQuery({
    queryKey: candidateQueryKeys.applications,
    queryFn: () => unwrap<ApplicationRow[]>(listApplications()),
  });
}

export function useCandidateExperiencesQuery(candidateId: string) {
  return useQuery({
    queryKey: candidateQueryKeys.experiences(candidateId),
    queryFn: () =>
      unwrap<CandidateExperienceRow[]>(listCandidateExperiences(candidateId)),
    enabled: Boolean(candidateId),
  });
}

export function useTagsQuery() {
  return useQuery({
    queryKey: candidateQueryKeys.tags,
    queryFn: () => unwrap<TagRow[]>(listTags()),
  });
}

export function useCandidateTagsQuery(candidateId: string) {
  return useQuery({
    queryKey: candidateQueryKeys.candidateTags(candidateId),
    queryFn: () => unwrap<CandidateTagRow[]>(listCandidateTags(candidateId)),
    enabled: Boolean(candidateId),
  });
}

export function useCreateCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation<CandidateRow, Error, CandidateInsert>({
    mutationFn: (values) => unwrap<CandidateRow>(createCandidate(values)),
    onSuccess: (candidate) => {
      queryClient.setQueryData(
        candidateQueryKeys.detail(candidate.id),
        candidate,
      );
      void queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.all,
        exact: true,
      });
    },
  });
}

export function useUpdateCandidateMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<CandidateRow, Error, CandidateUpdate>({
    mutationFn: (values: CandidateUpdate) =>
      unwrap<CandidateRow>(updateCandidate(candidateId, values)),
    onSuccess: (candidate) => {
      queryClient.setQueryData(
        candidateQueryKeys.detail(candidate.id),
        candidate,
      );
      void queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.all,
        exact: true,
      });
    },
  });
}

interface MoveCandidatePipelineVariables {
  candidateId: string;
  candidateStatus: CandidateStatus;
}

interface MoveCandidatePipelineContext {
  previousCandidates: CandidateRow[] | undefined;
}

export function useMoveCandidatePipelineMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    CandidateRow,
    Error,
    MoveCandidatePipelineVariables,
    MoveCandidatePipelineContext
  >({
    mutationFn: ({ candidateId, candidateStatus }) =>
      unwrap<CandidateRow>(
        updateCandidate(candidateId, { candidate_status: candidateStatus }),
      ),
    onMutate: async ({ candidateId, candidateStatus }) => {
      await queryClient.cancelQueries({ queryKey: candidateQueryKeys.all });
      const previousCandidates = queryClient.getQueryData<CandidateRow[]>(
        candidateQueryKeys.all,
      );
      queryClient.setQueryData<CandidateRow[]>(
        candidateQueryKeys.all,
        (candidates = []) =>
          candidates.map((candidate) =>
            candidate.id === candidateId
              ? { ...candidate, candidate_status: candidateStatus }
              : candidate,
          ),
      );
      return { previousCandidates };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCandidates) {
        queryClient.setQueryData(
          candidateQueryKeys.all,
          context.previousCandidates,
        );
      }
    },
    onSuccess: (candidate) => {
      queryClient.setQueryData<CandidateRow[]>(
        candidateQueryKeys.all,
        (candidates = []) =>
          candidates.map((item) =>
            item.id === candidate.id ? candidate : item,
          ),
      );
      queryClient.setQueryData(
        candidateQueryKeys.detail(candidate.id),
        candidate,
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.all,
        exact: true,
      }),
  });
}

export function useArchiveCandidateMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<CandidateRow, Error>({
    mutationFn: () => unwrap<CandidateRow>(archiveCandidate(candidateId)),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: candidateQueryKeys.detail(candidateId),
      });
      void queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.all,
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.archived,
      });
    },
  });
}

export function useRestoreCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation<CandidateRow, Error, string>({
    mutationFn: (candidateId) =>
      unwrap<CandidateRow>(restoreCandidate(candidateId)),
    onSuccess: (candidate) => {
      queryClient.setQueryData(
        candidateQueryKeys.detail(candidate.id),
        candidate,
      );
      void queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.all,
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.archived,
      });
    },
  });
}

export function useCompleteCandidateNextActionMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<CandidateRow, Error>({
    mutationFn: () =>
      unwrap<CandidateRow>(completeCandidateNextAction(candidateId)),
    onSuccess: (candidate) => {
      queryClient.setQueryData(
        candidateQueryKeys.detail(candidate.id),
        candidate,
      );
      void queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.all,
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: workQueryKeys.activities(candidateId),
      });
      void queryClient.invalidateQueries({
        queryKey: workQueryKeys.allActivities,
      });
    },
  });
}

export function useCreateCandidateExperienceMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<CandidateExperienceRow, Error, CandidateExperienceInsert>({
    mutationFn: (values) =>
      unwrap<CandidateExperienceRow>(createCandidateExperience(values)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.experiences(candidateId),
      }),
  });
}

export function useUpdateCandidateExperienceMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    CandidateExperienceRow,
    Error,
    { experienceId: string; values: CandidateExperienceUpdate }
  >({
    mutationFn: ({ experienceId, values }) =>
      unwrap<CandidateExperienceRow>(
        updateCandidateExperience(experienceId, values),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.experiences(candidateId),
      }),
  });
}

export function useArchiveCandidateExperienceMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<CandidateExperienceRow, Error, string>({
    mutationFn: (experienceId) =>
      unwrap<CandidateExperienceRow>(archiveCandidateExperience(experienceId)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.experiences(candidateId),
      }),
  });
}

export function useAttachCandidateTagMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<CandidateTagRow, Error, string>({
    mutationFn: (tagId) =>
      unwrap<CandidateTagRow>(
        attachCandidateTag({ candidate_id: candidateId, tag_id: tagId }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.candidateTags(candidateId),
      }),
  });
}

export function useCreateAndAttachCandidateTagMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<CandidateTagRow, Error, string>({
    mutationFn: async (name) => {
      const tag = await unwrap<TagRow>(createTag({ name }));
      return unwrap<CandidateTagRow>(
        attachCandidateTag({ candidate_id: candidateId, tag_id: tag.id }),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: candidateQueryKeys.tags });
      void queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.candidateTags(candidateId),
      });
    },
  });
}

export function useArchiveCandidateTagMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<CandidateTagRow, Error, string>({
    mutationFn: (candidateTagId) =>
      unwrap<CandidateTagRow>(archiveCandidateTag(candidateTagId)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.candidateTags(candidateId),
      }),
  });
}
