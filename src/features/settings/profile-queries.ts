import { useMutation, useQueryClient } from "@tanstack/react-query";

import { candidateQueryKeys } from "@/features/candidates/candidate-queries";
import {
  setProfileRole,
  updateOwnProfile,
} from "@/services/profiles-repository";
import {
  inviteUser,
  type UserInvitationInput,
} from "@/services/user-invitations-repository";
import type { ProfileRole, ProfileRow } from "@/types/database";

async function unwrap(
  promise: ReturnType<typeof updateOwnProfile>,
): Promise<ProfileRow> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function useUpdateOwnProfileMutation(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation<ProfileRow, Error, string>({
    mutationFn: (displayName) =>
      unwrap(updateOwnProfile(profileId, { display_name: displayName })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: candidateQueryKeys.profiles }),
  });
}

export function useSetProfileRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    ProfileRow,
    Error,
    { profileId: string; role: ProfileRole }
  >({
    mutationFn: ({ profileId, role }) =>
      unwrap(setProfileRole(profileId, role)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: candidateQueryKeys.profiles }),
  });
}

export function useInviteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation<true, Error, UserInvitationInput>({
    mutationFn: async (input) => {
      const result = await inviteUser(input);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: candidateQueryKeys.profiles,
        exact: true,
      }),
  });
}
