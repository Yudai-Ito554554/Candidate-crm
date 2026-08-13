# Fable 5 再レビュー依頼: Batch 2推奨対応

作成日: 2026-08-13

対象ブランチ: `fable5-followups-batch2`

## 1. 役割と依頼

Fable 5には設計・セキュリティレビューのみを依頼します。実装・修正・commit・pushはCodexが担当します。

Batch 2レビュー結果は`docs/fable5-review-batch2-result-2026-08-12.md`へ原文保存しました。結論は「Approve with recommendations」、Blockerなしでした。本依頼では、推奨対応として追加した差分だけを確認してください。

## 2. Codexが追加実装した内容

### H-1: バックアップ欠測監視

- `scripts/backup/check-backup-freshness.sh`を追加。
- 期待snapshot名かつ`.backup-complete`がある最新完了snapshotのmtimeを確認。
- 48時間を超える、完了snapshotがない、未来時刻の場合はfail-closedで非0終了。
- `backup.log`へ`FRESHNESS_ERROR`を記録し、macOS通知を表示。
- 正常時は`FRESHNESS_OK`だけを記録し、成功通知は出さない。
- pointer/configのowner・mode・絶対パス・BACKUP_ROOT範囲を本体と同水準で検証。
- 接続文字列をバックアップ先判定に使用せず、ログ出力しない。
- `com.candidatecrm.backup-freshness.plist.template`を追加し、`RunAtLoad`と毎日9時に実行。

### M-1: 空Storage bucket

`storage cp`前に`storage/crm-files`を作成するよう変更し、0件でもmetadata、checksum、完了マーカーを生成できるようにしました。

### M-2: stale lockと不完全snapshot

Runbookへ次を追加しました。

- `launchctl`と`pgrep`で処理中でないことを確認するまでlockを触らない。
- 空の`.backup-lock`だけを`rmdir`する。
- `.incomplete-*`は自動削除せず、原因確認後に`recovery-hold`へ個別移動。
- 広範囲の`rm -rf`を使わない。

### Low推奨

- DB URL ref抽出を接続文字列全体へアンカーし、直接接続とpoolerだけを許可。
- Supabase公式手順に従うvector index内部テーブル除外理由をコメント化。
- 出力仕様変更時に`SCRIPT_VERSION`を上げる規約を明記し、今回`2`へ更新。

### restore drill

Runbookの合格条件に次を追加しました。

- `auth.users`復元確認。
- `profiles`と`candidates`の期待件数照合。
- `storage.objects`の`crm-files`件数とmetadataの`fileCount`照合。
- 候補者一覧、候補者詳細、ファイル一覧のUI参照確認。

## 3. 追加テスト

`src/test/backup-scripts.test.ts`へ次を追加・更新しました。

- empty Storageでバックアップ成功、fileCount/bytesが0。
- 直接接続URLとpooler URLを許可。
- URL本文へref文字列を埋め込んだ不正形式を拒否。
- freshnessのsnapshotなし、48時間以内、49時間経過を検証。
- freshness plistの`RunAtLoad`とプレースホルダーを静的確認。
- テスト時だけmacOS通知を無効化する明示的環境変数を使用。production既定値では通知有効。

## 4. 検証状況

- `bash -n`: 成功。
- backup/freshness plistの`plutil -lint`: 成功。
- バックアップ単体: 9件成功。
- `app-routes.test.tsx`を含む関連再実行: 101件成功。
- 初回全体実行では既知の`app-routes.test.tsx` flakyが1件発生し、単独再実行で成功。今回のバックアップ差分と無関係。
- 最終再実行: format / format:check / typecheck / lint / test（66ファイル・351件）/ build / verify:repo / git diff --checkがすべて成功。
- CI結果はcommit・push後に別commitで本書へ追記します。

### 4.1 GitHub Actions

推奨対応commit `98e6c34ac6b4ecc92bf73dfc4cbea3345aaca7c3`に対するCI Run [`31654100178`](https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31654100178)は全ジョブ成功しました。

- Quality checks (macos-latest): 成功（2m50s）
- Quality checks (windows-latest): 成功（5m8s）
- Supabase migration and policy checks: 成功（3m1s）

本CI結果を記録するdocs-only commitについても、push後の最終CIを確認します。

## 5. 未実施・安全境界

- production・stagingへの接続なし。
- production設定、バックアップ、launchd登録なし。
- Supabase migration・RLS・Auth設計の変更なし。
- service role keyの利用なし。

## 6. 確認してほしい点

1. freshness監視のfail-closed境界と48時間判定がH-1を満たすか。
2. stale lock復旧手順が誤削除を避けつつ実用的か。
3. URLアンカー化が直接接続・poolerの正規形式を過不足なく扱うか。
4. restore drill追加条件がproduction初回実行前のGo条件を満たすか。
5. Batch 2全体をmainへマージしてよいか。

## 7. 希望する回答形式

1. 結論: Approve / Approve with recommendations / Changes required
2. Blocker、High、Medium、Low
3. mainへマージ可否
4. production初回実行前に残るオーナー作業
