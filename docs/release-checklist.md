# Candidate CRM release checklist

この手順は、非本番で検証済みのcommitからmacOS・Windows向け配布物を作成するためのチェックリストです。GitHub Actionsの`Desktop QA artifacts`は署名なしの社内QA成果物だけを生成し、GitHub Releaseや一般公開は行いません。

## 1. リリース候補の固定

- 作業ツリーに意図しない変更がない
- `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`のバージョンが一致する
- `npm run verify:repo`、フォーマット、型、Lint、テスト、ビルドが成功する
- 全migrationが非本番環境へ先頭から適用できる
- `supabase test db`が成功する
- リリース対象commitとmigration一覧を記録する

## 2. GitHub Actions secrets

QA成果物のビルドには、対象Supabaseプロジェクトの次の公開可能なクライアント設定をRepository secretsへ登録します。

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_ENV`（社内QAは`staging`、本番は`production`）

`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY`、OAuth client secret、メールrefresh tokenは登録しません。これらはデスクトップ成果物へ絶対に埋め込みません。

## 3. 未署名QA成果物

GitHub Actionsから`Desktop QA artifacts`を手動実行します。

- macOS: `.dmg`
- Windows: `.msi`とNSIS `.exe`
- macOS QA版はTauriの疑似ID `-`でアドホック署名し、`.app`とDMG内のアプリを`codesign --verify --deep --strict`で検証する
- ダウンロードZIPはインストーラー、`sha256-manifest.json`、`INSTALL.txt`だけを直下に配置し、生の`.app`やビルドディレクトリを含めない
- 各成果物には`sha256-manifest.json`を同梱し、バージョン、OS、CPUアーキテクチャ、ファイルサイズ、SHA-256を記録する
- 成果物の保持期間は7日
- 未署名成果物は社内QAだけに使用し、一般配布しない
- アドホック署名は改変検知用であり、Appleによる本人確認やNotarizationではない。Gatekeeperの警告をなくすことはできず、初回起動時にmacOSの「プライバシーとセキュリティ」で許可が必要な場合がある
- インストール後、設定エラー画面ではなくログイン画面が表示されることを確認する

## 4. macOS正式配布

- Developer ID Application証明書を安全なCI署名環境へ登録する
- Hardened Runtimeと必要なentitlementsをレビューする
- `.app`を署名し、`codesign --verify --deep --strict`で検証する
- Apple Notary Serviceへ提出する
- Notarization ticketをstapleする
- `spctl --assess`でGatekeeper評価を確認する
- 署名済みDMGを別のmacOS端末でインストール確認する

証明書、秘密鍵、Apple ID用パスワードはリポジトリやVite環境変数へ置きません。

## 5. Windows正式配布

- 組織のコード署名証明書または信頼済み署名サービスを用意する
- `.msi`とNSIS `.exe`へタイムスタンプ付き署名を行う
- `signtool verify /pa`相当で署名を検証する
- SmartScreenとWindows Defenderで確認する
- 標準ユーザー環境でインストール、起動、アンインストールを確認する

Windows署名秘密鍵をリポジトリ、npmスクリプト、ログへ出力しません。

## 6. 最終確認

- macOS・Windows双方でログイン、ログアウト、セッション復元が動作する
- admin、agent、viewerのRLS境界を確認する
- 候補者・企業・求人・選考・活動・タスク・ファイルを架空データで確認する
- オフライン表示とエラー復旧画面を確認する
- Candidate CRMの情報がlocalStorageやログへ出力されていないことを確認する
- 配布物のSHA-256とビルド元commitを記録する
- ロールバック対象バージョンを記録し、`docs/rollback-runbook.md`の配布停止・復旧手順を確認する

### 6.1 AI求人票取り込み

- `generate-candidate-summary`、`extract-job-posting`、`get-ai-usage`が対象プロジェクトで`ACTIVE`になっている
- 3関数のJWT検証が有効で、viewerと未認証ユーザーからAI実行できない
- `OPENAI_API_KEY`はSupabase Edge Function Secretだけにあり、Vite、Tauri、GitHub Actionsの公開クライアント設定へ含まれない
- Edge Function内のレビュー済みモデルIDが意図した低コストモデルで、Secretやクライアントから変更できない
- `docs/fixtures/job-import-sample.txt`と架空PDFを使い、テキスト・PDF・公開URLの入力元表示と根拠引用を確認する
- AI結果を反映しても通常の「求人を登録」を押すまでDBへ保存されず、元の求人票や完全なURLがDB・localStorageへ残らない
- macOSとWindowsの両方でPDF選択・ドラッグ＆ドロップ・差分選択・企業照合を完走する
