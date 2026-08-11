# Candidate CRM Fable 5 設計・セキュリティレビュー依頼書

作成日: 2026-08-11

対象リポジトリ: `Yudai-Ito554554/Candidate-crm`

対象コミット: `1fe067969613e63a9432445bf892381c3b5a7cad`

## 1. レビューの目的

Candidate CRMは、転職エージェント向けのmacOS・Windows対応デスクトップCRMです。

現在、プロジェクトオーナー本人によるproduction内部利用を開始できる段階まで実装・検証されています。一方、外部顧客への販売・一般提供に必要なStage 3は未完了です。

Fable 5には、既存実装を全面的に作り直す提案ではなく、次の観点から設計・セキュリティ上の妥当性をレビューしてもらいたいです。

- 外部顧客へ提供する前に解決すべき設計上の重大リスク
- 現在のRLS、認証、AI、ファイル管理のセキュリティ境界
- 単一組織版から複数顧客向けSaaSへ移行する際の設計
- macOS・Windowsの正式配布方式
- Supabase Freeプランから有料運用へ移行する判断基準
- Stage 3の優先順位とGo/No-Go条件

## 2. 現在地点

### Production Stage 1

2026-08-10にGo判定済みです。

- productionのDBバックアップを取得
- 非公開Storage `crm-files`のバックアップを取得
- productionとは分離した環境でrestore drillを実施
- migration dry-runを実施
- `email_threads`と`files`の更新可能列を制限
- migration適用後にSQLで列権限を検証
- 対象migrationが業務データを変更しないことを確認

正式な記録は`docs/production-go-no-go-checklist.md`と`docs/production-release-runbook.md`にあります。

### Production Stage 2

2026-08-10にGo判定済みです。

- production向けmacOS内部版を作成
- オーナー本人によるログイン・ログアウトを確認
- アプリ再起動後のセッション復元を確認
- ホーム画面の表示を確認
- 架空候補者によるAI候補者サマリー生成を確認
- 監査ログへの記録を確認
- デスクトップアプリにはSupabase publishable keyだけを使用
- `service_role`キーをデスクトップアプリへ設定していない

### Production内部版CI成果物

`Production internal desktop artifacts` workflowは実行済みです。

- Run: `31482456482`
- Source commit: `d5a8fc176e6e7dad0374f457166b14fb97ea1610`
- macOS・Windowsとも成功
- production URLとpublishable keyだけを使用
- macOS DMGとアプリのSHA256を確認
- ad-hoc署名をCIで検証
- 外部配布は禁止している

この成果物はApple Developer ID署名・NotarizationおよびWindowsコード署名前の内部検証版です。

## 3. 実装済みの主要機能

- メールアドレス・パスワード認証
- セッション復元、ログアウト、パスワード再設定
- admin、agent、viewer、pendingのロール管理
- 候補者、職歴、企業、採用担当者、求人、選考の管理
- 活動、タスク、今日の予定、ホーム集約、レポート
- 候補者パイプライン
- 非公開Storageによるファイル管理
- Inboxの閲覧と対応ステータス管理
- 候補者・企業・求人・タグの横断検索
- 重複警告
- 論理アーカイブと復元
- 未保存変更保護
- CSVからの候補者一括登録
- 履歴書テキストからの候補者入力補助
- 文字入りPDFからの端末内テキスト抽出
- AI候補者サマリー
- テキスト、PDF、公開URLからのAI求人票取り込み
- AI利用回数、利用枠、トークン数、モデル別集計
- 監査ログ
- stagingとproductionのUI・OSアプリ識別
- macOS・WindowsのCI、QA成果物、production内部版成果物

機能の詳細は`README.md`のPhase 2.5からPhase 6Kを参照してください。

## 4. 現在のセキュリティ境界

### 認証と権限

- Supabase AuthのユーザーIDを認証主体とする
- 業務テーブルの`owner_id`は`auth.users(id)`を参照する
- `profiles`は表示名とロールを保持する
- 新規ユーザーは`pending`となり、管理者承認まで業務データを参照できない
- `admin`と`agent`は業務データを書き込める
- `viewer`は参照のみ
- 画面上のUI非表示は補助であり、実際の権限境界はPostgres RLSで強制する
- ロール変更はadmin確認付きの`set_profile_role` RPCだけを使用する
- 最後の管理者を0人にする変更はDB側で拒否する

### データ変更

- 通常業務で物理DELETEを使用しない
- 候補者、企業、求人、活動、タスク、ファイルなどは`archived_at`で論理アーカイブする
- タスク完了は`completed_at`で表現する
- 選考ステータス履歴と監査ログはデスクトップから変更できない
- メール本文は同期された事実として扱い、デスクトップは本文を変更できない

### ファイル

- Supabase Storageの非公開`crm-files`バケットを使用する
- 公開URLを生成しない
- Storageパスへ元のファイル名を含めない
- 通常UIからStorageオブジェクトを物理削除しない
- ファイル本文を`localStorage`へ保存しない

### AI

- `OPENAI_API_KEY`と`SUPABASE_SERVICE_ROLE_KEY`はEdge Function Secretsだけに置く
- デスクトップへ秘密鍵を渡さない
- AI実行前にJWTと`profiles.role`を確認する
- 氏名、メール、電話、生年月日、`private_notes`を候補者AI入力から除外する
- 自由記述に含まれる連絡先らしき文字列も置換する
- OpenAI Responses APIで`store: false`を指定する
- Structured Outputsを使用する
- AI生成結果は人間による確認を前提とする
- AI利用回数はPostgres内で原子的に制限する
- 求人票本文、URL、ファイル名、AI入力、AI出力を利用履歴へ保存しない

### 監査ログ

- DBトリガーで主要な作成・更新・アーカイブ・復元を記録する
- 実行者、操作、対象ID、変更フィールド名、時刻などのメタデータだけを保存する
- 候補者本文、private notes、メール本文、AI出力、変更前後値を複製しない
- adminだけが参照できる

## 5. 自動検証の状態

ローカルで以下を確認済みです。

- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm test`: 65ファイル、339件成功
- `npm run build`: 成功
- `npm run verify:repo`: 成功
- Supabase pgTAP: 27項目

最新HEADの通常CIは`HANDOFF.md`のPrettier未整形だけで失敗しています。アプリコードやDBテストの失敗ではありません。

- Failed run: `31488166882`
- DB migration and policy checks: 成功
- macOS・Windows quality checks: `HANDOFF.md`のformat checkで停止

## 6. 現在判明している問題

### 6.1 最新HEADのCIがgreenではない

`HANDOFF.md`がPrettier未整形のため、`npm run format:check`が失敗します。

アプリコードは直前のgreen commitから変更されておらず、ローカルの型チェック、Lint、テスト、ビルドは成功しています。ただし、リポジトリ運用上は文書を整形してCIをgreenへ戻す必要があります。

### 6.2 全体検索テストのflaky報告

`src/pages/app-routes.test.tsx`の「全体検索から候補者詳細へ移動できる」が、過去のフルスイート3回中1回タイムアウトしました。

今回の再検証結果:

- 対象テスト単独10回: すべて成功
- `app-routes.test.tsx`全92件: 成功
- 全65ファイル・339件: 成功

検索には250ms debounceがあり、テストは詳細見出しを3秒で待機しています。業務ロジック不良より、並列負荷と遅延ルート読込みを含むタイミング依存の可能性が高いと考えています。

### 6.3 React Routerのテスト警告

テスト実行時に次の警告が2箇所で出ます。

```text
No `HydrateFallback` element provided to render during initial hydration
```

テストは成功していますが、ログノイズとして整理が必要です。

### 6.4 引き継ぎ文書の一部が古い

`HANDOFF.md`にはproduction内部版workflowが未実行と書かれていますが、Run `31482456482`で既に成功しています。

ただし、一般配布用の正式署名済みworkflowは未完成です。

## 7. Stage 3の未完了項目

- Stage 2後の内部利用期間中に重大障害がないことの判定
- viewerが編集URLを直接開けないことの実アカウント確認
- 正規の招待メール受信、初回パスワード設定、ディープリンク復帰
- AI求人票取り込み例外系のmacOS・Windows実機UAT
- 企業・求人の重複警告、アーカイブ、復元の実地確認
- Windows実機でのインストール、起動、終了、再起動、アンインストール
- macOS Developer ID署名とNotarization
- Windowsコード署名
- 一般配布用の正式な署名済みビルドパイプライン

社内試験運用はSupabase Freeプランを継続する判断済みです。外部顧客への有料提供前にPro移行を再判定します。

## 8. Fable 5にレビューしてほしい設計論点

### 論点A: 複数組織対応

現在は単一組織を前提に、承認済みユーザーが同じワークスペースのデータを共有します。

外部顧客へ販売する場合、次の設計が必要です。

- `organizations`と`organization_memberships`のモデル
- 全業務テーブルへの`organization_id`
- テナント境界を強制するRLS
- 招待先組織の確定方法
- 組織間データ移動の禁止
- 管理者が最後の組織管理者を削除できない制御
- service roleを使うEdge Functionでの組織境界再検証

レビュー質問:

1. 外部提供前に複数組織対応を必須とすべきか。
2. 現在の単一組織版を顧客ごとに別Supabase projectで提供する暫定方式は許容できるか。
3. 組織境界RLSの正本をmembershipテーブルだけに置く設計で十分か。

### 論点B: `SECURITY DEFINER`関数

現在、管理者ロール変更、AI利用枠、監査、候補者閲覧履歴などに`SECURITY DEFINER`関数があります。

実装では以下を行っています。

- `search_path`を固定
- `public`と`anon`から実行権限をREVOKE
- 必要な関数だけ`authenticated`または`service_role`へGRANT
- 関数内でロールを再検証
- pgTAPで権限を固定

レビュー質問:

1. APIから呼び出す関数を`public`に置き、厳密なGRANTで守る現在方式は妥当か。
2. API非公開関数を`private` schemaへさらに移すべきか。
3. `current_profile_role()`をRLSから多数呼び出す方式に、性能・再帰・権限上の懸念があるか。

### 論点C: 認証・招待・利用者停止

現在はSupabase Authと`profiles.role`を組み合わせています。

レビュー対象:

- 招待メール再送
- 招待期限切れ
- メールアドレス変更
- 退職者・契約終了者の即時停止
- 管理者アカウント喪失時の復旧
- MFA必須化
- leaked password protection
- セッション強制失効
- FreeプランとカスタムSMTPの制約

レビュー質問:

1. `pending`を停止済みユーザーにも使用してよいか、`suspended`を分離すべきか。
2. 外部提供時にTOTP MFAをadminへ必須化すべきか。
3. Supabase Proへの移行を外部提供の必須条件にすべきか。

### 論点D: ログイン情報入力省略

ユーザーから、メールアドレスとパスワードを毎回入力しない機能の要望があります。

制約:

- パスワードを`localStorage`へ保存しない
- 候補者情報と認証情報を独自ファイルへ平文保存しない
- Supabaseの通常セッション復元は既に利用している

候補方式:

- メールアドレスだけを安全な非機密設定として記憶
- パスワードはmacOS KeychainとWindows Credential Managerを使用
- OSの資格情報管理を使わず、Supabaseセッション復元だけに限定

レビュー質問:

1. CRMアプリがパスワード自体を保存する必要があるか。
2. セッション切れ後の再認証だけにOS資格情報管理を使用すべきか。
3. Tauri pluginまたはRust側実装のどちらが適切か。

### 論点E: AIデータガバナンス

現在は入力最小化、連絡先の置換、`store: false`、Structured Outputs、人間確認を採用しています。

レビュー対象:

- モデル更新時の回帰評価
- 誤抽出率・見逃し率の基準
- AI生成情報を候補者・企業へ送る前の承認責任
- AI出力の保存期間
- AI入力・出力を保存しない場合の事故調査可能性
- 医療・採用領域で扱うべき説明責任
- OpenAIとのDPA・データ処理条件

レビュー質問:

1. AI入力・出力を保存しない現行方針と、監査可能性のバランスは妥当か。
2. AI出力のモデル・プロンプトバージョン・生成日時だけを残す現在方式で十分か。
3. 外部提供前にどの評価データセットと合格基準が必要か。

### 論点F: 正式配布パイプライン

現在のmacOS・Windows成果物は社内検証用の未署名版です。

レビュー対象:

- Apple Developer ID署名
- Notarization
- Windows EVコード署名
- 証明書・秘密鍵の保管
- GitHub Environment承認
- build provenance
- SBOM
- dependency scanning
- 自動更新
- バージョンロールバック
- 緊急配布停止

レビュー質問:

1. 外部提供前に自動更新機能まで必須か。
2. 署名鍵はGitHub Actionsのsecretで扱うべきか、外部署名サービスを使うべきか。
3. production成果物をGitHub Actions artifactではなくReleaseへ昇格する際の承認方式は何が適切か。

### 論点G: viewer直接URLアクセスの実機検証

自動テストでは候補者・企業・求人の新規・編集6ルートを保護しています。

一方、Tauriアプリには通常のURLバーがなく、実アカウントで「URLを直接入力する」操作の定義が不明確です。

候補方式:

- 自動テストとRLSテストを正式な証跡とする
- テスト専用ディープリンクを実装する
- WebDriver/E2Eで内部ルートへ遷移する
- 開発者ツールによる手動確認をUATとする

レビュー質問:

1. Stage 3の合格条件として、どの検証方式を正式採用すべきか。
2. 本番コードへテスト専用の導線を追加せずに証明できるか。

### 論点H: Gmail・Outlook連携

現在は型とInbox表示基盤だけがあり、OAuth・同期・送信は未実装です。

実装前に検討が必要な事項:

- OAuthクライアント秘密情報の保管
- refresh tokenの暗号化
- Webhookまたは定期同期
- メールの重複排除
- メール本文の保持期間
- 添付ファイルのウイルススキャン
- 退職・権限変更時の接続解除
- メール送信の監査
- 送信前確認と誤送信防止

レビュー質問:

1. Supabase Edge Functionsだけで同期基盤を構成するのが妥当か。
2. メール本文をCRMへ複製するか、必要時にプロバイダーから取得するか。
3. メール送信機能をInbox同期より先に実装すべきでない、という現在方針は妥当か。

## 9. Fable 5に求める成果物

次の形式でレビュー結果を返してください。

1. 重大度別の指摘
   - Blocker: 外部提供前に必ず修正
   - High: Stage 3 Go前に対応推奨
   - Medium: 内部利用中に対応
   - Low: 将来改善
2. 各指摘の根拠
3. 推奨する設計
4. 現在設計を維持できる部分
5. migration・RLS・認証方式の変更が必要か
6. 変更が必要な場合の安全な実装順序
7. Stage 3 Go/No-Goチェックリストへ追加すべき項目
8. 追加すべき自動テストと実機UAT

レビューでは、既存RLSやmigrationを直接変更せず、まず設計案とリスク評価だけを提示してください。

## 10. 参照ファイル

- `HANDOFF.md`
- `AGENTS.md`
- `README.md`
- `docs/production-go-no-go-checklist.md`
- `docs/production-release-runbook.md`
- `docs/uat-checklist.md`
- `docs/rollback-runbook.md`
- `src/router.tsx`
- `src/features/auth/`
- `src/features/access/`
- `src/lib/env.ts`
- `src/lib/supabase.ts`
- `supabase/migrations/`
- `supabase/functions/`
- `supabase/tests/000_schema_security.test.sql`
- `.github/workflows/ci.yml`
- `.github/workflows/desktop-artifacts.yml`
- `.github/workflows/production-internal-artifacts.yml`

## 11. レビュー時の禁止事項

- productionへ接続しない
- productionデータを読み出さない
- production migrationを適用しない
- Supabase Dashboardの設定を変更しない
- Edge Functionをdeployしない
- service role key、OpenAI APIキー、DBパスワードを表示・要求しない
- 既存migrationを書き換えない
- 設計レビュー段階でコード変更・commit・pushを行わない
