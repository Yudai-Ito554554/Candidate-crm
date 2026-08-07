# Supabase schema operations

## Local validation

Docker-compatible runtimeとSupabase CLIを用意し、リポジトリルートで実行します。

```sh
npm run supabase:check:local
```

準備確認が成功した後に次を実行します。

```sh
npx supabase start
npx supabase db reset
npx supabase status
npx supabase test db
```

`db reset`はローカルDBを削除してmigrationを先頭から適用します。リモートDBに対して実行しないでください。
`supabase/tests/000_schema_security.test.sql`は実DB上で主要スキーマ、`owner_id`外部キー、必須列、RLS、anon権限、サーバー専用テーブル、security invoker検索を検証します。GitHub Actionsでも隔離されたローカルSupabaseへ全migrationを再適用して実行します。

## Review checklist

1. SQL差分、外部キー、CHECK制約、インデックスをレビューする
2. 全テーブルのRLS有効化とanon拒否を確認する
3. public業務テーブルでDELETEが許可されていないことを確認する
4. `handle_new_user`が`security definer`かつ固定`search_path`であることを確認する
5. `auth.users`作成時のprofile生成をローカルで確認する
6. 業務テーブルの`owner_id`が`auth.users(id)`を参照していることを確認する
7. タグ名・タグ関連のactive重複が拒否されることを確認する
8. migration対象がローカルまたは非本番project refであることを確認する
9. バックアップと復元手順を確認する
10. `crm-files`が非公開・10MB制限で、StorageのSELECT/INSERT/補償DELETEポリシーが対象バケットに限定されていることを確認する
11. メール本文はクライアントからINSERT・UPDATE・DELETEできず、スレッド更新権限が`status`と`archived_at`だけに限定されていることを確認する
12. 選考ステータス履歴がDBトリガーで生成され、クライアントにはSELECT以外を許可していないことを確認する
13. 候補者閲覧履歴がユーザー単位のRLSで分離され、書き込みが`record_candidate_view` RPCだけに限定されていることを確認する
14. `viewer`の業務データ書き込みがRLSで拒否され、`admin`・`agent`だけが書き込めることを確認する
15. ロール変更がadmin限定RPC経由で、最後のadminを降格できないことを確認する
16. AI Summary本文をデスクトップからINSERT・UPDATE・DELETEできず、確認メタデータだけを更新できることを確認する
17. `search_crm`が`security invoker`であり、anonから実行できず、既存テーブルのRLSを迂回しないことを確認する
18. 候補者・企業・求人の部分一致検索で`pg_trgm`索引が利用され、アーカイブ済みレコードを返さないことを確認する
19. 重要テーブルの作成・更新が`audit_logs`へ記録され、本文や変更前後の値が複製されないことを確認する
20. 監査ログはadminだけが参照でき、authenticatedクライアントからINSERT・UPDATE・DELETEできないことを確認する
21. AI生成要求テーブルへデスクトップから直接アクセスできず、同一候補者の同時生成が一意制約で拒否されることを確認する
22. AI生成はadmin・agentのJWTだけを受け付け、氏名・連絡先・`private_notes`を入力へ含めず、`store: false`で実行することを確認する
23. AIサマリーの置換RPCはservice roleだけが実行でき、失敗時に直前のactiveサマリーが維持されることを確認する
24. プロフィール欠損時のロール変更がfail-closedで拒否され、同時実行でも最後のadminを降格できないことを確認する
25. 新規profileが`pending`となり、承認前は自分のprofile以外のCRMデータを参照できないことを確認する
26. 過去メールの初回取り込みでもスレッドの最終送信者・プレビュー・日時が更新されることを確認する

## Edge Function secrets and deployment

非本番project refを確認し、OpenAI APIキーだけをSupabase Secretへ設定します。レビュー済みモデルIDは各Edge Functionのサーバー側コードで固定し、`OPENAI_MODEL` SecretやVite環境変数では上書きしません。`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`はSupabase Edge Function環境から取得し、デスクトップアプリへコピーしません。

```sh
npx supabase secrets set OPENAI_API_KEY=<OPENAI_API_KEY>
npx supabase functions deploy generate-candidate-summary
npx supabase functions deploy extract-job-posting
npx supabase functions deploy get-ai-usage
```

3関数は`verify_jwt`を有効にしたまま配備します。配備後はDashboardまたはSupabase MCPで各関数が`ACTIVE`かつJWT検証有効であることを確認してください。

本番適用前に、匿名化、生成品質、求人票の根拠引用、拒否応答、タイムアウト、5分クールダウン、同時実行、旧サマリー保持、利用料金を非本番の架空データで評価してください。

ユーザー招待関数はSupabaseがEdge Functionへ提供するサーバー側環境変数だけを使用します。`verify_jwt`を有効にしたまま配備し、Supabase Dashboardの **Authentication → URL Configuration → Redirect URLs** に`candidate-crm://auth/callback`を追加してください。

```sh
npx supabase functions deploy invite-user
```

招待関数は呼び出し元のJWTと`profiles.role = 'admin'`を検証し、招待された利用者のロールをDBへ設定します。実在アドレスへの招待は外部送信とユーザー作成を伴うため、非本番の管理者アカウントから明示したテストアドレスで確認してください。

## Non-production remote application

リモート環境へ勝手に適用しません。レビュー後、担当者が対象を明示して実行します。

```sh
npx supabase link --project-ref <NON_PRODUCTION_PROJECT_REF>
npm run supabase:check:linked
npx supabase db diff --linked
npx supabase db push --dry-run
npx supabase db push
```

## Type generation

ローカルmigration適用後:

```sh
npx supabase gen types typescript --local > src/types/database.generated.ts
```

非本番linked環境から生成する場合:

```sh
npx supabase gen types typescript --linked > src/types/database.generated.ts
```

生成後は手動型との差分を確認し、`npm run typecheck`と`npm test`を実行します。

## Rollback and backup

Supabase migrationに自動rollbackはありません。適用済みmigrationを書き換えず、必要な修正は新しい順方向migrationとして追加します。破壊的変更前はSupabaseのバックアップ/PITR状態を確認し、非本番で復元手順を検証してください。

本番データをローカルseed、fixture、テストへコピーしてはいけません。
