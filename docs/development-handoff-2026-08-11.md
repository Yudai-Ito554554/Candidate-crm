# Candidate CRM 作業引き継ぎ（2026-08-11、PCシャットダウン前チェックポイント）

このドキュメントは、PCを安全にシャットダウンするために作成したチェックポイントです。秘密情報（パスワード、APIキー、接続文字列の値）は一切記録していません。

## 現在の位置

- branch: `main`
- 現在の検証対象HEAD: `beb843d6c61e185a0ea4381988de069e4a4672d1`（commit `beb843d`、`docs: format development handoff`）。staging独立アプリ化はcommit `280731b`で完了済み。
- 「STAGING独立アプリ化」の実装・ローカル検証・必須チェックはすべて完了したため、**checkpointブランチではなくmainへ直接commitする**（詳細は下記）。

## 完了した工程（このセッション内、時系列）

1. `docs/production-release-runbook.md`・`docs/production-go-no-go-checklist.md`の作成、レビュー反映（複数回）
2. 本番セキュリティmigration2件（`email_threads`/`files`列権限）の内容確定・Runbook整備（commit履歴上は`d7f3c44`以降、ユーザー本人が本番Stage 1〜3を別途実施・記録）
3. `feat: distinguish staging environment in the UI`（commit `369c956`）: `VITE_APP_ENV`導入、`EnvironmentBadge`コンポーネント
4. Desktop QA artifacts手動実行・macOS成果物のダウンロード・SHA256/codesign検証・DMG起動確認（複数回）
5. Stage 3権限UATの一部として、pendingテストユーザー`uat-pending@example-uat.invalid`をstaging（`admjgbfrfoczpxdtxmgy`）に作成（ロールはデフォルトの`pending`のまま）
6. UAT中に発見: pendingユーザー向け画面（利用承認待ち・アクセス権限確認中）とログイン確認中画面でSTAGINGバッジが表示されない不具合
7. `fix: show staging badge on gated auth screens`（commit `b5562d8`、push済み）で修正。回帰テスト5件追加。通常CI・Desktop QA artifactsとも成功確認済み
8. 「Candidate CRM STAGINGを本番版と共存できる独立アプリにする」実装・ローカル検証（commit `280731b`、完了。詳細は次項）
9. commit `280731b`のCIで引き継ぎ文書のPrettier違反を検出し、commit `beb843d`で文書のみ修正。通常CIの3ジョブとDesktop QA artifactsのmacOS/Windows両ジョブが成功
10. 最新のstaging独立アプリ（commit `beb843d`）でadmin・viewer・agentの実ログインUATを実施。admin限定設定の表示、viewerの書き込み/AI生成UI非表示、agentの候補者関連タスク作成・完了を確認

## CI・QA成果物URL

- 通常CI（commit `b5562d8`）: <https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31433816989>（成功）
- Desktop QA artifacts（commit `b5562d8`、独立アプリ化前）: <https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31438901217>（成功、`candidate-crm-macos-unsigned`・`candidate-crm-windows-unsigned`を生成）
- 通常CI（commit `beb843d`）: <https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31455935492>（macOS・Windows・Supabaseの3ジョブすべて成功）
- Desktop QA artifacts（commit `beb843d`）: <https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31456232108>（macOS・Windowsとも成功、`candidate-crm-staging-macos-unsigned`・`candidate-crm-staging-windows-unsigned`を生成）

## stagingとproductionの区別（現状の実装）

- `VITE_APP_ENV`（`staging`/`production`）をビルド時に注入し、`EnvironmentBadge`コンポーネントでUI上に「STAGING」バッジを表示（productionでは非表示）。ログイン画面、パスワード関連画面、アプリ全体のヘッダー、承認待ち画面、確認中画面に表示済み。
- **今回追加**: `src-tauri/tauri.staging.conf.json`により、staging QAビルドはアプリ名・バンドルidentifier・ウィンドウタイトルも本番版と別になった（下記参照）。UI上のバッジに加えて、アプリそのものが別アプリとして区別できる。
- production向けビルドは別途`docs/production-release-runbook.md`の手順（RC1をgit worktreeで隔離し、`VITE_APP_ENV=production`を設定、通常の`tauri.conf.json`のまま）に従う。

## Stage 3 UATの完了・未完了項目（`docs/production-go-no-go-checklist.md`参照）

最新のstaging独立アプリへ実ログインして権限・データ保護UATを実施した。S3-2・S3-4・S3-8・S3-9は完了。S3-3はTauriアプリにURL入力欄がないため、実画面での直接URL確認が残る。

| 項目                                    | 状態     | 根拠                                                                                                  |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| S3-2（viewer: 書き込み/AI生成UI非表示） | ☒ 完了   | viewer実ログインで管理者設定、候補者書き込み、AI生成UIの非表示を確認。残りは自動回帰テストで補完      |
| S3-3（viewer: 編集URL直接アクセス拒否） | ☐ 未確認 | 自動回帰テスト済み。Tauri実画面での直接URL検証方法の確定が必要                                        |
| S3-4（pending: 業務データ非表示）       | ☒ 完了   | pending実ログインで承認待ち画面のみ表示。最新バッジとrepository非呼び出しは回帰テストで補完           |
| S3-7（重複・アーカイブ・復元）          | △ 一部   | stagingで専用候補者の登録・アーカイブ・一覧からの消失・復元・再表示を実確認。企業・求人は運用中に確認 |
| S3-8（admin限定機能）                   | ☒ 完了   | adminで招待・チーム管理・監査ログ表示、viewerで管理機能非表示を実確認                                 |
| S3-9（未保存離脱時のデータ保護）        | ☒ 完了   | 候補者・企業・求人の3編集フォームで離脱確認と入力内容を保持した編集継続を実確認                       |

## 現在の運用・配布方針（2026-08-11決定）

- Supabaseは社内試験運用中はFreeプランを継続する。Runbook 2〜3節の手動DB・Storageバックアップを継続し、外部顧客への有料提供前にProへの移行を再判定する。
- macOS版は当面プロジェクトオーナー本人だけが使用する。Apple Developer Programによる署名・Notarizationは外部提供前まで延期する。
- 社内の他利用者はWindowsを使用するため、次の最優先はWindows実機でのstaging版インストール・起動・終了・再起動・アンインストールUATとする。
- Freeプランでは自動バックアップと漏洩パスワード保護が利用できず、低アクティビティ時のプロジェクト停止、標準SMTPのAuthメール送信上限がある。社内運用上の制約として扱う。
- Windows実機を待つ間に、productionへ接続する未署名の社内検証成果物を生成する`.github/workflows/production-internal-artifacts.yml`を追加した。staging workflowとは秘密情報・成果物名・用途を分離し、40桁commit SHAと確認文字列、production project refの事前・事後検証を必須にしている。
- 上記workflowの初回実行前に、GitHub Environment `production-internal-build`へ`PROD_VITE_SUPABASE_URL`と`PROD_VITE_SUPABASE_PUBLISHABLE_KEY`を登録する。service role keyは登録しない。

## pendingユーザー確認結果

- staging（`admjgbfrfoczpxdtxmgy`）に`uat-pending@example-uat.invalid`を作成済み（ロールは自動で`pending`、変更していない）。
- pending実アカウントで承認待ち画面のみ表示され、業務画面へ到達しないことを実確認済み。最新staging独立アプリでSTAGINGバッジが表示されることも確認済み。

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

1. S3-3の「viewerによる編集URL直接アクセス拒否」を、Tauri実アプリ上で再現できる検証方法を決めて確認する（自動回帰テストは成功済み）。
2. Windows実機でstaging版のインストール・起動・終了・再起動・アンインストールを確認する。
3. Stage 3の残項目（招待メール、AI求人取り込み例外系、重複/アーカイブ、署名、公証等）は外部提供前に優先順位順で進める。

## 将来改善: ログイン情報の入力省略

- 利用者から「テストや日常利用でメールアドレスとパスワードを毎回入力・貼り付けるのが負担」と要望あり。
- メールアドレスは安全に保存して自動入力できるようにする。
- パスワードやセッション以外の認証情報を`localStorage`へ保存しない。実装時はmacOS Keychain・Windows Credential ManagerなどOSの安全な資格情報保管、またはOS標準のパスワード自動入力連携を採用する。
- 本番一般提供前の必須項目ではなく、現行UAT完了後のUX改善バックログとして扱う。

```sh
# リポジトリルートで実行する
git status
git log --oneline -5
gh run list --branch main --limit 3
```

## 秘密情報の扱い

このドキュメント、および本チェックポイントでcommitする内容には、パスワード・APIキー・接続文字列・`.env.local`の値を一切含めていません。stagingテストユーザー（`uat-admin`/`uat-agent`/`uat-viewer`/`uat-pending`、いずれも`@example-uat.invalid`の架空アドレス）のパスワードは、このドキュメントとは別に、過去のチャット履歴でのみ共有されています。
