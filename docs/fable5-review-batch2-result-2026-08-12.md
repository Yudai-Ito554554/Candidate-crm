+# Fable 5再レビュー結果: Batch 2(R1〜R5・自動バックアップ)

- レビュー日: 2026-08-12
- 対象: `fable5-followups-batch2` @ `5a03181`(依頼書記載の `30be08f` にdocs commitが1つ積まれたHEAD。実コードをclone・checkoutし、backup 2スクリプト・plist・env example・Runbook・pgTAP・vitest・R1〜R5差分・R4のRunbook追記を確認)
- 役割: Fable 5はレビューと受け入れ条件の提示のみ。実装はCodexが行う。
- 禁止事項の遵守: production・stagingへの接続・変更なし。

---

## 1. 結論

**Approve with recommendations。**

- R1〜R5はすべて前回レビュー意図と一致している(2節)。
- バックアップのfail-closed境界・秘密管理・保持方式は内部利用の水準を満たす。Blockerなし、Highは運用設計の1点(欠測検知)のみで、コード上の必須修正はない。
- **マージ可能commit範囲: `afbfcf8..5a03181` の全7 commit**(依頼書の6 commit+CI検証記録docs)。推奨修正M-a〜M-cを同ブランチへ積んでからマージしても、先にマージして次ブランチで対応してもよい。分割は不要。
- production初回実行は、5節のGo条件を満たしてから行う。

## 2. R1〜R5の適合確認(すべて◯)

- **R1**: `pg_temp.set_authenticated_user` が `request.jwt.claim.sub` と `request.jwt.claims`(sub+role入りJSON)を同時設定。件数断定は緩和されておらず、エミュレーション正動作の自己証明性が維持されている。
- **R2**: `storage.objects`(bucket `crm-files`)への直接SELECT 0件・INSERT 42501をsuspendedで実証。fixtureはreset role状態で用意されており手順も正しい。
- **R3**: `record_candidate_view` のsuspended・pending双方での42501+エラーメッセージ断定。RLS以外の防衛線(関数内role再検証)の証跡化という意図どおり。
- **R4**: Runbook 10.1節の追記は要求水準を超えている。RLS遮断とAuthセッション失効の効果差を明記し、別利用者停止の誤操作防止(ID照合)とチェック欄まで含む。
- **R5**: 採用案(pending=初回承認待ち専用、UI割当先から除外、DB関数は5値維持)どおり。`satisfies readonly Exclude<ProfileRole, 'pending'>[]` による型固定と、既存pendingユーザーのdisabled option表示は、受け入れ条件で明示しなかった細部まで正しく処理している。回帰テストも確認。

## 3. バックアップ実装の指摘

### Blocker

なし。

### High

**H-1: 欠測(ジョブが発火しなかった日)を検知する仕組みがない。**

失敗時通知(ERR trap→ログ+osascript)は実行された失敗を確実に捕捉するが、真の無音失敗はジョブが走らないことである。`StartCalendarInterval` はMacスリープ中の発火を起床時に繰り越すが、電源オフ・長期ログアウト・plist破損では走らず、ログにもエラーにも何も残らない。対応はどちらかで可(前者を推奨):

- 軽量スクリプト `check-backup-freshness.sh` を追加し、`snapshots/` 最新の完了snapshotが48時間より古ければ失敗と同一の通知を出す。ログイン時launchd(RunAtLoad)または同一plistの別ジョブで実行。
- 最低限、Runbook 9節チェックリストへ「週次で最新snapshot日付を確認」を恒常運用項目として追加。

初回実行のGo条件には含めないが、launchd登録後2週間以内の導入を推奨する。

### Medium

**M-1: 空bucket時にスクリプトが失敗する。** `storage cp` が0件時に `storage/crm-files` ディレクトリを作らない場合、後続の `find "$INCOMPLETE_DIR/storage/crm-files"` がパス不存在で失敗する。productionには実ファイルがあるため顕在化しないが、`storage cp` の前に `mkdir -p "$INCOMPLETE_DIR/storage/crm-files"` を1行足せば除去できる(根拠: `backup-crm.sh` のstorage_files算出部)。

**M-2: stale lockと `.incomplete-*` の復旧手順がRunbook未記載。** 電源断・強制終了時に `.backup-lock` が残ると、以後の実行は「another backup is already running」で失敗し続ける。fail-closedかつ通知は出るので設計として安全だが、オーナーが復旧できるよう、Runbook 7節付近へ「実行中プロセスがないことを確認してから `.backup-lock` を削除する。`.incomplete-*` は原因確認後に手動削除する」を追記する。

### Low

**L-1: DB URLのref抽出regexが非アンカーの部分一致。** 理論上、無関係なURL文字列中に期待refが偶然含まれれば通過し得る。config自体が本人所有mode 600で、workdir link refとの二重照合が別に効いているため脅威モデル上の実害はほぼない。host部へのアンカー化は任意。

**L-2: `--exclude storage.buckets_vectors --exclude storage.vector_indexes` の理由コメントがない。** 将来の読み手が安全に見える削除をしないよう、除外理由を1行コメントで残す。

**L-3: `SCRIPT_VERSION=1` の更新規約が未定義。** スクリプト変更時にインクリメントする旨をファイル冒頭コメントへ。metadataの照合価値を保つため。

## 4. 依頼書7節の論点への回答

1. **ref二重照合**: 十分fail-closed。未知形式で停止する設計が正しく、直接接続(`db.<ref>.supabase.co`)とpooler(`postgres.<ref>:...@`)の両形式を覆う。部分一致の緩さはL-1のとおり許容範囲。実質の防波堤はDB URL refとworkdir link refの相互一致要求であり、片方の誤設定を他方が捕まえる構造になっている。
2. **`source` 方式**: 内部利用・単一オペレータでは妥当。owner+mode 600検証済みのconfigは、その利用者のshell profileと同じ信頼水準にある。専用parserは現段階では過剰。将来、複数マシン・複数運用者になった時点で再考すればよい。
3. **保持方式**: 受け入れ条件と一致。単一集合の和集合、重複コピーなし、不完全・想定外名称の削除拒否(exit 66/67のガード含む)は意図どおり。vitestの14+8週境界テストも確認した。
4. **Storage整合性**: 内部利用には checksum+件数+合計サイズで十分。`data.sql` に `storage.objects` の行が含まれるため、restore drill時に復元先の `select count(*) from storage.objects where bucket_id = 'crm-files'` とmetadataの `fileCount` を照合する1行をdrill手順へ追加すれば、追加実装なしにDB照合も得られる。スクリプトへの自動照合実装は不要。
5. **無音失敗防止**: 実行された失敗はカバー済み。未カバーは欠測(H-1)。成功通知は不要 — 毎日届く成功通知は数週間で無視されるようになり、通知チャネル自体の価値を下げる。ログ+freshness監視の組合せが正しい。
6. **手動確認・drillの不足**: 3点を追加する。(a)restore drillで `auth.users` の行が復元されていること(profilesのFK先であり、欠けると復元DBが機能しない)、および上記4のstorage.objects件数照合。(b)M-2の復旧手順。(c)H-1の欠測確認。

## 5. production初回実行前のGo/No-Go条件

既存Runbook 9節チェックリストに加え、次を満たすこと。

1. M-2の復旧手順がRunbookへ追記済み(初回実行前に必要。深夜の初回失敗時にオーナーが自力復旧できること)。
2. 初回手動実行の確認項目(Runbook 4節)を全件通過。
3. **初回restore drillの合格条件を拡張**: checksums全件一致、`auth.users`・`profiles`・`candidates` の行数がproduction時点の期待と一致、`storage.objects` 件数=metadataの `fileCount`、復元先での主要画面参照(候補者一覧・詳細・ファイル一覧)成功。
4. launchd登録後、翌日の自動実行成功をログで確認。
5. H-1(freshness確認)の方式決定と、スクリプト化する場合は2週間以内の導入予定の記録。

M-1・L-1〜L-3は初回実行を妨げない。

## 6. 次Batchの設計事項(先渡し)

### Batch 3: RLS initplan最適化

- 対象は行に依存しない `public.current_profile_role()` 呼出しのみ。`(select public.current_profile_role())` へのラップで、USING/WITH CHECKの真理値を一切変えない。
- 実装方式: ローカルDBの `pg_policies` から現行ポリシー全件を機械的に棚卸しし、書換え前後の定義差分を成果物として残す。1本の独立migrationにまとめ、認証・監査の変更と混在させない。
- 受け入れ条件: (1)pgTAP 44件+000/001の全断定が無変更で成功、(2)`pg_policies` 上で対象呼出しがすべてラップ済みであることを検証するpgTAPを1件追加、(3)EXPLAINでcandidates一覧クエリのInitPlan化を1例確認しrunbookでなくPR説明に記録。

### Batch 4: 監査actor

- 前提規約(action-plan記載済み)を再確認: actor引数を受け取るRPCは `service_role` GRANTに限定。`authenticated` へGRANTしない。
- 設計時にBatch 2の新経路も棚卸しへ含める: メール同期トリガー、backfill、および今後のバックアップ復元操作はいずれもactor nullのsystem operationとして分類し、監査仕様で「system」と「人間」を区別可能にする。

## 7. 確認した主な証跡

`scripts/backup/backup-crm.sh`(pointer/config所有・権限検証、mode分離、ref二重照合、BACKUP_ROOT範囲ガード、lock、incomplete→mvの原子化、完了マーカー後のローテーション、SUCCESS/ERRORログ)、`rotate-backups.sh`(保持和集合、削除3重ガード)、`com.candidatecrm.backup.plist.template`(プレースホルダー、StandardOut/ErrorPath)、`docs/backup-runbook.md`(FileVault前提、隔離workdir、失敗試験でproduction設定を壊さない注意)、`src/test/backup-scripts.test.ts`(静的安全契約の全OS検証+macOS実行検証の分離)、`supabase/tests/001`(14件、R1ヘルパー・R2・R3)、`src/features/settings/profile-model.ts` / `settings-page.tsx`(R5)、`docs/production-release-runbook.md` 10.1節(R4)。
