# Candidate CRM 引き継ぎ文書（HANDOFF）

最終更新: 2026-08-17（Asia/Tokyo）
基準: `main`は`c34a9b6`。Batch 6Aはブランチ`fable5-ai-provenance-batch6a`（`main`未マージ、Fable 5レビュー前）

このドキュメントは、別のAIエージェントがこのセッションの文脈なしに作業を引き継げるようにするための資料です。実装状況の要約であり、詳細は各参照ファイルを直接読んでください。Fable 5承認済みBatch 1〜Batch 5、M4テスト安定化、残Low hardeningは`main`へ反映済みです。残Low実装HEAD `f840963`のCI Run `31808266181`と証跡HEAD `b361ee9`のCI Run `31809900804`は、いずれもmacOS・Windows・Supabase全3ジョブが成功しています。Batch 6A（AI入力provenance）は実装を終えていますが、レビューと`main`マージが未了です。

---

## 1. このプロジェクトの目的

Candidate CRM は、人材紹介・採用エージェンシー業務向けの Tauri 2（macOS/Windows）デスクトップCRMです。バックエンドはSupabase（Postgres + Auth + Storage + Edge Functions）。

- フロントエンド: React 19 + TypeScript + Vite + TanStack Query + React Hook Form + Zod + Tailwind CSS
- デスクトップシェル: Tauri 2（Rust）
- バックエンド: Supabase（RLSをロール境界として使用。`admin`/`agent`が書き込み可、`viewer`は閲覧のみ、`pending`は初回承認待ち、`suspended`は明示的な利用停止。後二者は業務データ非表示）
- 主要ドメイン: 候補者（candidates）、企業（companies）、求人（jobs）、選考（applications）、パイプライン、活動（activities）、タスク、ファイル、Inbox、ホーム集約、レポート、AI求人票取り込み、AI候補者サマリー、監査ログ

現在は「社内試験運用」フェーズで、プロジェクトオーナー本人によるproduction利用（Stage 2 Go判定済み）が進行中。外部顧客への一般提供（Stage 3）はまだ判定前。

プロジェクト全体のルール・構造は `AGENTS.md` に集約されている。**作業前に必ず読むこと。** 特に重要な制約:

- 物理DELETEは使わず、常に `archived_at` によるアーカイブ
- `service_role`キー・`OPENAI_API_KEY`はEdge Function secretsのみ、Vite クライアントコードに絶対含めない
- OS固有の絶対パスをtrackedファイルに含めない（`npm run verify:repo`が検査）
- スキーマ変更は必ず`supabase/migrations`の順序付きファイルで行う（Dashboard直接変更禁止）
- RLSなしのビジネステーブルを作らない

---

## 2. 現在までに実装した内容（機能面、README.mdのPhase一覧が正式な記録）

`README.md` にPhase 2.5〜Phase 6Kまでの全実装履歴が時系列で記載されている（候補者/企業/求人CRUD、パイプライン、選考管理、活動/タスク、ファイル管理、Inbox、ホーム、レポート、監査ログ、AI候補者サマリー、AI求人票取り込み〔テキスト/PDF/URL、根拠表示、企業照合、キャッシュ等〕、ロール権限、閲覧専用UI、未保存変更保護、重複警告、アーカイブ/復元 等）。**機能の詳細を知りたい場合はREADMEの該当Phase節を参照すること（このHANDOFF.mdでは再掲しない）。**

このセッションで新規に行った作業（時系列、git log降順の逆）:

1. **本番セキュリティ修正**（commit `692fffe`ほか）: `email_threads`/`files`テーブルの列単位UPDATE権限に不備があり、`authenticated`ロールに対して意図した列（`status`/`archived_at`のみ等）以外も更新可能だった。原因はPostgresのGRANTが加算的であり、列スコープGRANTの前に`REVOKE UPDATE ON TABLE ... FROM authenticated`をしていなかったこと。2migrationで修正（`supabase/migrations/20260808003737_*.sql`, `20260808043603_*.sql`）。
2. **ファイルアーカイブ確認ダイアログの修正**（commit `7bbc5de`, `dc8bd81`）: `window.confirm()`がTauri WebView内で無反応（ダイアログが出ずmutationも発火しない）だったため、独自Reactモーダルに置き換え。見出し+`aria-labelledby`、初期フォーカス、Escape、フォーカストラップ、フォーカス復帰まで実装。
3. **production移行用ドキュメント作成**: `docs/production-release-runbook.md`（1210行、本番作業の全手順）、`docs/production-go-no-go-checklist.md`（3段階Go/No-Go判定表）。複数回のレビューで堅牢化（BACKUP_DIRのポインタファイル化、fail-closedな接続文字列検証、`set -euo pipefail`＋マーカーファイルによるゲート、`npm ci`化等）。
4. **staging/production のUI上の視覚的区別**（commit `369c956`）: `VITE_APP_ENV`（`staging`|`production`、zod検証、デフォルト`production`）を導入し、`EnvironmentBadge`コンポーネントでSTAGINGバッジを表示。
5. **認証ゲート画面のSTAGINGバッジ欠落バグ修正**（commit `b5562d8`）: ログイン確認中画面・pending承認待ち画面にバッジがなかった不具合を修正。
6. **staging QA版の独立アプリ化**（commit `280731b`, `beb843d`）: `src-tauri/tauri.staging.conf.json`を新規追加し、`productName`/`identifier`/ウィンドウタイトルを本番と別にした（本番用`tauri.conf.json`は無変更）。これにより`/Applications`へ本番版とstaging版を同時に置ける。Desktop QA artifacts workflowを`--config src-tauri/tauri.staging.conf.json`でビルドするよう変更。ローカルで実機ビルド・共存を検証済み。
7. **本番Stage 1・Stage 2の実施**（ユーザー本人がRunbookに沿って別途実施、`docs/production-go-no-go-checklist.md`に記録済み）: 上記2migrationのproduction適用、DB/Storageバックアップ、restore drill、production macOSビルドでのオーナー本人ログイン確認。**両段階ともGo判定済み。**
8. **staging role UAT の実施**（commit `333ab18`, `d7f827f`）: 最新staging独立アプリでadmin/agent/viewer/pendingの実ログインを行い、権限UI非表示・データ保護UI（未保存離脱確認等）を確認。`docs/production-go-no-go-checklist.md`のStage 3項目S3-2, S3-4, S3-8, S3-9を完了に更新。
9. **候補者CSV/履歴書インポート機能の追加**（commit `619f3d3`）: `/candidates/import`ページ、CSV取り込み（UTF-8/Shift_JIS、最大2MB・1,000名、列自動対応、重複検知）、履歴書テキスト貼り付け解析、Tauri Rust側でのPDF文字抽出（最大5MB）。詳細はREADME「候補者データ取り込み」節。
10. **production接続の社内検証用ビルドパイプライン追加・実行**（commit `9cbedc5`, `d5a8fc1`）: `.github/workflows/production-internal-artifacts.yml`（新規）と`scripts/verify-build-target.mjs`（新規）。40桁commit SHAと確認文字列の入力必須、`EXPECTED_PRODUCTION_REF`/`FORBIDDEN_STAGING_REF`によるビルド前後の接続先検証、GitHub Environment `production-internal-build`経由でproduction専用secretsを分離。Run `31482456482`でmacOS・Windowsの両成果物が成功し、source commit `d5a8fc1`との一致とmacOS成果物のSHA256・ad-hoc署名を確認済み。一般配布は禁止。
11. **Fable 5レビュー対応Batch 2の完了**（マージcommit `36e48c5`）: R1〜R5のpgTAP・運用ルール強化に加え、DB/Storageバックアップ、ローテーション、48時間のfreshness監視、launchdテンプレート、障害復旧手順を追加。Fable 5はBatch 2全体（`afbfcf8..bba0c02`）をApproveし、Blocker/High/Mediumなし。残りは共通検証libへの将来抽出、通知文言の閾値連動、freshnessのERR trapのLow 3件のみ。
12. **Fable 5レビュー対応Batch 3の完了**（マージcommit `b4d1301`）: 51件の有効なRLS policyにある行非依存の`public.current_profile_role()`全66箇所を`(select public.current_profile_role())`へ変更し、PostgreSQL InitPlanでstatement単位に評価される形へ最適化。`USING`/`WITH CHECK`の認可真理値は維持し、カタログ完全性テストと認証済み候補者一覧の`EXPLAIN`テストを追加した。Fable 5はApprove、Blocker/High/Mediumなし。LowはpgTAP診断の分割とEXPLAINテストの保守コメントのみ。
13. **Fable 5レビュー対応Batch 4の完了**（マージcommit `03cde05`）: `audit_logs.actor_kind`で`user`/`service`/`system`を区別し、認証済み操作、検証済みrequesterを伝播するservice-only RPC、メール同期等のsystem operationを監査上判別可能にした。`store_candidate_ai_summary`と`invite-user`のactor帰属を修正し、pgTAP T1〜T6を含む14 assertionとVitest静的確認を追加。Fable 5は`8351cd5..b759c20`をApproveし、Blocker/High/Mediumなし。`main`マージCI Run `31695344851`はmacOS・Windows・Supabaseの全3ジョブ成功。Lowは招待専用RPCの更新対象を`pending`へ限定する防御強化と、PUBLIC既定EXECUTEが残るトリガー関数6件の権限整理。
14. **Fable 5レビュー対応Batch 5の完了**（マージcommit `2e8e84e`）: Supabaseのrefresh tokenだけをmacOS Keychain / Windows Credential Managerへ保存し、access tokenとユーザー情報はメモリだけに保持する。`persistSession: false`とし、旧localStorageセッションは初回移行の成否にかかわらず削除する。Fable 5は`d7aebd1..bfaa033`をApproveし、Blocker/High/Mediumなし。macOS実機では本番・STAGING双方の終了/再起動後のセッション復元、本番ログアウト後もSTAGINGが維持される資格情報分離、新本番版のログイン/復元を確認した。Keychain明示拒否は実機未実施だが、資格情報ストア拒否時に平文fallbackせず`null`を返すfail-closed挙動は自動テストで確認済み。Windows実機UATはStage 3へ延期。
15. **M4テスト安定化とRouter警告除去**（`main`反映済み）: Vitestの多数のjsdomファイルを並列実行した際のCPU・メモリ競合が、正常な非同期UI待機を5秒超へ押し出す主因と特定した。テストworkerを1本へ固定し、全体検索テストではクリック検証に不要な合成hoverを省略した。初期lazy routeへ`hydrateFallbackElement`を補完し、React Router警告を除去した。全体検索テストは10回連続成功、全体は69ファイル・365件成功、HydrateFallback警告0件を確認済み。Fable 5は条件付きApproveし、将来はworker競合を戻さず重いjsdom suiteを分離する方針を`vite.config.ts`へ記録した（`7892d64`）。
16. **残Low hardeningの実装・CI検証**（マージcommit `9d49471`）: Batch 3のpgTAP診断分割（`40b3289`）、招待RPCのpending限定（`af8a6cb`）、trigger-only関数の直接EXECUTE権限整理（`130022e`）、freshness通知の一時マーカー・ERR補助trap・動的閾値表示（`39b5232`）を、Fable 5承認済み設計どおり実装した。fixture修正後の実装検証HEADは`f840963`、CI Run `31808266181`はmacOS・Windows・Supabaseの全3ジョブ成功。Fable 5の実装後レビューでApproveされ、`main`へ統合した。production / staging操作は行っていない。

17. **Fable 5レビュー対応Batch 6A（AI入力provenance）の実装**（ブランチ`fable5-ai-provenance-batch6a`、`main`未マージ）: AIへ送信した本文を保存せずに同一入力性とredaction規則の版を後から機械的に識別できるようにした。設計正本は`docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md`の2節。共有モジュール`supabase/functions/_shared/ai-provenance.ts`でcanonical serialization（NFC・CRLF→LF・キーのコードポイント昇順・null/undefinedキー除去・NaN/Infinity/循環参照でエラー）とHMAC-SHA-256を実装し、**生成した文字列をそのままprovider APIのbodyに使う**ことで「送ったもの」と「ハッシュしたもの」の乖離を構造的に排除した。raw SHA-256ではなくHMACを採用した理由は、DBダンプ漏洩時にfingerprintが確認オラクル化することを防ぐため（keyはEdge Function secretsのみ）。migration `20260817030000_ai_provenance_columns.sql`で`ai_generation_requests`と`job_import_requests`へ5列（`input_fingerprint`/`hash_algorithm`/`hash_key_version`/`redaction_version`/`input_schema_version`）とall-or-nothing制約を追加。Edge Function 2本はprovider送信の直前に5列をUPDATEし、HMAC key未設定・serialization失敗・UPDATE失敗の3経路でproviderへ送信せずエラー終了する。**2026-08-15以前に作成された既存行は5列すべてNULLであり、原文が存在しないためbackfillしない。**

---

## 3. 現在作業中の内容

**Fable 5レビュー対応Batch 1〜5、productionバックアップ・restore drill、M4テスト安定化、残Low hardeningは完了し、すべて`main`へ反映済み。Fable 5は残Low hardeningをApprove（Blocker・High・Mediumなし、任意Low 1件）し、実装CI Run `31808266181`と証跡CI Run `31809900804`はいずれも全3ジョブ成功。**

**Batch 6はFable 5が横断判断とBatch 6Aの設計を`docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md`として回答済み。Batch 6A（AI入力provenance）はブランチ`fable5-ai-provenance-batch6a`で実装済みだがFable 5レビュー前・`main`未マージ。6B〜6Eは外部契約（SMTP事業者、署名手段、Pro移行）の確定待ちで、同文書3節の起動条件が満たされた時点で個別に設計依頼する。**

Fable 5の横断判断で決まった重要事項:

- **Stage 3を3Aと3Bへ分割する**。3A（社内Windows展開）はS3-1/S3-3/S3-6/S3-7/S3-10とBatch 5のWindows残UATで、必要な外部資源はWindows実機のみ。3B（外部有償提供）はS3-5/S3-11〜13、Supabase Pro、MFA、custom SMTP、AI provenance、法務文書、テナント分離。3Aは3Bの外部契約を待たずにGo判定できる。
- **S3-3の合格証跡はweb buildをブラウザで実行する方式**（stagingへ向けたweb buildをviewerアカウントで開き、URLバーから編集6ルートを直打ちする）。テスト専用deep-linkの実装は引き続き不許可。
- **Supabase Proは外部有償提供の必須条件**。無償の外部テスター1社によるパイロットまではFree+独自バックアップで許容、課金開始日をもってPro移行を完了していること。
- **パイロットでも6C（custom SMTP）と6D（署名pipeline）は必須**。招待メールが届かなければログインできず、未署名ビルドはGatekeeper/SmartScreenで起動しないため、技術的にパイロットが成立しない。
- **メールアドレス自動入力の要望はBatch 5で実用上解消済み**として追加実装しない（5節バックログから除外）。

- R1〜R3: JWTエミュレーション共通化、Storage遮断、SECURITY DEFINER関数のsuspended/pending拒否をpgTAPへ追加。
- R4: 停止時は`suspended`化とSupabase Authのban・セッション失効を併用する運用をRunbookへ追加。
- R5: `pending`を初回承認待ち専用とし、割当UIから除外。DB RPCは保守用に5値を維持。
- Batch 2: `scripts/backup/`へDB/Storageバックアップ、ローテーション、freshness監視、launchdテンプレートを追加し、`docs/backup-runbook.md`へ設定・通知・restore drillを記載。
- Batch 3: `supabase/migrations/20260813024735_optimize_rls_role_initplan.sql`で51 policy・66箇所のロール参照をInitPlan形へ変更し、pgTAPとVitestで完全性・認可不変・実行計画を検証。Fable 5承認後に`main`へ`--no-ff`マージし、Run `31689015343`のmacOS・Windows・Supabase全ジョブが成功した。
- Batch 4: `supabase/migrations/20260813103834_audit_actor_attribution.sql`で監査actorを`user`/`service`/`system`へ分類し、AIサマリー保存と招待時ロール設定のverified requester帰属を実装。Fable 5は`8351cd5..b759c20`をApprove（Blocker/High/Mediumなし）。`main`へ`--no-ff`マージ済み（`03cde05`）で、Run `31695344851`のmacOS・Windows・Supabase全ジョブが成功した。残Lowの招待RPCのpending限定（`af8a6cb`）とtrigger-only関数の直接EXECUTE権限整理（`130022e`）も実装・レビューを終え、`main`へ反映済み。
- Batch 5: Tauri/Rustの固定allowlist付き資格情報コマンドとReact側のsecure session bootstrapを実装し、refresh tokenのみをOS資格情報ストアへ保存する。Fable 5は`d7aebd1..bfaa033`をApprove（Blocker/High/Mediumなし）。`main`へ`--no-ff`マージ済み（`2e8e84e`）で、Run `31763405157`のmacOS・Windows・Supabase全3ジョブが成功した。2026-08-14のmacOS実機UATで本番・STAGINGのセッション復元、ログアウト削除、環境間分離を確認した。Keychain明示拒否の実機操作とWindows Credential Manager実機UATは未実施。
- production初回バックアップ、launchd日次登録、48時間freshness監視、初回restore drillは2026-08-14に完了した。翌2026-08-15の02:30定刻ジョブも自動起動し、02:39に完了snapshotを作成して終了コード0となったことを確認済み。restore drillではproductionへ書き込まず、使い捨てローカル環境でDB件数・Storage件数・Auth・主要参照APIを確認し、完了後に隔離リソースを削除した。
- M4: 高並列jsdom実行によるホスト資源競合を再現し、`vite.config.ts`でテストworkerを1本へ固定した。全体検索テストは不要なhoverイベントを省略し、Routerの初期lazy routeには適切なfallbackを追加した。全体検索10回連続と全365件で成功し、HydrateFallback警告が出ないことを確認した。Fable 5の条件付きApproveを反映し、将来のテスト増加時はworker競合を戻さず重いjsdom suiteを分離する方針を追記した。
- 残Low hardening: Fable 5は実装後レビューでApprove（Blocker・High・Mediumなし）。`main`へ`--no-ff`マージ済み（`9d49471`）。実装検証HEAD `f840963`のCI Run `31808266181`と証跡HEAD `b361ee9`のCI Run `31809900804`は全3ジョブ成功。任意Lowとして、freshnessスクリプトの`mktemp -d`失敗はtrap設定前のため通知されないが、到達確率が極めて低く、現時点では対応不要と判断された。
- Batch 6A: ブランチ`fable5-ai-provenance-batch6a`で実装済み、Fable 5レビュー前・`main`未マージ。**オーナー作業として未実施のものが4件残る**: (1) staging・production双方のEdge Function secretsへ`AI_FINGERPRINT_HMAC_KEY_V1`を設定、(2) Edge Function 2本のdeploy、(3) stagingでAI候補者サマリーとAI求人取り込みを1回ずつ実行して5列の記録形式と同一入力の再現性を確認、(4) key未設定状態でのfail-closed動作をstagingで1回実証（確認後にkeyを戻す）。production適用条件は設計書2.12節が正本。

ただし、以下は「着手済みだが未完了」という意味で実質的に進行中の一連の取り組み:

- **Stage 3（外部顧客への一般提供）判定**: 14項目中、Go/No-Go未記入。多くの重大項目が未着手（詳細は4節）。
- **社内試験運用のWindows展開**: 次の最優先事項としてドキュメント上で明言されているが、Windows実機自体がまだない状態。

---

## 4. 未完了の内容（`docs/production-go-no-go-checklist.md` Stage 3表が正）

| 項目  | 状態  | 内容                                                                                                                                                                                |
| ----- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3-1  | ☐     | Stage 2 Go後の内部利用期間の経過待ち（期間はリリース判断者が定める）                                                                                                                |
| S3-3  | ☐     | viewerがURL直接入力で編集画面を開けないことの**実アカウントでの直接URL確認**（自動テストは済み。Tauriアプリにはブラウザのアドレスバーがないため、確認方法自体をどう定めるか未決定） |
| S3-5  | ☐     | 招待メールフローの実メール確認（Supabase Freeプランはオーナー本人のメールアドレスにしか送信できない制約あり）                                                                       |
| S3-6  | ☐     | AI求人取り込み例外系のmacOS/Windows実機での一連のUAT（自動テストは済み）                                                                                                            |
| S3-7  | △一部 | 企業・求人の重複/アーカイブ/復元の実地確認が未実施（候補者のみ確認済み）                                                                                                            |
| S3-10 | ☐     | **Windows実機でのインストール/起動/終了/再起動/アンインストール確認。次の最優先項目。**                                                                                             |
| S3-11 | ☐     | macOSコード署名・Notarization（Apple Developer Program未登録）                                                                                                                      |
| S3-12 | ☐     | Windowsコード署名（証明書未取得）                                                                                                                                                   |
| S3-13 | ☐     | 一般配布用の正式署名済みビルドパイプライン（社内検証用の未署名版は実装・実行済み）                                                                                                  |

B区分（どの段階も妨げないが未確認）: ホーム/今日の予定/Inbox/全体検索/オフライン通知のUI動作確認（B-1）、サイドバー折り畳み・キーボード操作・フォーカス表示の網羅確認（B-2、ファイルアーカイブモーダルのみ対応済み）、macOSディープリンクの実地確認（B-3）、未署名QA版の運用ルール整備（B-5）。

C区分（外部契約・実機・有料プラン待ち）: Windows実機（C-1）、Apple Developer Program（C-2）、Windowsコード署名証明書（C-3）、Supabase Proプランへの移行判断（C-4/C-5a/C-5b/C-6、現状はFree継続決定済み）、カスタムSMTP（C-7）。

D区分（今回のスコープ外、実装自体が未着手）: Gmail/Outlook同期のOAuth連携・同期処理（型定義の列挙値のみ存在、Edge Function・同期サービス本体は未実装）。

`production-internal-artifacts.yml`はRun `31482456482`で実行済み。GitHub Environment `production-internal-build`にはproduction用URLとpublishable keyだけを分離して登録し、`service_role`キーは登録していない。

---

## 5. 次に実装すべき内容（優先順位順、ドキュメント上の合意事項）

1. **Batch 6AのFable 5レビューと`main`マージ**: ブランチ`fable5-ai-provenance-batch6a`をレビューへ出し、承認後に`--no-ff`マージする。
2. **Windows実機でのstaging版UAT**（`docs/uat-checklist.md`に沿って）: インストール・起動・終了・再起動・アンインストール（S3-10）。社内の他利用者はWindowsを使うため最優先。Stage 3A（社内Windows展開）の中心項目。
3. **S3-3の実施**: Fable 5の回答どおり、stagingへ向けたweb buildをブラウザで起動し、viewerアカウントでURLバーから編集6ルートを直打ちして確認する。テスト専用deep-linkは実装しない。
4. **S3-7の企業・求人アーカイブ/復元の実地確認**（候補者は完了済み）。
5. Stage 3A残項目（AI求人取り込み例外系のOS実機一連UAT）を進め、3AのGo/No-Goを判定する。
6. **Batch 5残UAT**: Windows実機入手後にCredential Managerでログイン復元・ログアウト削除・staging/production分離を確認する。macOS Keychain明示拒否は、内部版で安全に再現できる手順を定めたうえで補完する。
7. Stage 3B（外部有償提供）に向けて: SMTP事業者を2〜3社に絞って6Cの設計依頼、Apple Developer Program登録・Windows署名手段の確定で6Dの設計依頼、Pro移行判断で6Bの設計依頼。6Eの法務draftは並行可。

---

## 6. 重要な設計判断とその理由

- **`archived_at`による論理削除のみ、物理DELETEなし**: 候補者データの誤削除防止と監査要件のため。`AGENTS.md`で全エンティティに一貫適用。
- **RLSをロール境界として使用し、クライアント側の表示制御は補助**: `admin`/`agent`が書き込み、`viewer`は閲覧のみ、`pending`は初回承認待ち、`suspended`は利用停止で、後二者はデータ非表示。UI側の非表示はUXのためであり、実際の権限境界はPostgres RLSで強制（`AGENTS.md`: "never treat client-side hiding as a substitute for RLS"）。
- **列単位GRANTは加算的**: 広いテーブルレベルGRANTがあると列スコープGRANTだけでは制限できない。列制限を行う際は必ず`REVOKE`を先に行う（2migrationで実際に踏んだ教訓）。
- **`window.confirm()`はTauri WebViewで信頼できない**: ネイティブダイアログではなくアプリ内モーダルで確認UIを実装する方針に統一。
- **staging/productionの区別を2階層で実装**: (1) UI上のSTAGINGバッジ（`VITE_APP_ENV`）、(2) OSレベルでの別アプリ化（`tauri.staging.conf.json`によるproductName/identifier分離）。理由は、社内テスターが誤って本番アプリを使う/本番アプリを上書きするリスクを両面から防ぐため。
- **Tauri `--config`はRFC 7396 JSON Merge Patch**: 配列は要素マージではなく丸ごと置換される。そのため`tauri.staging.conf.json`の`app.windows`は元の設定全体（width/height/minWidth/minHeight/dragDropEnabled/resizable/fullscreen）を複製した上でtitleだけ変えている。**この配列を部分的にしか書かないと、staging版のウィンドウサイズ制約等が silently消える。**
- **production-internal-artifacts.ymlをstaging workflowと完全に分離**: secrets（`PROD_VITE_SUPABASE_URL`等をGitHub Environmentで隔離）、成果物名、確認文字列（`BUILD_PRODUCTION_INTERNAL`固定文字列入力必須）、40桁commit SHA必須、ビルド前後で`scripts/verify-build-target.mjs`により接続先refを機械的に検証。理由は、誤ってstaging用ビルドがproductionに接続する/その逆が起きるリスクを構造的に防ぐため。
- **AIサマリー/求人取り込みはサーバー側（Edge Function）のみで生成**: `OPENAI_API_KEY`とモデルIDをクライアントに一切渡さない。AI入力はホワイトリスト方式で個人情報（氏名・メール・電話・生年月日・`private_notes`）を除外。
- **Supabase Freeプラン継続（2026-08-11決定）**: 社内試験運用中はコスト優先。手動バックアップ（Runbook 2〜3節）で代替し、外部顧客への有料提供前にProへの移行を再判定する方針。この決定によりS3-5（招待メール）・C-4〜C-6が制約を受けている。

---

## 7. 変更した主要ファイル（このセッション内、カテゴリ別）

**Tauri設定・ビルド**

- `src-tauri/tauri.staging.conf.json`（新規）
- `src-tauri/tauri.conf.json`（本番、無変更のまま維持）
- `.github/workflows/desktop-artifacts.yml`（staging config引数・artifact名変更）
- `.github/workflows/production-internal-artifacts.yml`（新規）
- `scripts/verify-build-target.mjs`（新規）

**セキュリティmigration**

- `supabase/migrations/20260808003737_restrict_email_thread_update_columns.sql`
- `supabase/migrations/20260808043603_restrict_files_update_columns.sql`

**staging/production区別**

- `src/lib/env.ts`, `src/vite-env.d.ts`
- `src/components/common/environment-badge.tsx`（+test）
- `src/components/layout/app-layout.tsx`（+test）
- `src/features/auth/auth-loading-screen.tsx`（+test）, `src/features/auth/protected-route.tsx`
- `src/pages/login-page.tsx`, `src/pages/forgot-password-page.tsx`, `src/pages/set-password-page.tsx`

**ファイルアーカイブ確認モーダル**

- `src/components/common/entity-files.tsx`（+test）

**候補者CSV/履歴書インポート**（commit `619f3d3`、詳細機能はREADME参照）

- `src/pages/candidate-import-page.tsx`（新規）
- `src/features/candidates/candidate-csv-import-panel.tsx`（新規）
- `src/features/candidates/candidate-resume-import-panel.tsx`（新規）
- `src/features/candidates/candidate-import-model.ts`（新規, +test）
- `src/features/candidates/candidate-form-model.ts`（新規）
- `src/features/candidates/candidate-form.tsx`, `src/features/candidates/candidate-queries.ts`
- `src/services/candidate-document-repository.ts`（新規, +test）, `src/services/candidates-repository.ts`
- `src/components/layout/global-create-menu.tsx`, `src/router.tsx`, `src/pages/candidates-page.tsx`
- `src-tauri/src/lib.rs`（PDF文字抽出のRustコマンド追加）, `src-tauri/Cargo.toml`

**ドキュメント**

- `docs/production-release-runbook.md`（新規、1210行）
- `docs/production-go-no-go-checklist.md`（新規、Stage 1〜3判定表。**現在の正式な進捗管理表、必ずこれを見ること**）
- `docs/uat-checklist.md`（新規、業務受け入れテスト観点。CSV取り込み関連観点を追加済み）
- `docs/rollback-runbook.md`（新規、配布後の切り戻し手順）
- `docs/development-handoff-2026-08-11.md`（前回セッションの詳細な作業ログ。本HANDOFF.mdより粒度が細かい時系列記録）
- `README.md`（各Phaseの実装記録、セットアップ手順、品質チェック手順を随時追記）

---

## 8. 現在判明している問題・バグ

- **M4のflaky挙動は解消済み（`main`反映済み）**: `src/pages/app-routes.test.tsx`の全体検索タイムアウトは、複数の重いjsdomファイルを同時実行した際のCPU・メモリ競合と、`userEvent.click`が先行hoverで検索結果を置換する競合が重なって発生していた。テストworkerを1本へ固定し、当該クリックを`skipHover`で目的に限定した。対象テスト10回連続、全69ファイル・365件で成功した。業務ロジックの待機時間は変更していない。
- **S3-3（viewerの編集URL直接アクセス拒否）の実機検証方法が未確定**: Tauriアプリにはブラウザのアドレスバーに相当するUIがなく、「URLを直接入力する」という検証手順をどう再現するか、Runbook/UATチェックリスト上でも解決していない。自動回帰テストでは6ルート（候補者・求人・企業の新規/編集）を確認済みだが、実機での確認が求められている。
- **Batch 1レビュー枝の通常CIは成功済み**: Run `31509690820`でmacOS、Windows、Supabase migration/policy checksの全3ジョブが成功。全migrationのクリーンDB再適用とpgTAPも成功した。
- **Windows側の未検証事項が多い**: staging独立アプリのproductName/identifier反映、PDFドラッグ&ドロップ、インストーラー全体の動作、いずれもWindows実機がないためCI上の自動テストのみで裏付けられており、実機確認が残っている。
- **既知の未実装領域**（バグではなく仕様上のスコープ外、README「現在の範囲外」節に明記）: Gmail/Outlook同期のOAuth・同期処理本体、メール送信/返信、ウイルススキャン、ファイル版管理、Googleログイン、カレンダー・Slack連携、検索履歴・高度な検索条件、複数組織対応、監査ログの長期保管・エクスポート、外部エラー監視サービス連携。

---

## 9. テスト状況

- テストランナー: Vitest（`npm test` = `vitest run`）
- 直近のローカル単一worker実行結果: **69 test files / 365 tests、全件成功**。全体検索テストは10回連続成功。React RouterのHydrateFallback警告は0件。`format`、`format:check`、`typecheck`、`lint`、`build`、`verify:repo`も成功。
- テスト方針: `vi.hoisted()`で共有モック状態を持つ、`vi.mock("@/lib/env", ...)`パターン、ワークフローYAMLやJSON設定ファイルは`node:fs/promises`で実ファイルを読み文字列アサーションする方式（`src/test/*.test.ts`）
- DB側のテスト: `supabase/tests`にpgTAPテストがあり、外部キー・RLS・クライアント権限・サーバー専用テーブルを検証。CIのDBジョブはUbuntu上のローカルSupabaseに全migrationを適用して実行（リモート接続なし、秘密情報不使用）。`npm run supabase:test`で実行可能（ローカルSupabase起動が前提）。
- CI: Batch 4実装HEAD `b759c20`のRun `31694194379`と、`main`マージHEAD `03cde05`のRun `31695344851`は、いずれもmacOS、Windows、Supabase migration/policy checksの全3ジョブ成功。後者では全migrationのクリーンDB再適用とpgTAPも成功した。

---

## 10. 環境構築や実行方法

`README.md`の「必要環境」「セットアップ」「開発」「品質チェック」節が正式手順（このHANDOFF.mdでは要点のみ）。

```sh
# 前提: Node.js 22+, npm 10+, Rust stable, Tauri 2のOS別prerequisites
npm install
cp .env.example .env
# .envにSupabaseのProject URLとPublishable keyを設定する
# service_roleキーは絶対にデスクトップアプリへ設定しない

# ブラウザでフロントエンドのみ起動
npm run dev

# Tauriデスクトップアプリを起動
npm run tauri dev
```

品質チェック（`AGENTS.md`「Required checks」と同一、変更を引き渡す前に必ず実行）:

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npm run build
npm run verify:repo
```

`src-tauri`配下を変更した場合は追加で:

```sh
npm run tauri build
```

staging独立アプリのローカルビルド確認:

```sh
npm run tauri build -- --config src-tauri/tauri.staging.conf.json
```

Supabase関連（ローカルDocker Supabaseが前提）:

```sh
npm run supabase:start
npm run supabase:reset   # 全migrationをクリーンDBへ適用
npm run supabase:test    # pgTAPテスト
npm run supabase:check:local   # readiness確認
npm run supabase:check:linked  # リンク先確認（project ref不一致で停止する設計）
npm run supabase:stop
```

**production/staging Supabaseへの直接操作は`docs/production-release-runbook.md`の手順に厳密に従うこと。** 隔離ディレクトリ・git worktreeを使い、メインの開発リポジトリをproductionにlinkしない。`supabase`パッケージは`2.111.0`に固定（`2.112.0`は`projects list`のパース不具合あり）。

---

## 11. 次のAIが作業を再開するための具体的な手順

1. **状況確認**（コード変更前に必ず実行）:

   ```sh
   git status
   git log --oneline -10
   gh run list --branch main --limit 5
   ```

   `git status`がcleanでないなら、それが誰の作業か（自分がこれから始める作業か、前回セッションの続きか）をユーザーに確認する。

2. **必読ドキュメント**（優先順）:
   - `AGENTS.md` — プロジェクトルール全体
   - `docs/production-go-no-go-checklist.md` — 本番移行の正式な進捗表（Stage 1/2はGo、Stage 3は未判定）
   - このファイル（`HANDOFF.md`）
   - `docs/development-handoff-2026-08-11.md` — より詳細な時系列ログ（本ファイルの元ネタ、粒度が細かい）
   - `docs/fable5-review-action-plan-2026-08-11.md` — Fable 5指摘の採否、実装順、production適用条件
   - `docs/fable5-review-batch1-result-2026-08-12.md` — Batch 1承認結果とBatch 2設計指針
   - `docs/fable5-review-request-batch3-2026-08-13.md` — Batch 3の実装範囲、検証HEAD、CI証跡、Fable 5レビュー論点
   - `docs/rls-initplan-policy-inventory-2026-08-13.md` — Batch 3で変更した51 policy・66箇所の棚卸し
   - `docs/backup-runbook.md` — 内部利用向け自動バックアップの設定・復元・運用手順、およびAI provenance HMAC keyの運用ルール（削除禁止・rotationは加算のみ・漏洩時の不可逆性）
   - `docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md` — Batch 6の横断判断（Stage 3分割、S3-3の証跡方式、Pro必須化、PITR条件、multi-tenant移行基準）とBatch 6Aの設計正本
   - `docs/fable5-review-brief-2026-08-11.md` — Fable 5へ渡した設計・セキュリティ論点と根拠
   - `README.md` — 機能の実装詳細（Phase単位）
   - `docs/uat-checklist.md` — 業務受け入れテスト観点
   - `docs/production-release-runbook.md` — 本番への実操作手順（実際にproductionを触る場合のみ）
   - `docs/rollback-runbook.md` — 配布後に問題が出た場合の切り戻し手順

3. **次にやるべきタスクの選び方**: 本HANDOFF.mdの4節「未完了の内容」と5節「次に実装すべき内容」を参照。Windows実機が利用可能なら**staging版UAT（S3-10）**を優先する。外部提供基盤は`docs/fable5-design-request-batch6-external-delivery-2026-08-15.md`をFable 5へ渡し、返却された設計をCodexが実装する。

4. **作業前の安全確認（このプロジェクト特有のルール）**:
   - `.env.local`・`.env`はコミット対象外であることを都度確認（`git status --ignored`で`!!`表示になっているか）
   - production/staging Supabaseへ接続するコマンド（`supabase link`、`supabase db push`等）を実行する前に、必ず対象project refを確認する（production: `dsaqarejqslzgcatkxeh`、staging: `admjgbfrfoczpxdtxmgy`。値そのものはこの文書に書いているが、実際にコマンドへ使う前に`docs/production-release-runbook.md`の手順で二重確認すること）
   - `supabase projects api-keys`は`--reveal`なしでもservice_role JWTを平文出力することがあるため、production/stagingどちらに対しても実行しない（過去に一度誤って実行し秘密漏洩インシデントとして扱った教訓）
   - 秘密情報らしき値をコミット・ログ・チャットへ出力しない

5. **変更を行ったら、コミット前に必ず`AGENTS.md`の「Required checks」を全て実行し、全て成功することを確認する**。

6. **ユーザーへの報告時**: 何を検証し、何を検証していないかを明確に分ける（このプロジェクトでは「自動テストで確認済み」と「実機/実画面で確認済み」を厳密に区別する運用が定着している。`docs/production-go-no-go-checklist.md`の記法：☒ 済／☐／△ 一部を参照）。

---

## 12. 秘密情報の扱いについての注記

このHANDOFF.mdにはパスワード・APIキー・接続文字列の値を一切含めていません。project ref（`dsaqarejqslzgcatkxeh`, `admjgbfrfoczpxdtxmgy`）はSupabaseダッシュボードURLの一部であり秘匿情報ではないため記載していますが、これ単体でproduction/stagingへアクセスすることはできません。stagingテストユーザー（`uat-admin`/`uat-agent`/`uat-viewer`/`uat-pending`、いずれも`@example-uat.invalid`）のパスワードは、このリポジトリのどのファイルにも記録されていません。必要な場合はプロジェクトオーナーに確認してください。
