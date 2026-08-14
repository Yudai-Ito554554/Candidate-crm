# Candidate CRM Fable 5レビュー結果: 残Low hardening

- レビュー日: 2026-08-14
- 設計・レビュー担当: Fable 5
- 実装担当: Codex
- 基準main: `da7135d9b9fe1969dea62b932e31a71d9d3210d0`

## 1. 結論

Fable 5は5提案中4件をApproveし、Batch 4 Low-2だけに補足修正を求めた。バッチ分割と実装順は承認された。production / stagingの変更は伴わない独立hardeningとして実装する。

## 2. 承認・修正事項

### M4

- worker 1本固定、`skipHover`、Router fallback追加をApprove。
- `vite.config.ts`へ、テスト増加でCI時間が問題化した場合もworker競合を戻さず、重いjsdomテストの分離を検討する旨を残す。
- ブランチCIで実測所要時間を記録する。

### Batch 4 Low-1

- `apply_invited_profile_role`を`pending` profile限定にする。
- 不存在と非pendingは同じ`P0002`とする。
- `pending`から`pending`への適用は入力検証が先に働き`22023`となる順序をテストで固定する。

### Batch 4 Low-2

- trigger-only関数から`PUBLIC`、`anon`、`authenticated`のEXECUTEをREVOKEし、`service_role`へ明示GRANTしない。
- `refresh_email_thread_from_message`は、将来Gmail / Outlook同期が直接実行を必要とする場合だけ、別のレビュー済みmigrationで`service_role`へ明示GRANTする復帰経路をコメントに残す。
- 固定6件だけでなく、`public` schemaの全`RETURNS trigger`関数を対象に、`PUBLIC`、`anon`、`authenticated`がEXECUTEを持たないことをカタログ検査する。

### Batch 3 Low

- RLS policy件数と未ラップ直接呼出しの断定を分割する。
- PostgreSQL更新でEXPLAIN証跡が落ちた場合は、先に意味論を検証する002を確認する保守コメントを追加する。

### Batch 2 Low

- `ERR` trapを追加するが、条件式や`||`左辺などを完全には捕捉しないため、取りこぼしを縮小する補助線であると明記する。
- 二重通知防止はshell変数でなく、プロセス専用一時ディレクトリ内のマーカーファイルを使う。
- 閾値表示は日、時間、秒の順で選択する。
- 共通validation libraryの抽出は延期する。

## 3. 運用確認

production初回バックアップ、launchd登録、freshness監視、分離環境restore drillは2026-08-14に完了済み。launchd登録後の手動・launchd経由実行は成功している。翌日の定刻自動実行結果は、初回スケジュール到来後に確認する。

## 4. Fable 5への次回依頼

Codexが設計どおり実装し、全ローカル検証とブランチCIを通した後、実装差分、commit SHA、CI Run ID、CI所要時間を記載したレビュー依頼を提出する。
