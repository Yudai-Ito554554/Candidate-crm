import { useAuth } from "@/features/auth/use-auth";
import { useProfilesQuery } from "@/features/candidates/candidate-queries";

export function useAccess() {
  const { user } = useAuth();
  const profilesQuery = useProfilesQuery();
  const profile = (profilesQuery.data ?? []).find(
    (item) => item.id === user?.id,
  );

  return {
    profile,
    role: profile?.role ?? null,
    canWrite: profile?.role === "admin" || profile?.role === "agent",
    isAdmin: profile?.role === "admin",
    isPending: profilesQuery.isPending,
    error: profilesQuery.error,
  };
}
