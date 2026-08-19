# Candidate CRM 自動バックアップRunbook

最終更新: 2026-08-14

対象: オーナーMacで稼働するCandidate CRM内部利用版

## 1. 安全境界

- 実行対象はDB論理ダンプ、Storageの`crm-files`、取得メタデータです。
- production初回実行、launchd登録、初回restore drillは、接続先と対象範囲を機械的に検証したうえで実施します。人手が必要な秘密入力以外は自動化された手順を優先します。
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

## 5. launchd日次登録と欠測監視

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

### 5.1 48時間のfreshness監視

バックアップ処理自体が起動しない「無音の欠測」を検知するため、`scripts/backup/com.candidatecrm.backup-freshness.plist.template`も作業用コピーへ置き、次を置換します。

- `__FRESHNESS_SCRIPT__`
- `__CONFIG_POINTER__`
- `__FRESHNESS_STDOUT_LOG__`
- `__FRESHNESS_STDERR_LOG__`

生成したplistを`$HOME/Library/LaunchAgents/com.candidatecrm.backup-freshness.plist`へ配置します。ログイン時と毎日9時に`check-backup-freshness.sh`が起動し、設定した許容時間（既定48時間）以内の`.backup-complete`がなければ`backup.log`へ`FRESHNESS_ERROR`を記録してmacOS通知を表示します。通知文言は実際の閾値を日・時間・秒の順で読みやすく表示します。成功時は`FRESHNESS_OK`だけをログへ残し、通知しません。

```sh
plutil -lint "$HOME/Library/LaunchAgents/com.candidatecrm.backup-freshness.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.candidatecrm.backup-freshness.plist"
launchctl kickstart -k "gui/$(id -u)/com.candidatecrm.backup-freshness"
launchctl print "gui/$(id -u)/com.candidatecrm.backup-freshness"
```

登録前または監視停止中は、最低でも週1回、最新snapshotの日時と`.backup-complete`を手動確認します。

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

### 7.1 stale lockと不完全snapshotの復旧

電源断や強制終了後に`.backup-lock`や`.incomplete-*`が残った場合は、次の順序を厳守します。

1. `launchctl print "gui/$(id -u)/com.candidatecrm.backup"`と`pgrep -fl 'backup-crm.sh'`でバックアップ処理が実行中でないことを確認します。判定できない場合は何も削除しません。
2. 設定ファイルを安全なローカルシェルで読み込み、`BACKUP_ROOT`が想定の専用ディレクトリであることを目視確認します。値はチャットやログへ貼りません。
3. 実行中プロセスがない場合だけ、空ディレクトリである`.backup-lock`を`rmdir "$BACKUP_ROOT/.backup-lock"`で除去します。`rm -rf`は使いません。
4. `snapshots/.incomplete-*`は自動削除しません。`backup.log`とlaunchd標準エラーで原因を確認し、専用の`recovery-hold`ディレクトリへ個別に移動します。復旧判断後も広範囲の再帰削除は行いません。
5. 手動バックアップを再実行し、`SUCCESS`、checksum、metadataを再確認します。

## 8. 分離環境でのrestore drill

初回drillと定期drillは`docs/production-release-runbook.md`の復元手順を使用します。

- productionでもstagingでもないローカルSupabase、または使い捨て検証projectへ復元します。
- DBは`roles.sql`→`schema.sql`→`data.sql`の順に単一トランザクションで復元します。
- Storageは同じ分離環境の`crm-files`へ復元します。
- `checksums.sha256`、DB/Storage件数、合計サイズ、主要参照機能を照合します。
- `auth.users`が復元され、`profiles`と`candidates`の行数が取得時点の期待値と一致することを確認します。
- 復元先の`storage.objects`で`bucket_id = 'crm-files'`の件数が`metadata.json`の`storage.fileCount`と一致することを確認します。
- 復元先アプリで候補者一覧、候補者詳細、ファイル一覧が参照できることを確認します。
- production refとの不一致を破壊的コマンド直前に再確認します。
- 実施日、対象snapshot、結果、実施者を共有範囲を限定した運用記録へ残します。秘密や実パスは記録しません。

### 8.1 初回実施記録

2026-08-14に、productionへ接続しない使い捨てDockerネットワーク・DBボリュームで初回drillを実施しました。取得済みsnapshotのchecksumとproject refを先に検証し、Supabase Postgres/Auth/Storageスキーマを隔離環境へ初期化してから、DBダンプを単一トランザクションで復元しました。

- `auth.users`、`public.profiles`、`public.candidates`、`storage.objects`の復元件数が取得時点の期待値と一致した。
- Auth health endpointとPostgREST health endpointが正常応答した。
- 復元済みユーザーのJWTコンテキストで、候補者・プロフィール・ファイルの主要参照APIが正常応答した。
- 対象snapshotのStorage実体は0件だったため、ファイル実体コピーは発生せず、`storage.objects`件数0とmetadataの`fileCount` 0の一致を確認した。
- 完了後に使い捨てコンテナ、ボリューム、ネットワークを削除し、既存ローカルSupabaseが継続してhealthyであることを確認した。
- productionへの書き込みは行っていない。

### 8.2 翌日定刻の自動実行記録

2026-08-15に、前日登録したlaunchdの日次ジョブが02:30に自動起動し、02:39に新しい完了snapshotを作成したことを確認しました。

- `launchctl print`でバックアップジョブの実行回数が2回（登録直後の実地確認と翌日定刻実行）、最終終了コードが0であることを確認した。
- 最新snapshotの`.backup-complete`は2026-08-15 02:39:57 JSTに作成されていた。
- `roles.sql`、`schema.sql`、`data.sql`はいずれも非ゼロサイズかつ権限600だった。内容は確認していない。
- 取得時点の`crm-files`は0件であり、Storage実体ファイルも0件だった。
- productionへの書き込みは行っていない。

## 9. AI provenance HMAC keyの運用

Batch 6Aで、AIへ送信した入力のfingerprint（HMAC-SHA-256）を`ai_generation_requests`と`job_import_requests`へ記録するようになりました。keyはEdge Function secretsの`AI_FINGERPRINT_HMAC_KEY_V1`にのみ存在し、DB・リポジトリ・クライアントには置きません。`hash_key_version`列に版番号を記録します。

このkeyはバックアップ対象の秘密とは性質が異なるため、次の3点を明示します。

**1. keyを削除しない。** fingerprintはkeyがなければ再計算できません。keyを消すと、その版で記録された過去の全行が検証不能になります。バックアップ復元やproject再作成の際も、secretsからkeyを消さないでください。

**2. rotationは加算のみ。** 新しい版を追加する場合は`AI_FINGERPRINT_HMAC_KEY_V2`を追加し、新規行だけを新版で記録します。**旧keyはsecretsから消しません。** 旧版で記録された行を後から検証するために必要です。原文を保存していないため、旧行を新keyで再計算することは原理的に不可能です。

**3. key漏洩時の扱いは不可逆。** keyが漏洩した場合、新版keyを追加して以後の記録を切り替えます。ただし漏洩以前に記録された行は、fingerprintが確認オラクル（特定の求人票・候補者プロフィールがAIへ送られたか攻撃者が突合できる状態）になったリスクを負った状態のままです。原文がないため再計算による救済はできません。この不可逆性を前提に、漏洩日時と影響範囲（どの版のkeyで記録された行か）を運用記録へ残してください。

なお、2026-08-15以前に作成された既存行は5列がすべてNULLです。原文が存在しないためfingerprintを算出できず、推測値でのbackfillは行いません。全列NULLは「providerへ送信していない行」（既存行、cache hit、送信前失敗）を意味し、全列非NULLは「この指紋の入力をproviderへ送信した行」を意味します。

**4. 値の同一性はDashboardのSHA256ダイジェストで事前に検証できる。** Supabase DashboardのEdge Function Secrets一覧は各secretのSHA256ダイジェストを表示します。これは同一の値に対して同一の結果を返すため（saltなし）、keyを再登録した際に「元と同じ値が入ったか」をAI生成を実行する前に照合できます。2026-08-19のstaging検証で、再登録時にダイジェストが変化したことから値の取り違えを検出し、AI実行前に誤りに気づけることを確認しました。**再登録の直後は必ずダイジェストを控えと照合してください。**

**5. productionではfail-closedの再演を行わない。** 設計書2.12節 項目4の要件は「stagingで1回実証」です。実証のためにkeyを一時削除する操作はstagingに限定し、productionでは行いません。production側でkeyを設定したら、その場でパスワードマネージャへ保管し、**値を再入力する場面自体を作らない**運用とします。2026-08-19のstaging検証では、削除→再登録の過程で誤った値が一度登録され、その間に記録された1行（`ai_generation_requests`、2026-08-19 06:21:10 UTC）が検証不能なまま残りました。productionで同じことが起きると、実データのprovenanceが恒久的に失われます。

## 10. オーナーチェックリスト

| 項目                                  | 状態                                    |
| ------------------------------------- | --------------------------------------- |
| FileVault有効化を確認                 | 未実施                                  |
| production専用設定とworkdirを作成     | 完了                                    |
| production初回バックアップ成功        | 完了                                    |
| DB・Storage・checksum・metadataを確認 | 完了                                    |
| 失敗通知を実機で確認                  | 未実施                                  |
| launchdを登録して翌日実行を確認       | 完了（2026-08-15定刻実行・終了コード0） |
| freshness監視を登録して動作確認       | 完了                                    |
| 週次で最新の完了snapshotを確認        | 未実施                                  |
| stale lock・不完全snapshot復旧を確認  | 未実施                                  |
| 分離環境への初回restore drill成功     | 完了                                    |
