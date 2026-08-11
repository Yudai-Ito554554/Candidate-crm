import { z } from "zod";

import type { ProfileRole } from "@/types/database";

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください。")
    .max(100, "表示名は100文字以内で入力してください。"),
});

export const userInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .email("有効なメールアドレスを入力してください。")
    .max(254, "メールアドレスは254文字以内で入力してください。"),
  displayName: z
    .string()
    .trim()
    .max(100, "表示名は100文字以内で入力してください。"),
  role: z.enum(["agent", "viewer"]),
});

export const profileRoleLabels: Record<ProfileRole, string> = {
  pending: "承認待ち",
  suspended: "停止済み",
  admin: "管理者",
  agent: "エージェント",
  viewer: "閲覧者",
};

const assignableProfileRoleValues = [
  "admin",
  "agent",
  "viewer",
  "suspended",
] as const satisfies readonly Exclude<ProfileRole, "pending">[];

export const profileRoles = assignableProfileRoleValues.map(
  (role) => [role, profileRoleLabels[role]] as const,
);
