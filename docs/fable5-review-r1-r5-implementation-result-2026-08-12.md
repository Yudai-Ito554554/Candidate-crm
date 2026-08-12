# Candidate CRM Fable 5再レビュー依頼: Batch 1 R1〜R5実装結果

作成日: 2026-08-12

対象リポジトリ: `Yudai-Ito554554/Candidate-crm`

レビュー対象ブランチ: `fable5-review-fixes`

比較元: `main` (`1fe0679`)

実装完了HEAD: `44fbf9a2e4fd5ee4c0b68aecfcaad5a3848087d6`

## 1. 役割分担

この文書は、Fable 5へ設計とセキュリティレビューを依頼するための資料です。

- **Codex**: コード、SQLテスト、運用文書の実装・修正、検証、commit、pushを担当する
- **Fable 5**: 設計提案、設計書の作成・更新、セキュリティレビュー、Codexの実装差分のレビューを担当する

Fable 5にはコード修正、migration作成、commit、push、Supabase操作を依頼しません。修正が必要な場合は、問題、設計方針、セキュリティ境界、Codex用の受け入れ条件を提示してください。

## 2. レビュー対象

Fable 5の2026-08-12再レビューで推奨されたR1〜R5をCodexが実装しました。

レビュー用差分:

<https://github.com/Yudai-Ito554554/Candidate-crm/compare/0e02ad4...44fbf9a>

対象commit:

| Commit    | 内容                                                |
| --------- | --------------------------------------------------- |
| `44b4b1c` | Codex / Fable 5の役割分担とBatch 1検証資料の文書化  |
| `6122e11` | suspendedのJWT・Storage・SECURITY DEFINER検証を追加 |
| `44fbf9a` | `pending`を初回承認待ち専用にし、停止運用を文書化   |

`main`、production、stagingには変更を行っていません。

## 3. R1: JWTエミュレーションの版数耐性

`supabase/tests/001_batch1_account_lifecycle.test.sql`に`pg_temp.set_authenticated_user(uuid)`を追加しました。

このヘルパーは、同じ利用者IDについて以下の両方をtransaction localで設定します。

- `request.jwt.claim.sub`
- `request.jwt.claims` JSON (`sub`と`role = authenticated`)

既存のadmin、suspended、pendingのテストはすべてこのヘルパーを経由するように統一しました。

## 4. R2: Storageのsuspended遮断テスト

bucket `crm-files`にadmin所有のfixture objectを作成し、suspended利用者について次を実行時検証しました。

- `storage.objects`のSELECT結果が0件
- `storage.objects`へのINSERTがSQLSTATE `42501`で拒否

Storageポリシー自体は変更していません。既存の許可リスト方式RLSがsuspendedを遮断することの証跡を追加しただけです。

## 5. R3: SECURITY DEFINER関数の内部ロール検証

suspended利用者として`public.record_candidate_view(candidate_id)`を呼び出し、関数内の許可ロール検証によって次の内容で拒否されることを追加しました。

- SQLSTATE: `42501`
- message: `approved workspace membership required`

RLSだけでなく、SECURITY DEFINER関数の内部検証が防衛線として動作することを固定しています。

## 6. R4: 利用者停止の運用手順

`docs/production-release-runbook.md`に利用者停止手順を追加しました。

1. Candidate CRM管理画面から`set_profile_role` RPC経由で`suspended`へ変更
2. 対象のメールアドレスとユーザーIDを照合
3. Supabase Auth管理者機能でbanまたはセッション失効を実施

`suspended`によるRLS遮断とAuthセッション失効は別操作であることも明記しました。統合管理機能の実装はBatch 4以降です。

## 7. R5: pendingの定義

次の設計に確定しました。

- `pending`は初回承認待ち専用
- 承認済み利用者の停止は`suspended`
- 通常の管理UIの変更先に`pending`を表示しない
- 現在pendingの利用者には、現状を示すdisabledの`pending`選択肢だけを表示する
- DBの`set_profile_role`は後方互換性のためpendingを引き続き許容する

回帰テストで、次を確認しています。

- viewerなど承認済み利用者のロール選択肢にpendingがない
- pending利用者の現在値はpendingとして表示される
- pendingの現在値は選択できない
- suspendedへの変更は従来どおりRPC経由で実行される

## 8. 検証結果

### 8.1 ローカル検証

| チェック               | 結果                    |
| ---------------------- | ----------------------- |
| `npm run format:check` | 成功                    |
| `npm run typecheck`    | 成功                    |
| `npm run lint`         | 成功                    |
| `npm test`             | 成功、65ファイル・342件 |
| `npm run build`        | 成功                    |
| `npm run verify:repo`  | 成功                    |
| `git diff --check`     | 成功                    |

### 8.2 GitHub Actions

CI Run:

<https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31548793501>

| ジョブ                               | 結果 | 所要時間 |
| ------------------------------------ | ---- | -------- |
| Quality checks (macos-latest)        | 成功 | 2分46秒  |
| Quality checks (windows-latest)      | 成功 | 7分10秒  |
| Supabase migration and policy checks | 成功 | 2分47秒  |

Supabaseジョブでは、次が成功しました。

- 隔離されたローカルSupabaseの起動
- クリーンDBへの全migration再適用
- 既存pgTAPとR1〜R3の新規3件
- Supabaseの停止

## 9. 不変のセキュリティ境界

- service role keyをVite/Tauriクライアントに入れない
- 業務データへのアクセス制御はRLSを正とする
- 管理者ロール変更は`set_profile_role` RPCだけを使用する
- suspendedとpendingは業務データの許可リストに含めない
- SECURITY DEFINER関数は関数内で利用者ロールを再検証する
- production/stagingに代替接続してテストしない
- クライアント側の表示制御だけを権限境界にしない

## 10. Fable 5へのレビュー依頼

次の点をレビューしてください。

1. R1の共通ヘルパーがPostgREST / Supabase CLIの版数差に対して十分か
2. R2のStorage SELECT / INSERTテストが実際のRLS境界を正しく証明しているか
3. R3のSECURITY DEFINER関数テストがバイパス防止の証跡として十分か
4. R4の運用手順がRLS遮断とAuth失効の役割を正しく分離できているか
5. R5のpending定義、UI制約、DB後方互換性の組み合わせが妥当か
6. Batch 1を`main`へマージする前に必須修正が残っていないか
7. Batch 2の自動バックアップ設計に開始条件・セキュリティ境界の追加が必要か

回答は次の形式でお願いします。

1. 必須修正
2. 推奨修正
3. 将来対応
4. Codexが実装する場合の受け入れ条件
5. `main`マージのGo / No-Go
6. Batch 2設計開始のGo / No-Go

Fable 5が実装するのではなく、設計書またはレビュー結果として提示してください。実装が必要な場合はCodexが対応します。

## 11. 未実施・スコープ外

- `main`へのマージ
- Batch 2の実装
- production / stagingへの接続・適用
- production migration
- Auth ban / session revokeのアプリ内統合実装
- MacローカルDocker上でのSupabase reset / pgTAP
