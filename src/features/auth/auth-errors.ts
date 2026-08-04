const knownMessages: Record<string, string> = {
  "Invalid login credentials":
    "メールアドレスまたはパスワードが正しくありません。",
  "Email not confirmed": "メールアドレスの確認が完了していません。",
  "Too many requests":
    "ログイン試行回数が多すぎます。しばらく待ってから再度お試しください。",
};

export function translateAuthError(
  message: string | undefined,
  fallback: string,
): string {
  if (!message) return fallback;

  const exactMessage = knownMessages[message];
  if (exactMessage) return exactMessage;

  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("fetch")) {
    return "認証サーバーへ接続できません。ネットワーク接続を確認してください。";
  }

  if (normalizedMessage.includes("rate limit")) {
    return knownMessages["Too many requests"];
  }

  return fallback;
}
