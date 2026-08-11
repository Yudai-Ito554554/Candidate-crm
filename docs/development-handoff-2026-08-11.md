# Candidate CRM 作業引き継ぎ（2026-08-11、PCシャットダウン前チェックポイント）

このドキュメントは、PCを安全にシャットダウンするために作成したチェックポイントです。秘密情報（パスワード、APIキー、接続文字列の値）は一切記録していません。

## 現在の位置

- branch: `main`
- このチェックポイントでcommitするHEAD（予定）: 本ドキュメント作成直前は`b5562d801d729f3d593fb498a6a1b94bbe2deecb`（commit `b5562d8`、`fix: show staging badge on gated auth screens`）。本チェックポイント作業で新規commitを1つ追加し`origin/main`へpushする。
- 「STAGING独立アプリ化」の実装・ローカル検証・必須チェックはすべて完了したため、**checkpointブランチではなくmainへ直接commitする**（詳細は下記）。

## 完了した工程（このセッション内、時系列）

1. `docs/production-release-runbook.md`・`docs/production-go-no-go-checklist.md`の作成、レビュー反映（複数回）
2. 本番セキュリティmigration2件（`email_threads`/`files`列権限）の内容確定・Runbook整備（commit履歴上は`d7f3c44`以降、ユーザー本人が本番Stage 1〜3を別途実施・記録）
3. `feat: distinguish staging environment in the UI`（commit `369c956`）: `VITE_APP_ENV`導入、`EnvironmentBadge`コンポーネント
4. Desktop QA artifacts手動実行・macOS成果物のダウンロード・SHA256/codesign検証・DMG起動確認（複数回）
5. Stage 3権限UATの一部として、pendingテストユーザー`uat-pending@example-uat.invalid`をstaging（`admjgbfrfoczpxdtxmgy`）に作成（ロールはデフォルトの`pending`のまま）
6. UAT中に発見: pendingユーザー向け画面（利用承認待ち・アクセス権限確認中）とログイン確認中画面でSTAGINGバッジが表示されない不具合
7. `fix: show staging badge on gated auth screens`（commit `b5562d8`、push済み）で修正。回帰テスト5件追加。通常CI・Desktop QA artifactsとも成功確認済み
8. 「Candidate CRM STAGINGを本番版と共存できる独立アプリにする」実装・ローカル検証（本チェックポイントの主題、完了。詳細は次項）

## CI・QA成果物URL

- 通常CI（commit `b5562d8`）: <https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31433816989>（成功）
- Desktop QA artifacts（commit `b5562d8`、独立アプリ化前）: <https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31438901217>（成功、`candidate-crm-macos-unsigned`・`candidate-crm-windows-unsigned`を生成）
- 本チェックポイントでpushするcommit（独立アプリ化後）のCI・Desktop QA artifactsは**まだ実行していない**。次回、push後に手動実行して最終確認する。

## stagingとproductionの区別（現状の実装）

- `VITE_APP_ENV`（`staging`/`production`）をビルド時に注入し、`EnvironmentBadge`コンポーネントでUI上に「STAGING」バッジを表示（productionでは非表示）。ログイン画面、パスワード関連画面、アプリ全体のヘッダー、承認待ち画面、確認中画面に表示済み。
- **今回追加**: `src-tauri/tauri.staging.conf.json`により、staging QAビルドはアプリ名・バンドルidentifier・ウィンドウタイトルも本番版と別になった（下記参照）。UI上のバッジに加えて、アプリそのものが別アプリとして区別できる。
- production向けビルドは別途`docs/production-release-runbook.md`の手順（RC1をgit worktreeで隔離し、`VITE_APP_ENV=production`を設定、通常の`tauri.conf.json`のまま）に従う。

## Stage 3 UATの完了・未完了項目（`docs/production-go-no-go-checklist.md`参照）

現時点でS3-2・S3-3・S3-4・S3-8は**すべて未チェック（☐）のまま**（本チェックポイントでは更新していない）。裏付けとして自動回帰テストは通っているが、**実際のstaging QAビルドへ実ログインしての画面確認はまだ未実施**。

| 項目                                    | 状態     | 根拠                                                      |
| --------------------------------------- | -------- | --------------------------------------------------------- |
| S3-2（viewer: 書き込み/AI生成UI非表示） | ☐ 未確認 | 自動回帰テストのみ確認済み。実ログイン未実施              |
| S3-3（viewer: 編集URL直接アクセス拒否） | ☐ 未確認 | 自動回帰テストのみ確認済み。実ログイン未実施              |
| S3-4（pending: 業務データ非表示）       | ☐ 未確認 | 自動回帰テストのみ確認済み。実ログイン未実施              |
| S3-8（admin限定機能）                   | ☐ 未確認 | DBレベルRLS・自動回帰テストのみ確認済み。実ログイン未実施 |

## pendingユーザー確認結果

- staging（`admjgbfrfoczpxdtxmgy`）に`uat-pending@example-uat.invalid`を作成済み（ロールは自動で`pending`、変更していない）。
- このユーザーでの実際のログイン確認（S3-4の実地検証）は、STAGINGバッジ不具合の発見・修正、続く独立アプリ化作業に工程が移ったため、**まだ完了していない**。
- 次回再開時は、まずこのpendingユーザーで最新のstaging独立アプリ版（次回Desktop QA artifacts実行後の`candidate-crm-staging-macos-unsigned`）にログインし、S3-2〜S3-4・S3-8を1つずつ確認して`docs/production-go-no-go-checklist.md`へ証跡を記録する。

## 今回完了: 「Candidate CRM STAGINGを独立アプリ化する」

### 実装内容（本チェックポイントでcommit予定、4ファイル＋本ドキュメント）

- `src-tauri/tauri.staging.conf.json`（新規）: `productName: "Candidate CRM STAGING"`、`identifier: "com.candidatecrm.desktop.staging"`、`app.windows[0].title: "Candidate CRM STAGING"`。RFC 7396 JSON Merge Patchの仕様上、配列は丸ごと置換されるため、`windows`配列は本体の全フィールドを複製した上でtitleだけ変更している。
- `src-tauri/tauri.conf.json`（本番用）: **変更なし**（productName/identifierとも従来通り）。
- `.github/workflows/desktop-artifacts.yml`:
  - ビルドコマンドを`npm run tauri build -- --config src-tauri/tauri.staging.conf.json`に変更
  - `artifact_name`を`candidate-crm-staging-macos-unsigned`/`candidate-crm-staging-windows-unsigned`に変更
  - macOS/Windows双方のINSTALL.txtに「Candidate CRM STAGING」「本番版とは別アプリ」である旨を明記
- テスト追加:
  - `src/test/tauri-staging-config.test.ts`（新規、3件）: staging設定のproductName/identifier/window titleと、production設定が変更されていないことを検証
  - `src/test/desktop-artifact-workflow.test.ts`（既存拡張、1件追加）: workflowのbuild引数・artifact_name・INSTALL.txt文言を検証

### ローカル検証結果（すべて完了）

- `npm run tauri build -- --config src-tauri/tauri.staging.conf.json`をローカルで実行し、`.app`/`.dmg`とも生成成功。
  - `CFBundleIdentifier` = `com.candidatecrm.desktop.staging`、`CFBundleName` = `Candidate CRM STAGING`をInfo.plistで確認済み
  - 初回ビルドは`bundle_dmg.sh`のDMG生成ステップで失敗（原因未特定、ローカル環境固有の可能性）。マウントされたままの一時DMGを手動でアンマウント・削除してから再実行し、2回目は成功
- **共存確認（実施済み）**: 別途ダウンロード済みだった本番名相当のQA成果物（`Candidate CRM.app`、identifier `com.candidatecrm.desktop`）と、今回のstaging版（`Candidate CRM STAGING.app`、identifier `com.candidatecrm.desktop.staging`）を両方`/Applications`へ配置し、名前・identifierとも衝突せず共存できることを確認。確認後、検証用にコピーした2つとも削除し、`/Applications`を元の状態へ戻した（ユーザー本人が別途配置している`Candidate CRM Production RC1.app`は対象外、変更していない）。
- Windows側（NSIS/MSIのproductName・identifier反映）は**ローカル検証不可**（Windows環境なし）。push後にDesktop QA artifactsを実行し、Windows成果物のファイル名・INSTALL.txtで確認する必要がある。

### 必須チェック結果（すべて成功）

| チェック               | 結果                                                      |
| ---------------------- | --------------------------------------------------------- |
| `npm run format`       | 成功                                                      |
| `npm run format:check` | 成功                                                      |
| `npm run typecheck`    | 成功                                                      |
| `npm run lint`         | 成功                                                      |
| `npm test`             | 成功（61ファイル / 320件）                                |
| `npm run build`        | 成功                                                      |
| `npm run verify:repo`  | 成功（本ドキュメント内の絶対パス混入を1件検出・修正済み） |

### 次回再開時にやること

1. push後、通常CIとDesktop QA artifactsを実行し、特にWindows成果物のproductName/identifier反映を確認する。
2. `uat-pending@example-uat.invalid`で最新のstaging独立アプリ版にログインし、Stage 3 UAT（S3-2・S3-3・S3-4・S3-8）を実施、`docs/production-go-no-go-checklist.md`へ証跡を記録する。
3. 同様にviewer（`uat-viewer@example-uat.invalid`）・admin（`uat-admin@example-uat.invalid`）でもS3-2/S3-3/S3-8を実施する。

```sh
# リポジトリルートで実行する
git status
git log --oneline -5
gh run list --branch main --limit 3
```

## 秘密情報の扱い

このドキュメント、および本チェックポイントでcommitする内容には、パスワード・APIキー・接続文字列・`.env.local`の値を一切含めていません。stagingテストユーザー（`uat-admin`/`uat-agent`/`uat-viewer`/`uat-pending`、いずれも`@example-uat.invalid`の架空アドレス）のパスワードは、このドキュメントとは別に、過去のチャット履歴でのみ共有されています。
