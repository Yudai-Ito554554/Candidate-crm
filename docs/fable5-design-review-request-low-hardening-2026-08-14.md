# Candidate CRM Fable 5 設計・レビュー依頼: 残Low hardening

- 作成日: 2026-08-14
- 実装担当: Codex
- 設計・レビュー担当: Fable 5
- 対象リポジトリ: `Yudai-Ito554554/Candidate-crm`
- 基準main: `da7135d9b9fe1969dea62b932e31a71d9d3210d0`
- production / staging操作: 本依頼書作成では未実施

## 1. 依頼目的

Fable 5がBatch 2〜4のApprove時に残したLow項目について、実装前に意味論・権限境界・バッチ分割・受け入れ条件を確定してください。実装はCodexが行います。Fable 5にはコード実装ではなく、設計判断と実装後レビューを依頼します。

M4（テスト安定化とRouter警告除去）はDB・認証・RLSの意味論を変更しないため、Codexが先に最小修正を実装済みです。こちらは設計承認ではなく、変更方針と検証証跡のレビューをお願いします。

## 2. M4: テスト安定化とHydrateFallback警告除去

### 2.1 原因

- `app-routes.test.tsx`単独では安定していたが、重いjsdomテストを複数file workerで同時起動すると、CPU・メモリ競合により正常な非同期UI待機が5秒を超えた。
- workerを2本へ制限した全体実行は一度成功したが、高負荷時に全体検索が再度失敗した。1本では全365件が成功した。
- 全体検索のクリックでは、`userEvent.click`が先に発生させるhoverによりactive optionが更新され、pointer eventの途中で対象候補が置換される競合もあった。
- 初期lazy routeの一部に`hydrateFallbackElement`がなく、React Router警告が出ていた。

### 2.2 実装済み変更

- `vite.config.ts`: `maxWorkers: 1`を設定。
- `src/pages/app-routes.test.tsx`: 当該クリック用user eventを`skipHover: true`とし、テスト目的をクリック遷移へ限定。
- `src/router.tsx`: `/forgot-password`とProtectedRoute配下の初期lazy routeへ既存の読み込みfallbackを追加。
- `src/test/reliability-ui.test.tsx`: テスト用routerにもfallbackを追加。

### 2.3 証跡

- 全体検索テスト: 10回連続成功。
- `app-routes.test.tsx` + `reliability-ui.test.tsx`: 95件成功。
- 全体: 69ファイル・365件成功。
- HydrateFallback警告: 0件。
- 業務ロジック、debounce時間、プロダクト側のAPI待機時間は変更していない。

### 2.4 レビュー依頼

1. workerを1本へ固定する方針は、現在のテスト規模とCI所要時間に対して許容か。
2. `skipHover`がテスト目的を狭めるだけで、ユーザー操作回帰を隠していないか。
3. fallback追加位置に不足がないか。

## 3. Batch 4 Low-1: 招待RPCをpending限定にする

対象: `public.apply_invited_profile_role(target_user_id uuid, new_role public.app_role, requester_id uuid)`

### 3.1 提案

- `UPDATE public.profiles ... WHERE id = target_user_id AND role = 'pending'`へ限定する。
- 対象が存在しない場合と、存在するが非pendingの場合は同じ`P0002`で拒否し、profileの存在や現在roleを呼出元へ漏らさない。
- Edge Functionが受け付ける付与先は現状どおり`agent`/`viewer`のみとし、意味論を拡張しない。
- service role限定GRANT、verified requesterの検証、監査actor帰属は変更しない。

### 3.2 回帰テスト案

- pending profileへのagent/viewer適用は成功する。
- agent、viewer、admin、suspended profileへの適用は`P0002`で拒否される。
- 拒否時にprofileと監査ログが変更されない。
- anon/authenticatedからの関数EXECUTE拒否を維持する。

### 3.3 確認事項

1. 非pendingと不存在を同じ`P0002`へ畳む設計でよいか。
2. migrationは関数の`CREATE OR REPLACE`とpgTAPだけの独立commitでよいか。

## 4. Batch 4 Low-2: trigger-only関数のEXECUTE整理

対象候補6件:

1. `public.prevent_archiving_referenced_records()`
2. `public.prevent_referenced_application_identity_change()`
3. `public.refresh_email_thread_from_message()`
4. `public.set_updated_at()`
5. `public.validate_application_relation()`
6. `public.validate_job_contact_company()`

### 4.1 提案

- triggerとしてのみ使われ、Data API/RPCからの直接呼出しが不要であることをカタログとコードで再確認する。
- 専用migrationで`PUBLIC`、`anon`、`authenticated`からEXECUTEをREVOKEする。
- 監査actor、trigger本体、RLS、テーブルGRANTは変更しない。
- trigger経由のINSERT/UPDATEが従来どおり成功・拒否することをpgTAPで確認する。

### 4.2 Fable 5へ判断を求める点

PostgreSQL関数は既定でPUBLIC EXECUTEを持つため、PUBLICからREVOKEすればservice_roleもPUBLIC経由の直接実行権限を失います。6件はtrigger-onlyなので、service_roleの直接実行も不要と考えています。

1. `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated`とし、service_roleへ明示GRANTしない方針でよいか。
2. 将来のmigration作成者が同じ問題を再導入しないよう、6件の固定リストだけでなくtrigger関数全体をカタログ検査するpgTAPを追加すべきか。
3. 監査actor migrationとは分離した独立migrationでよいか。

## 5. Batch 3 Low: pgTAPの診断性

### 5.1 提案

- `002_rls_initplan.test.sql`の複合assertionを次の2件へ分割する。
  1. 対象policy件数が51件である。
  2. 正規化後に直接`current_profile_role()`呼出しが0件である。
- plan数を更新し、失敗時に件数変化と未ラップ再導入を即座に区別できるようにする。
- `003_rls_initplan_explain.test.sql`冒頭へ、PostgreSQLメジャー更新でEXPLAIN表記が変化した場合は、先に002の意味論・完全性テストを確認する保守コメントを追加する。
- migrationやRLS policyは変更しない。

### 5.2 確認事項

上記はテスト診断性だけの変更として、DB権限hardeningとは別commitにしてよいか。

## 6. Batch 2 Low: バックアップfreshness監視

### 6.1 通知文言の閾値連動

現状は閾値を`FRESHNESS_MAX_AGE_SECONDS`で変更できる一方、通知文言が「48時間」固定です。秒数から時間または日数を算出し、実設定値に連動した文言へ変更する案です。

### 6.2 想定外エラーの通知

現状の意味ある失敗経路は`fail()`を通りますが、想定外のshellエラーはlaunchd stderrだけに残り、通知されません。`ERR` trapを追加する場合、`fail()`とtrapの二重通知を防ぐ必要があります。

提案:

- `NOTIFICATION_SENT=0`を持つ。
- `fail()`が通知したら1へ変更して終了する。
- `trap 'handle_unexpected_error $? $LINENO' ERR`は、未通知時だけ固定文言で通知し、秘密値・パスを含めない。
- 成功時の通知なし、ログだけという既存仕様を維持する。

### 6.3 共通validation library

Fable 5前回レビューは「3本目のスクリプトが生まれた時点で共通libへ抽出」としていました。現在も実行時スクリプト追加の必要はないため、今回は抽出せず二重管理を許容する案です。

### 6.4 確認事項

1. ERR trap案がlaunchd実行と`set -euo pipefail`の組合せで妥当か。
2. 閾値表示は、3600で割り切れる場合は「N時間」、86400で割り切れる場合は「N日」、それ以外は「N秒」でよいか。
3. 共通lib抽出は引き続き延期でよいか。

## 7. 推奨バッチ分割

CodexはFable 5承認後、次の意味単位で実装する案です。

1. M4テスト安定化（すでにローカル実装済み）
2. Batch 3 pgTAP診断性（テストのみ）
3. Batch 4 pending限定RPC（migration + pgTAP）
4. Batch 4 trigger-only EXECUTE整理（独立migration + pgTAP + 静的Vitest）
5. Batch 2 freshness通知改善（shell + テスト + Runbook）

各commitで`git diff --check`を行い、ブランチ全体で次を必須とします。

- `npm run format`
- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run verify:repo`
- `npm run supabase:reset`
- `npm run supabase:test`

## 8. Fable 5への最終依頼

次を返してください。

1. 各提案のApprove / 修正要求 / 保留。
2. Batch分割と実装順の承認。
3. trigger-only関数からservice_roleの直接EXECUTEも除く判断。
4. pending限定RPCの失敗意味論と必要な追加テスト。
5. freshness ERR trapの二重通知防止設計。
6. M4変更のレビュー結果。

承認後の実装、commit、push、CI確認はCodexが担当します。

## 9. Fable 5レビュー結果と実装状況

Fable 5の正式回答は`docs/fable5-review-low-hardening-result-2026-08-14.md`へ記録した。設計判断はすべて実装へ反映済み。

| 項目                           | 実装commit | 状態                                                                  |
| ------------------------------ | ---------- | --------------------------------------------------------------------- |
| M4の将来スケーリング注記       | `7892d64`  | 完了。worker 1本を維持し、必要時は重いjsdom suiteを分離する方針を記録 |
| Batch 3 pgTAP診断性            | `40b3289`  | 完了。件数と直接呼出しを分離し、EXPLAIN保守コメントを追加             |
| Batch 4 pending限定RPC         | `af8a6cb`  | 完了。非pending/不存在は`P0002`、pending付与は`22023`                 |
| Batch 4 trigger EXECUTE整理    | `130022e`  | 完了。汎用カタログpgTAPと将来のメール同期復帰経路コメントを追加       |
| Batch 2 freshness通知hardening | `39b5232`  | 完了。一時マーカー、ERR補助trap、動的閾値表示を追加                   |

### 9.1 実装HEADとCI

- 実装検証HEAD: `f840963938ce5aac3a7a211c5d713ee96dc46808`
- 成功CI Run ID: `31808266181`
- CI URL: <https://github.com/Yudai-Ito554554/Candidate-crm/actions/runs/31808266181>

| ジョブ                               | 結果 | 所要時間 | Test step |
| ------------------------------------ | ---- | -------- | --------- |
| Quality checks (`macos-latest`)      | 成功 | 4分26秒  | 1分46秒   |
| Quality checks (`windows-latest`)    | 成功 | 8分14秒  | 2分25秒   |
| Supabase migration and policy checks | 成功 | 2分46秒  | 3秒       |

比較対象Run `31794106603`（同じ`maxWorkers: 1`を含む最初の公開HEAD）では、macOSが7分02秒（Test 2分36秒）、Windowsが6分46秒（Test 2分15秒）だった。今回のTest stepはmacOSで50秒短縮、Windowsで10秒増加に収まり、worker 1本固定によるCI時間は現行規模で許容範囲と判断した。ジョブ全体の変動は主にRust/Tauriビルド時間であり、Vitest固定workerの増加ではない。テスト規模が増えてCI時間が問題化した場合は、worker競合を戻さず重いjsdom suiteを分離する。

### 9.2 ローカル検証

| チェック                 | 結果                              |
| ------------------------ | --------------------------------- |
| `npm run format:check`   | 成功                              |
| `npm run typecheck`      | 成功                              |
| `npm run lint`           | 成功                              |
| `npm test`               | 71ファイル・376件成功（105.45秒） |
| `npm run build`          | 成功                              |
| `npm run verify:repo`    | 成功                              |
| `npm run supabase:reset` | 全migration再適用成功             |
| `npm run supabase:test`  | 6ファイル・70 assertion成功       |
| `git diff --check`       | 成功                              |

最初のCI Run `31797310203`では、追加pgTAPのfixtureが存在しない`public.app_role`型へcastしていたためSupabaseジョブが失敗した。`f840963`でfixtureを既存スキーマどおりtext値へ修正し、ローカルのクリーンDB再適用・pgTAPと上記CIで再確認した。アプリ、RLS、migration本体の意味論は変更していない。

ローカルVitestでは、高負荷状態で既知の`app-routes.test.tsx`タイムアウトが一度再現し、対象単体は直後に468msで成功、クリーンな全体再実行は376件すべて成功した。CIのmacOS・Windowsでも全件成功しており、製品コードの回帰ではなくホスト資源競合として扱う。M4の将来方針は重いjsdom suiteの分離であり、業務タイムアウト延長やworker並列化への巻き戻しは行わない。

### 9.3 運用状態

production初回バックアップ、分離環境restore drill、launchdのバックアップ・freshness監視登録、および登録直後のlaunchd実地実行は完了している。翌日の定刻自動実行は、次回Mac利用時にログと最新snapshotで確認する運用項目として残る。今回のLow hardening実装・検証ではproduction / stagingへ接続・変更していない。

### 9.4 Fable 5への実装後レビュー依頼

`da7135d..f840963`を対象に、次を正式レビューしてください。

1. M4の固定worker、`skipHover`、HydrateFallback補完とCI実測が妥当か。
2. pending限定RPCの失敗意味論と、非pending・不存在・pending付与拒否テストが十分か。
3. trigger-only関数のEXECUTE境界と、将来メール同期時の明示GRANT復帰経路が妥当か。
4. RLS pgTAP診断分割とEXPLAIN保守コメントが十分か。
5. freshnessの一時通知マーカー、補助ERR trap、動的閾値表示が二重通知や秘密値漏洩を起こさないか。
6. Blocker / High / Mediumの有無と、`main`へのマージ可否。
