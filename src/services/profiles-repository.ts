import {
  executePaginatedSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type { ProfileRole, ProfileRow, ProfileUpdate } from "@/types/database";

export function listProfiles(): Promise<RepositoryResult<ProfileRow[]>> {
  return executePaginatedSelect<ProfileRow>((client, from, to) =>
    client
      .from("profiles")
      .select("*")
      .order("display_name")
      .order("id")
      .range(from, to),
  );
}

export function updateOwnProfile(
  profileId: string,
  values: ProfileUpdate,
): Promise<RepositoryResult<ProfileRow>> {
  return executeSingle<ProfileRow>((client) =>
    client
      .from("profiles")
      .update(values)
      .eq("id", profileId)
      .select("*")
      .single(),
  );
}

export function setProfileRole(
  profileId: string,
  role: ProfileRole,
): Promise<RepositoryResult<ProfileRow>> {
  return executeSingle<ProfileRow>((client) =>
    client
      .rpc("set_profile_role", {
        target_user_id: profileId,
        new_role: role,
      })
      .single(),
  );
}
