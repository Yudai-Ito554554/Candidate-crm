# Candidate CRM 自動バックアップRunbook

最終更新: 2026-08-12

対象: オーナーMacで稼働するCandidate CRM内部利用版

## 1. 安全境界

- 実行対象はDB論理ダンプ、Storageの`crm-files`、取得メタデータです。
- production初回実行、launchd登録、初回restore drillはオーナーが行います。Codexは実行しません。
- メイン開発リポジトリをSupabase projectへlinkしません。専用workdirだけを使用します。
- スクリプトは`supabase projects api-keys`を実行しません。service role keyも使用しません。
- 保存先はFileVaultが有効な内蔵ボリュームに限定します。外部媒体・クラウドへ複製する場合も暗号化が必須です。

## 2. 前提確認

「システム設定」→「プライバシーとセキュリティ」→「FileVault」で「オン」を確認します。ターミナルでは次でも確認できます。

```sh
fdesetup status
```

`FileVault is On.`以外なら設定を中止します。

## 3. 隔離ディレクトリと設定

以下の名称は例です。実際の絶対パスや接続情報をGit、チャット、CIログへ出さないでください。

1. FileVault保護領域に、設定用、バックアップ出力用、Supabase専用workdirを別々に作成し、権限を`700`にします。
2. `scripts/backup/backup.env.example`を設定用ディレクトリへ`backup.env`としてコピーし、権限を`600`にします。
3. `BACKUP_MODE=remote`、productionの`EXPECTED_PROJECT_REF`、保存先、専用workdir、Supabase CLIの絶対パス、percent-encode済み`DATABASE_URL`を設定します。
4. 専用workdirだけを対象projectへlinkします。refを目視確認し、開発リポジトリでは実行しません。
5. `$HOME/.config/candidate-crm/backup-config-path`へ`backup.env`の絶対パスを1行だけ記録し、権限を`600`にします。ポインタファイルと設定ファイルは、実行ユーザー本人が所有している必要があります。

スクリプトはDB URLから抽出したrefと専用workdirの`supabase/.temp/project-ref`を、設定したrefと二重照合します。解析不能・欠落・不一致はすべてfail-closedで停止します。

## 4. 手動初回実行

production初回実行はオーナーが次の順で行います。

```sh
/bin/bash /path/to/backup-crm.sh
```

確認項目:

- `backup.log`末尾が`SUCCESS`である。
- `snapshots/<UTC時刻>/`に`db/roles.sql`、`db/schema.sql`、`db/data.sql`があり、0 byteでない。
- `storage/crm-files/`、`checksums.sha256`、`metadata.json`、`.backup-complete`がある。
- `metadata.json`のproject ref、件数、サイズが想定対象を示す。DB URLやパスワードが含まれない。
- `shasum -a 256 -c checksums.sha256`をスナップショット内で実行して成功する。

## 5. launchd日次登録

`scripts/backup/com.candidatecrm.backup.plist.template`を作業用コピーへ置き、次のプレースホルダーをオーナー環境の絶対パスへ置換します。

- `__BACKUP_SCRIPT__`
- `__CONFIG_POINTER__`
- `__LAUNCHD_STDOUT_LOG__`
- `__LAUNCHD_STDERR_LOG__`

生成したplistを`$HOME/Library/LaunchAgents/com.candidatecrm.backup.plist`へ配置し、`plutil -lint`で検証します。初回手動実行が成功する前に登録しません。

```sh
plutil -lint "$HOME/Library/LaunchAgents/com.candidatecrm.backup.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.candidatecrm.backup.plist"
launchctl kickstart -k "gui/$(id -u)/com.candidatecrm.backup"
launchctl print "gui/$(id -u)/com.candidatecrm.backup"
```

失敗時は`backup.log`とlaunchdの標準エラーへ記録し、macOS通知も表示します。通知権限がない場合もログと非0終了は維持されます。

## 6. ローテーション仕様

- 最新の日次14世代を保持します。
- ISO週ごとに最新1世代を選び、最新8週分を保持します。
- 同じスナップショットが日次・週次の両方を満たす場合は1コピーだけ保持します。
- 日次集合と週次集合の和集合以外だけを削除します。`.backup-complete`を持たない不完全ディレクトリや想定外名称は自動削除しません。

## 7. 失敗通知の確認

ローカルSupabaseまたは専用のテスト設定で、到達不能な接続先や不一致refを設定して1回だけ手動実行します。次を確認後、正しい設定へ戻します。

- 終了コードが非0。
- `backup.log`に`ERROR`が追加される。
- macOS通知「Candidate CRMバックアップ失敗」が表示される。
- 不一致refの場合、DBダンプもStorage取得も開始されない。

productionの正しい接続情報を意図的に壊して試験しません。

## 8. 分離環境でのrestore drill

初回drillと定期drillは`docs/production-release-runbook.md`の復元手順を使用します。

- productionでもstagingでもないローカルSupabase、または使い捨て検証projectへ復元します。
- DBは`roles.sql`→`schema.sql`→`data.sql`の順に単一トランザクションで復元します。
- Storageは同じ分離環境の`crm-files`へ復元します。
- `checksums.sha256`、DB/Storage件数、合計サイズ、主要参照機能を照合します。
- production refとの不一致を破壊的コマンド直前に再確認します。
- 実施日、対象snapshot、結果、実施者を共有範囲を限定した運用記録へ残します。秘密や実パスは記録しません。

## 9. オーナーチェックリスト

| 項目                                  | 状態   |
| ------------------------------------- | ------ |
| FileVault有効化を確認                 | 未実施 |
| production専用設定とworkdirを作成     | 未実施 |
| production初回バックアップ成功        | 未実施 |
| DB・Storage・checksum・metadataを確認 | 未実施 |
| 失敗通知を実機で確認                  | 未実施 |
| launchdを登録して翌日実行を確認       | 未実施 |
| 分離環境への初回restore drill成功     | 未実施 |
