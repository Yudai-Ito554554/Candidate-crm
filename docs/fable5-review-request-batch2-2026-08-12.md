# Fable 5 設計・セキュリティレビュー依頼: Batch 2

作成日: 2026-08-12

対象ブランチ: `fable5-followups-batch2`

基準main: `a6e21f2`（Fable 5承認済みBatch 1マージ）

## 1. 依頼内容

Fable 5には実装ではなく、次の設計・セキュリティレビューを依頼します。

1. Batch 1推奨修正R1〜R5が、前回レビュー意図と一致しているか。
2. 内部利用向け自動バックアップのfail-closed境界、秘密管理、保持方式、復旧可能性が妥当か。
3. production初回実行・launchd登録・restore drillへ進む前に、Codexが追加修正すべきBlockerまたはHighがないか。
4. 承認できる場合、mainへマージしてよいcommit範囲を明示してほしい。

Fable 5はコードを変更しません。実装修正はCodexが行います。

## 2. レビュー対象commit

| commit    | 内容                                                                |
| --------- | ------------------------------------------------------------------- |
| `afbfcf8` | R1〜R3: JWT helper、Storage遮断、suspended SECURITY DEFINER拒否     |
| `91a137f` | R4〜R5: 停止運用、pending割当UI除外と回帰テスト                     |
| `df2ccc6` | R3追加条件: pending SECURITY DEFINER拒否                            |
| `f384288` | Batch 2: 自動バックアップ、ローテーション、launchd、Runbook、テスト |
| `26f9145` | HANDOFFとaction-plan整合                                            |
| `7a548b1` | 本レビュー依頼書                                                    |
| `30be08f` | macOS専用実行テストと全OS共通静的安全テストを分離                   |

## 3. R1〜R5の実装結果

### R1: JWTエミュレーション

`supabase/tests/001_batch1_account_lifecycle.test.sql`に`pg_temp.set_authenticated_user`を定義し、`request.jwt.claim.sub`と`request.jwt.claims`を同時設定しました。既存の件数断定は緩和していません。

### R2: Storage遮断

`crm-files`へfixtureを用意し、suspendedユーザーのSELECTが0件、INSERTがSQLSTATE 42501で拒否されることをpgTAPで確認しました。

### R3: SECURITY DEFINER内部検証

`record_candidate_view`をsuspendedとpendingで呼び、双方がSQLSTATE 42501と「approved workspace membership required」で拒否されることを確認しました。

### R4: 停止運用

`docs/production-release-runbook.md`へ、CRM管理画面で`suspended`へ変更した後、Supabase Auth側のbanまたはセッション失効を併用する手順を追加しました。

### R5: pendingの扱い

採用案は「`pending`は初回承認待ち専用」です。

- 割当可能ロールを`suspended / admin / agent / viewer`へ限定。
- 既存pendingユーザーの現在値はdisabled optionで表示を維持。
- `set_profile_role`は復旧・保守経路として5値を維持。
- viewerからpendingを選べないこと、pending現在表示が壊れないことを回帰テストで固定。

## 4. バックアップ設計

### 4.1 成果物

- `scripts/backup/backup-crm.sh`
- `scripts/backup/rotate-backups.sh`
- `scripts/backup/backup.env.example`
- `scripts/backup/com.candidatecrm.backup.plist.template`
- `docs/backup-runbook.md`
- `src/test/backup-scripts.test.ts`

### 4.2 取得対象

- DB: `roles.sql`、`schema.sql`、`data.sql`
- Storage: `crm-files`の全実体
- 証跡: `checksums.sha256`、`metadata.json`、`.backup-complete`、`.iso-week`

`metadata.json`にはUTC日時、期待project ref、スクリプト版、DB各サイズ、Storage件数・合計サイズを記録します。接続文字列やパスワードは記録しません。

### 4.3 fail-closed境界

- `local`と`remote`を明示分離。
- remoteはDB URLからproject refを抽出できない場合に停止。
- DB URLのrefと設定refが不一致なら停止。
- 隔離workdirの`supabase/.temp/project-ref`と設定refが不一致・欠落なら停止。
- remoteで開発リポジトリ自体をworkdirに指定したら停止。
- ポインタ・設定ファイルは実行ユーザー所有かつgroup/other権限なしを要求。
- 出力先が`/`、`/tmp`、`$HOME`等の広すぎる場所なら停止。
- `.backup-complete`はDB、Storage、checksum、metadataがすべて成功した後だけ作成。
- ロックディレクトリにより多重実行を拒否。

スクリプトは`supabase projects api-keys`を実行せず、service role keyも扱いません。

### 4.4 保持方式

単一のsnapshot集合から次の和集合を保持します。

- 最新の日次14世代
- ISO週ごとの最新1世代を8週分

同一snapshotの重複コピーは作りません。削除対象は、想定名称、直下ディレクトリ、`.backup-complete`あり、保持集合外の全条件を満たすものだけです。不完全・未知名称は自動削除しません。

### 4.5 通知とlaunchd

- `set -Eeuo pipefail`とERR trap。
- 失敗を`backup.log`へ記録し、macOSでは`osascript`通知。
- `osascript`が利用不能でもログと非0終了を維持。
- plistは絶対パスをプレースホルダー化。
- FileVault有効化をRunbookの前提条件に設定。

## 5. 実施済み検証

### 5.1 ローカルSupabase

- ColimaをローカルDockerランタイムとして使用。
- 全migrationをクリーン再適用。
- pgTAP: 2ファイル、44件成功（`000`が30件、`001`が14件）。
- ローカルStorageへPDF fixtureを2件アップロード。
- 実Supabase CLIでDB 3ダンプとStorage 2件を取得。
- checksum全件一致。
- metadataの`projectRef=local`、Storage件数・合計サイズを確認。

途中でCLIのdownload先指定により`crm-files/crm-files`と二重になる問題を検出し、download先を親`storage/`へ変更して再検証しました。

### 5.2 自動テストと品質チェック

- `npm run format`: 成功
- `npm run format:check`: 成功
- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm test`: 66ファイル、347件成功
- `npm run build`: 成功
- `npm run verify:repo`: 成功
- `git diff --check`: 成功
- `bash -n`: 成功
- `plutil -lint`: 成功
- backup integration test: 成功、ref不一致停止、失敗ログ、14日+8週ローテーションを確認

### 5.3 ブランチCI

GitHub Actions Run `31645053287`（head `30be08f`）は全ジョブ成功しました。

- Supabase migration and policy checks: 成功
- Quality checks (macos-latest): 成功
- Quality checks (windows-latest): 成功

初回Run `31644509478`では、macOS専用スクリプトの実行テストがWindows上でも`/bin/bash`を直接呼び、`ENOENT`で失敗しました。`30be08f`で次の責務へ分離して解消しています。

- 全OS: shebang、fail-fast設定、service role key非依存、project ref検証、完了マーカー、保持世代定数の静的検証。
- macOS: 実スクリプトを用いたartifact作成、ref不一致fail-closed、失敗ログ、ローテーションの実行検証。

バックアップ実行基盤がmacOS内部利用向けである点は変更していません。Windows CIで検証を全面的に無効化せず、OS非依存の安全契約は維持しています。

## 6. 未実施と安全上の区別

次はオーナー作業として意図的に未実施です。

- production・stagingへの接続
- production初回バックアップ
- production用接続設定の作成
- launchd登録と翌日実行確認
- productionバックアップから分離環境への初回restore drill
- production migrationやデータの変更

## 7. 特に確認してほしい論点

1. DB URLとlink先refの二重照合で、pooler・直接接続の想定形式を十分にfail-closedで扱えているか。
2. owner/mode検証済み設定ファイルを`source`する設計が内部利用として妥当か。より限定的なparserが必要か。
3. 日次14+週次8を単一集合の和集合として保持する方式が、前回受け入れ条件と一致するか。
4. Storageの整合性証跡としてchecksum、件数、合計サイズで十分か。DB上の`storage.objects`との照合を追加すべきか。
5. 成功はログ、失敗はログ+macOS通知という方式で無音失敗防止を満たすか。成功通知も必要か。
6. launchd登録前にオーナーが行うべき手動確認・restore drill手順に不足がないか。

## 8. 希望する回答形式

1. 結論: Approve / Approve with recommendations / Changes required
2. Blocker、High、Medium、Low
3. 各指摘の根拠ファイル・行またはcommit
4. mainへマージ可能なcommit範囲
5. production初回実行前のGo/No-Go条件
6. 次Batchの設計事項
