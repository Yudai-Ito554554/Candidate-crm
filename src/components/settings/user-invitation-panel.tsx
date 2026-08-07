import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { userInvitationSchema } from "@/features/settings/profile-model";
import { useInviteUserMutation } from "@/features/settings/profile-queries";

export function UserInvitationPanel({ isAdmin }: { isAdmin: boolean }) {
  const invite = useInviteUserMutation();
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const parsed = userInvitationSchema.safeParse({
      email: formData.get("inviteEmail"),
      displayName: formData.get("inviteDisplayName"),
      role: formData.get("inviteRole"),
    });
    if (!parsed.success) {
      setMessage(
        parsed.error.issues[0]?.message ?? "招待内容を確認してください。",
      );
      return;
    }
    try {
      await invite.mutateAsync(parsed.data);
      form.reset();
      setMessage("招待メールを送信しました。");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "招待メールを送信できませんでした。",
      );
    }
  }

  return (
    <SectionCard
      description={
        isAdmin
          ? "招待された利用者はメール内のリンクから初回パスワードを設定します。"
          : "ユーザー招待は管理者へ依頼してください。"
      }
      title="ユーザー招待"
    >
      {!isAdmin ? (
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <UserPlus aria-hidden="true" className="mt-0.5 size-5" />
          管理者だけが新しい利用者を招待できます。
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-600">
              メールアドレス
              <Input
                autoComplete="off"
                className="mt-1"
                name="inviteEmail"
                placeholder="agent@example.com"
                type="email"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              表示名（任意）
              <Input
                autoComplete="off"
                className="mt-1"
                maxLength={100}
                name="inviteDisplayName"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              ロール
              <Select className="mt-1 w-full" name="inviteRole">
                <option value="agent">エージェント</option>
                <option value="viewer">閲覧者</option>
              </Select>
            </label>
          </div>
          {message ? (
            <p
              aria-live="polite"
              className={
                invite.isError
                  ? "mt-3 text-sm text-rose-700"
                  : "mt-3 text-sm text-slate-700"
              }
              role={invite.isError ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <Button
              className="gap-1.5"
              disabled={invite.isPending}
              type="submit"
            >
              <UserPlus aria-hidden="true" className="size-4" />
              {invite.isPending ? "送信中…" : "招待メールを送信"}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}
