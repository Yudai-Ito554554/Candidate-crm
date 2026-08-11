# Candidate CRM Fable 5設計・レビュー依頼: Batch 1検証結果

作成日: 2026-08-12

対象リポジトリ: `Yudai-Ito554554/Candidate-crm`

レビュー対象ブランチ: `fable5-review-fixes`

比較元: `main` (`1fe0679`)
レビュー対象HEAD: `0e02ad43a332b82f40b1576b5604db5169f3c5bd`

## 1. 役割分担

この文書は、Fable 5へ設計とレビューを依頼するための資料です。

- **Codex**: コード・migration・テスト・文書の実装、修正、検証、commit、pushを担当する
- **Fable 5**: 設計提案、設計書の作成・更新、セキュリティレビュー、実装差分のレビューを担当する

Fable 5にはコード変更、migration作成、commit、push、Supabase操作などの実装作業を依頼しません。レビューで修正が必要になった場合は、Fable 5が設計上の問題・リスク・受け入れ条件を示し、Codexが実装します。

## 2. 設計・レビュー依頼

Batch 1としてCodexが実装した次の変更について、設計・セキュリティの正式な再レビューをお願いします。

- `suspended`ロールと利用停止画面
- suspended・pendingユーザーのRLS遮断
- 最終管理者の停止・降格防止
- `auth.users.email`から`profiles.email`への同期
- Authメール以外の更新で同期処理を発火させない制御
- 実行時pgTAPテスト
- HANDOFFとFable 5対応計画の整合

レビュー用差分:

<https://github.com/Yudai-Ito554554/Candidate-crm/compare/main...fable5-review-fixes>

Fable 5には次の形式での回答を依頼します。

1. 設計上の問題とリスク
2. セキュリティ上の問題とリスク
3. 必須修正・推奨修正・将来対応の分類
4. Codexが実装するための具体的な受け入れ条件
5. Batch 2以降へ進んでよいかのGo / No-Go判断
6. 必要であれば、実装コードではなく設計書または変更仕様書

## 3. 変更commit

| Commit    | 内容                                         |
| --------- | -------------------------------------------- |
| `e73f0f8` | アカウント停止とプロフィールメール同期の実装 |
| `76f789c` | Authメール同期トリガーの構造テスト           |
| `11d6495` | Batch 1アカウントライフサイクルの実行時pgTAP |
| `75a7646` | HANDOFF・レビュー対応計画の整合              |
| `0e02ad4` | suspended UPDATE検証のpgTAP構文修正          |

`main`へのcommit・push、force push、production・stagingへの接続や変更は行っていません。

## 4. 主な変更ファイル

- `supabase/migrations/20260811124525_add_suspended_profile_role.sql`
- `supabase/migrations/20260811124746_sync_profile_email_from_auth.sql`
- `supabase/tests/001_batch1_account_lifecycle.test.sql`
- `src/components/layout/app-layout.tsx`
- `src/components/layout/app-layout.test.tsx`
- `src/features/settings/profile-model.ts`
- `src/types/database.ts`
- `src/test/profile-role-permissions.test.ts`
- `src/pages/app-routes.test.tsx`
- `HANDOFF.md`
- `docs/fable5-review-action-plan-2026-08-11.md`
- `docs/fable5-review-brief-2026-08-11.md`

## 5. Supabase検証結果

### 5.1 Macローカル環境

`npm run supabase:check:local`は失敗しました。

確認された不足:

- Docker互換ランタイムが起動していない
- ローカル用`.env`がない
- ローカルSupabase URLとpublishable keyが未設定

staging・productionへ代替接続せず、ローカルでの`supabase reset`とpgTAPは実行していません。

### 5.2 GitHub Actionsの隔離環境

GitHub ActionsのローカルSupabase環境では次の処理がすべて成功しました。

- Supabase起動
- クリーンDBへの全migration再適用
- pgTAP database tests
- Supabase停止

CI Run:

<https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31543641852>

## 6. セキュリティ自己チェック

### 6.1 suspendedロール

- [x] `profiles_role_check`は`pending / admin / agent / viewer / suspended`の5値
- [x] `set_profile_role`の許可値へ`suspended`を追加
- [x] `pg_advisory_xact_lock(20260806000900)`を維持
- [x] 最後の管理者を`suspended`へ変更するとSQLSTATE `23514`で拒否
- [x] migrationによるRLSポリシーの追加・変更・削除なし
- [x] 関数権限のREVOKEを維持

### 6.2 suspended・pendingのRLS

- [x] suspendedは候補者をSELECTできない
- [x] suspendedは候補者をINSERTできない
- [x] suspendedによる候補者UPDATEは反映されない
- [x] suspendedは自分のプロフィールのみ参照できる
- [x] pendingは候補者をSELECT・INSERTできない
- [x] pendingは自分のプロフィールのみ参照できる

### 6.3 Authメール同期

- [x] `AFTER UPDATE OF email ON auth.users`
- [x] `OLD.email IS DISTINCT FROM NEW.email`のWHEN句あり
- [x] `SECURITY DEFINER`と固定`search_path`
- [x] 関数本体に明示的なRAISE処理なし
- [x] `public / anon / authenticated`から関数実行権限をREVOKE
- [x] 既存不整合行のbackfillあり
- [x] Authメール変更時に`profiles.email`が追随
- [x] メール以外のAuth更新ではプロフィール更新監査ログが増えない

### 6.4 既知の副作用

メール同期トリガーによるプロフィール更新はsystem operationとして扱われ、監査ログの`actor_id`がnullになります。これはBatch 4の監査actor設計で扱う既知事項として記録し、Batch 1では変更していません。

## 7. フロントエンド確認

- [x] TypeScriptの`ProfileRole`へ`suspended`を追加
- [x] ロール表示は`Record<ProfileRole, string>`で網羅性をコンパイル時に検証
- [x] suspendedをpendingへフォールバックさせない
- [x] 停止画面には案内文・アカウントメール・ログアウトだけを表示
- [x] suspended画面で業務データやナビゲーションを描画しない
- [x] 管理者のロール変更は`set_profile_role` RPC経由
- [x] `invite-user`の許可ロールは`agent / viewer`のまま

## 8. 品質チェック

| チェック                    | 結果                    |
| --------------------------- | ----------------------- |
| `npm run format`            | 成功                    |
| `npm run format:check`      | 成功                    |
| `npm run typecheck`         | 成功                    |
| `npm run lint`              | 成功                    |
| `npm test`                  | 成功、65ファイル・342件 |
| `npm run build`             | 成功                    |
| `npm run verify:repo`       | 成功                    |
| `git diff --check`          | 成功                    |
| macOS Tauri backend check   | 成功                    |
| Windows Tauri backend check | 成功                    |
| clean DB migration checks   | 成功                    |
| pgTAP database tests        | 成功                    |

CI結果:

| ジョブ                               | 結果 | 所要時間 |
| ------------------------------------ | ---- | -------- |
| Quality checks (macos-latest)        | 成功 | 2分12秒  |
| Quality checks (windows-latest)      | 成功 | 5分28秒  |
| Supabase migration and policy checks | 成功 | 2分50秒  |

## 9. CIで発見・修正した問題

最初のCIでは、データ変更CTEをpgTAP関数の引数内に置いたため、PostgreSQLの次の構文エラーが発生しました。

```text
WITH clause containing a data-modifying statement must be at the top level
```

RLS実装の不具合ではありません。suspendedとしてUPDATEを実行した後、権限を戻して対象値が変更されていないことを検証する方式へ修正しました。修正後のCIは全ジョブ成功しています。

## 10. Fable 5に確認してほしい論点

1. suspendedを既存の許可リスト方式RLSから自然に除外する設計で問題ないか
2. suspendedユーザーへ自分のプロフィールだけを見せる境界が適切か
3. 最終管理者保護が停止・降格の両方を十分に防いでいるか
4. Authメール同期トリガーの権限・`search_path`・例外影響が安全か
5. メール同期による`actor_id = null`の監査ログをBatch 4へ送る判断が妥当か
6. Batch 2以降へ進む前に追加すべきセキュリティテストがあるか
7. 次のBatchについて、Codexが実装に使える設計書・受け入れ条件を提示できるか

Fable 5からコード修正案がある場合も、直接実装するのではなく、対象ファイル、問題箇所、期待する挙動、セキュリティ境界、必要なテストをレビューコメントまたは設計書として提示してください。

## 11. 未実施・スコープ外

- MacローカルDocker上でのSupabase reset・pgTAP
- Batch 2以降
- staging実アカウントUAT
- productionへのmigration適用
- `main`へのマージ

production適用条件は`docs/fable5-review-action-plan-2026-08-11.md`の6節を正とします。
