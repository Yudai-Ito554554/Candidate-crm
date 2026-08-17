# Candidate CRM 作業引き継ぎ（2026-08-17、作業終了時チェックポイント）

このセッションの作業ログと、次回すぐ再開するための手順です。プロジェクト全体の状況は `HANDOFF.md`、ルールは `AGENTS.md` が正本。ここには「明日の続き」に必要なことだけを書きます。

## 現在の位置

- `main` HEAD: `0ec8419`（Batch 6A統合済み）
- 直近CI: Run `32001523259`（`0ec8419`）全3ジョブ成功
- production / staging への操作: **このセッションでは一切なし**
- 中断地点: **S3-3（viewerの直URLアクセス確認）の準備段階**。S3-10とBatch 5残UATは完了済み（下記「Windows実機UATの結果」）。次回はSupabaseダッシュボードのログイン情報の確認から再開する

## このセッションで完了したこと

### 1. Fable 5レビュー対応Batch 6A（AI入力provenance）の実装・レビュー・mainマージ

AIへ送信した本文を保存せず、送信直前のcanonical serialization済み文字列のHMAC-SHA-256を記録する。実装の詳細は `HANDOFF.md` 項目17と `docs/fable5-review-action-plan-2026-08-11.md` の「Batch 6A」小節を参照。

- ブランチ `fable5-ai-provenance-batch6a`（6 commit、`7b3cd30..b4771aa`）
- Fable 5判定: **Approve**（Blocker・Highなし、Medium 1件・Low 1件は対応済み）
- `main` へ `--no-ff` マージ（`13218e7`）、マージ後CI Run `31996043655` 全3ジョブ成功
- レビュー結果と対応の記録: `docs/fable5-review-request-batch6a-2026-08-17.md` の8節

M-1（Medium）は**実装側の報告漏れ**だった。canonical serialization採用でproviderへ渡るプロンプトの実体が変わっていたのに、依頼書へ「設計からの逸脱なし」と書いていた。`PROMPT_VERSION` を `candidate-summary-v3` へ引き上げて対応し、経緯は依頼書5節の項目0に残してある（記録を消さずに訂正する扱い）。

### 2. GitHub CLIの導入

`winget install GitHub.cli` で `gh 2.97.0` を導入し、`gh auth login` 済み（アカウント `Yudai-Ito554554`、スコープ `gist, read:org, repo, workflow`）。

**注意: `gh` はPATHに反映されていない場合がある。** その場合はフルパスで実行する。

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth status
```

### 3. Windows QA成果物のビルドと検証

Desktop QA artifacts workflow を Web UI から起動（Run `32002806871`、HEAD `0ec8419`）。macOS 7分07秒・Windows 9分35秒でいずれも成功。

Windows成果物を `C:\dev\qa-staging` へ展開済み。検証結果:

| 項目                      | 結果                                 |
| ------------------------- | ------------------------------------ |
| MSI の SHA256             | manifest と一致（`872b93ca…63ea62`） |
| setup.exe の SHA256       | manifest と一致（`f4486769…7a8ae4`） |
| 両ファイルのバイト数      | 一致                                 |
| manifest `sourceRevision` | `0ec8419` = `main` HEAD と一致       |
| Batch 6A (`13218e7`) 内包 | あり                                 |

**成果物の保持期限は2026-08-24（GitHub上のretention 7日）。** 期限後に再取得が必要なら同じworkflowを再実行する。ローカルの `C:\dev\qa-staging` は期限の影響を受けない。

### 4. Windows実機UAT（S3-10 + Batch 5残UAT）の完了

Run `32002806871` の成果物で実施し、全項目成功。記録は `docs/uat-checklist.md`「Batch 5 Windows実機確認記録（2026-08-17）」と `docs/production-go-no-go-checklist.md` S3-10（`☒ 済`）。

| 項目                          | 結果                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------- |
| SmartScreen警告               | 出た（未署名のため想定内、署名はS3-12）                                         |
| インストール                  | 成功。アプリ名 `Candidate CRM STAGING` で本番版と別登録                         |
| 起動                          | 成功。STAGINGバッジ表示                                                         |
| セッション復元（終了→再起動） | 成功。再ログインなしでホームへ復帰                                              |
| ウィンドウ最小サイズ制約      | 成功。規定サイズ以下へ縮小できずレイアウト崩れなし                              |
| 資格情報マネージャー          | 汎用資格情報に `supabase-refresh-token.com.candidatecrm.desktop.staging` を確認 |
| ログアウト後                  | 同エントリの削除を確認                                                          |
| アンインストール              | 成功                                                                            |

**未実施として残したもの**: Windows実機でのstaging版とproduction版の共存・資格情報分離。Windows実機にproduction版が未インストールのため。production版をWindowsへ導入する際に実施する。macOSでは2026-08-14に確認済みで、環境ごとのservice名分離は自動テストでも固定されている。

なお、UATに使ったビルドの manifest `sourceRevision` は `0ec8419` で、実施時点の `main` HEAD `cdeb513` とは一致しなかった。差分は `git diff --name-only 0ec8419..cdeb513` の結果が `HANDOFF.md` と `docs/development-handoff-2026-08-17.md` の2件のみ（全パスが `docs/` または `*.md`）であることをコマンドで確認し、ビルド成果物へ影響しないと判定して再ビルドせずに実施した。判定根拠はS3-10欄に記録済み。

## 次回やること: S3-3（viewerの直URLアクセス確認）

**まずSupabaseダッシュボードのログイン情報を確認するところから始める。** stagingのproject ref・publishable keyの取得と、viewerテストユーザー（`uat-viewer@example-uat.invalid`）のパスワード確認の両方に必要で、ここが揃わないと先へ進めない。テストユーザーのパスワードはリポジトリのどのファイルにも記録されていない（`HANDOFF.md` 12節）。

### 手順

1. **Supabaseダッシュボードへログイン**し、staging プロジェクト（ref `admjgbfrfoczpxdtxmgy`、**productionの `dsaqarejqslzgcatkxeh` と間違えない**）の Settings > API から Project URL と publishable key を取得する
2. **`.env` を staging 向けに設定**する。`.env` は現在3変数とも空。`.env.example` の雛形どおり:

   ```
   VITE_APP_ENV=staging
   VITE_SUPABASE_URL=https://admjgbfrfoczpxdtxmgy.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<stagingのpublishable key>
   ```

   **`VITE_APP_ENV=staging` を忘れないこと。** `src/lib/env.ts` で未設定時は `production` にフォールバックするため、書き忘れるとstaging Supabaseに接続しながらproduction扱いで動作し、STAGINGバッジも出ない。`.env` を変更したらdev serverの再起動が必要（HMRでは反映されない）

3. **`npm run dev` でweb版を起動**（http://localhost:1420/ ）。Fable 5の判断どおり、S3-3の合格証跡はTauriアプリではなくブラウザで取る（Tauriにはアドレスバーがないため）。テスト専用deep-linkは実装しない
4. **viewerアカウントでログイン**し、URLバーから編集6ルート（候補者・求人・企業の新規/編集）を直打ちして、編集画面が開けないことを確認する
5. 結果を `docs/production-go-no-go-checklist.md` のS3-3へ記録する

### 注意

- `.env` はコミット対象外。`git status --ignored` で `!!` 表示になっていることを確認する
- viewerテストユーザーのパスワードをチャットやリポジトリへ出さない

## 完了済み: S3-10 + Batch 5残UAT（記録として残す）

2026-08-17に実施し完了（結果は上記「4. Windows実機UAT（S3-10 + Batch 5残UAT）の完了」）。以下は実施時の手順・観点で、production版のWindows導入時に共存確認をやり直す際の参照用に残す。

### 分担

GUI操作は人が行う。**Credential Managerの検証はClaudeが機械的に確認できる**ので、各ステップ後に確認を依頼する。

探すべきエントリ（`src-tauri/src/lib.rs` の実装より）:

| 環境    | Credential Manager の Target       | キー                     |
| ------- | ---------------------------------- | ------------------------ |
| STAGING | `com.candidatecrm.desktop.staging` | `supabase-refresh-token` |
| 本番    | `com.candidatecrm.desktop`         | `supabase-refresh-token` |

保存されるのは refresh token のみ。Rust側で `supabase-refresh-token` 以外のキーは `credential_key_not_allowed` で拒否される。access tokenとユーザー情報はメモリのみ。

UAT開始時点のベースラインはクリーンだった（`cmdkey /list` に `candidatecrm` 関連エントリなし）。この出発点があるため、ログイン後にstagingエントリが作られたことを確認できた。

```powershell
$out = cmdkey /list | Out-String
[regex]::Matches($out, 'Target:\s*(\S*candidatecrm\S*)') | ForEach-Object { $_.Groups[1].Value }
```

### 手順

1. **インストール** — `C:\dev\qa-staging\Candidate CRM STAGING_0.1.0_x64_en-US.msi` を実行。SmartScreen警告は「詳細情報」→「実行」（未署名のため想定内）。→ インストール登録・バージョン・実行ファイル配置を確認
2. **起動してログイン** — スタートメニューの「Candidate CRM STAGING」。STAGINGバッジの表示を確認。→ stagingエントリが**作られたこと**を確認
3. **完全終了 → 再起動** — **再ログインなしでホームへ復帰するか**を見る。→ エントリが維持されていることを確認
4. **ログアウト** — → エントリが**削除されたこと**を確認（Batch 5の核心）
5. **アンインストール** — 設定 > アプリ から削除。→ 登録が消えたこと・残留ファイルの有無を確認

### UAT中の注意

- **AI機能は触らない。** stagingに `AI_FINGERPRINT_HMAC_KEY_V1` 未設定・Edge Function未deployのため、Batch 6Aのfail-closedで必ずエラーになる（正しい挙動だが今回の対象外）
- staging版は本番版と別アプリとして共存し、上書きしない
- 未署名QA版であり一般配布しない
- 結果は `docs/uat-checklist.md` 7節と `docs/production-go-no-go-checklist.md` のS3-10へ記録する。このプロジェクトは「自動テストで確認済み」と「実機/実画面で確認済み」を厳密に区別する運用（☒ 済／☐／△ 一部）

## 未実施のまま残っていること

### Batch 6Aのオーナー作業（設計書2.12節が正本）

`main` へは入っているが、**stagingにもproductionにも何も適用していない**。順序を守れば非破壊。

1. `AI_FINGERPRINT_HMAC_KEY_V1` の生成とsecrets設定。**staging用とproduction用は別の値にする** — 同値だとstaging側の漏洩でproductionのfingerprintが突合可能になる。値はパスワードマネージャへ保管する。**このkeyは削除すると過去記録が検証不能になり、復旧できない**（運用ルールは `docs/backup-runbook.md` の「AI provenance HMAC keyの運用」節）
2. **migration適用 → Edge Function deploy の順**（staging先行）。列がない状態でdeployするとprovenance UPDATEが失敗し、fail-closedで送信自体が止まる
3. stagingで両機能を各1回実行し、5列の形式・同一入力での同一fingerprint・**AI出力が従来と大きく変わっていないことの目視確認**（M-1対応でプロンプトの実体が変化しているため）
4. keyを一時的に外してfail-closedを実証（確認後に戻す）
5. 3が全て通ってからproduction適用

### WSL2未導入

`wsl --status` が「Linux用Windowsサブシステムがインストールされていません」を返す状態のまま。そのためDocker Desktopが起動できず、**ローカルの `supabase:reset` / `supabase:test` はこのセッションで一度も実行していない**。DB検証はすべてCIのUbuntuジョブ（同じ2コマンドを実行）による。

導入する場合は管理者PowerShellで `wsl --install` → 再起動。Fable 5は「CIが同等の証跡」としてマージ条件にはしていない。

導入後の任意作業として、`src/types/database.generated.ts` の再生成による突合がある。Batch 6Aの5列は手書きで追加したため、生成器の出力順との一致だけが未確認（列の存在と型は `src/test/ai-provenance-migration.test.ts` で機械検証済み、mutation testで空振りでないことも確認済み）。

```powershell
npx supabase gen types typescript --local > src/types/database.generated.ts
```

## 再開時の最初のコマンド

```powershell
git status
git log --oneline -5
& "C:\Program Files\GitHub CLI\gh.exe" run list --branch main --limit 5
```

`git status` がcleanでない場合は、誰の作業か確認してから進める。

## 秘密情報の扱い

このドキュメントにパスワード・APIキー・接続文字列の値は含めていない。`AI_FINGERPRINT_HMAC_KEY_V1` は名前だけを記載しており、値はまだ生成もしていない。`C:\dev\qa-staging` はユーザーディレクトリ配下ではないため `npm run verify:repo` のOS固有パス検査に抵触しない。
