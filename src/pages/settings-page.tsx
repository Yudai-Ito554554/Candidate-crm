import { ShieldCheck, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageIntro } from "@/components/common/page-intro";
import { SectionCard } from "@/components/common/section-card";
import { AuditLogPanel } from "@/components/settings/audit-log-panel";
import { AiUsagePanel } from "@/components/settings/ai-usage-panel";
import { TagManagementPanel } from "@/components/settings/tag-management-panel";
import { UserInvitationPanel } from "@/components/settings/user-invitation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/use-auth";
import { useProfilesQuery } from "@/features/candidates/candidate-queries";
import {
  profileFormSchema,
  profileRoleLabels,
  profileRoles,
} from "@/features/settings/profile-model";
import {
  useSetProfileRoleMutation,
  useUpdateOwnProfileMutation,
} from "@/features/settings/profile-queries";
import type { ProfileRole } from "@/types/database";

export function SettingsPage() {
  const { user } = useAuth();
  const profilesQuery = useProfilesQuery();
  const currentProfile = (profilesQuery.data ?? []).find(
    (profile) => profile.id === user?.id,
  );
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const updateProfile = useUpdateOwnProfileMutation(currentProfile?.id ?? "");
  const setRole = useSetProfileRoleMutation();

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);
    const formData = new FormData(event.currentTarget);
    const parsed = profileFormSchema.safeParse({
      displayName: formData.get("displayName"),
    });
    if (!parsed.success) {
      setFormMessage(
        parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
      );
      return;
    }
    try {
      await updateProfile.mutateAsync(parsed.data.displayName);
      setFormMessage("プロフィールを更新しました。");
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "プロフィールを更新できませんでした。",
      );
    }
  }

  function handleRoleChange(profileId: string, role: ProfileRole) {
    setRole.mutate(
      { profileId, role },
      {
        onError: () => undefined,
      },
    );
  }

  if (profilesQuery.isPending)
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        利用者情報を読み込んでいます…
      </p>
    );
  if (profilesQuery.error)
    return <EmptyState message={profilesQuery.error.message} />;
  if (!currentProfile)
    return (
      <EmptyState message="ログインユーザーのプロフィールが見つかりません" />
    );

  const isAdmin = currentProfile.role === "admin";

  return (
    <div>
      <PageIntro
        description="自分のプロフィールとチームのアクセス権限を管理します。"
        title="設定"
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <SectionCard title="自分のプロフィール">
            <form onSubmit={(event) => void handleProfileSubmit(event)}>
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-600">
                  表示名
                  <Input
                    aria-label="表示名"
                    className="mt-1"
                    defaultValue={currentProfile.display_name ?? ""}
                    maxLength={100}
                    name="displayName"
                  />
                </label>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    メールアドレス
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {currentProfile.email ?? user?.email ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">ロール</p>
                  <Badge
                    className="mt-1"
                    value={profileRoleLabels[currentProfile.role]}
                  />
                </div>
              </div>
              {formMessage ? (
                <p
                  aria-live="polite"
                  className="mt-3 text-sm text-slate-700"
                  role="status"
                >
                  {formMessage}
                </p>
              ) : null}
              <div className="mt-4 flex justify-end">
                <Button disabled={updateProfile.isPending} type="submit">
                  表示名を保存
                </Button>
              </div>
            </form>
          </SectionCard>

          <UserInvitationPanel isAdmin={isAdmin} />
        </div>

        <SectionCard
          description={
            isAdmin
              ? "管理者だけがロールを変更できます。"
              : "ロール変更は管理者へ依頼してください。"
          }
          title="チーム利用者"
        >
          <div className="mb-3 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <ShieldCheck aria-hidden="true" className="size-4 text-blue-700" />
            閲覧者はCRMデータを参照できますが、追加・変更・アーカイブはRLSで拒否されます。
          </div>
          {(profilesQuery.data ?? []).length ? (
            <div className="divide-y divide-slate-100">
              {(profilesQuery.data ?? []).map((profile) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                  key={profile.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <UsersRound
                        aria-hidden="true"
                        className="size-4 text-slate-600"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {profile.display_name ?? "表示名未設定"}
                        {profile.id === currentProfile.id ? "（自分）" : ""}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {profile.email ?? "メール未登録"}
                      </p>
                    </div>
                  </div>
                  {isAdmin ? (
                    <Select
                      aria-label={`${profile.display_name ?? profile.email ?? "利用者"}のロール`}
                      disabled={setRole.isPending}
                      onChange={(event) =>
                        handleRoleChange(
                          profile.id,
                          event.target.value as ProfileRole,
                        )
                      }
                      value={profile.role}
                    >
                      {profileRoles.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge value={profileRoleLabels[profile.role]} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="利用者が登録されていません" />
          )}
          {setRole.error ? (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {setRole.error.message}
            </p>
          ) : null}
        </SectionCard>
      </div>
      <div className="mt-4">
        <TagManagementPanel />
      </div>
      {isAdmin ? (
        <AiUsagePanel
          currentUserId={currentProfile.id}
          profiles={profilesQuery.data ?? []}
        />
      ) : null}
      {isAdmin ? <AuditLogPanel profiles={profilesQuery.data ?? []} /> : null}
    </div>
  );
}
