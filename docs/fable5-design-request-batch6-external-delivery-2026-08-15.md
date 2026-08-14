# Candidate CRM Fable 5設計・レビュー依頼: Batch 6 外部提供基盤

- 作成日: 2026-08-15
- 実装担当: Codex
- 設計・レビュー担当: Fable 5
- 対象リポジトリ: `Yudai-Ito554554/Candidate-crm`
- 基準commit: `859798c`
- 対象環境: macOS / Windows / Supabase
- production操作: 本依頼では実施しない

## 1. 依頼目的

Candidate CRMは、オーナー本人によるmacOS production内部利用まで完了している。Fable 5レビュー対応Batch 1〜5、productionバックアップ、restore drill、launchdによる日次バックアップ、M4テスト安定化、残Low hardeningも完了している。

次のBatch 6では、外部顧客へ販売・一般提供するための基盤を設計する。Fable 5には実装ではなく、Codexが安全に実装できる粒度の設計書と受け入れ条件の提示を依頼する。

Batch 6は一括実装しない。下記の独立サブバッチへ分割し、各サブバッチを「Fable 5設計 → Codex実装 → Fable 5レビュー → mainマージ」の順で進める。

## 2. 現在地点

### 2.1 完了済み

- Tauri 2 / React / TypeScriptによるmacOS・WindowsデスクトップCRM
- Supabase Auth、RLS、監査ログ、ユーザー招待・停止、admin/agent/viewer/pending権限
- macOS Keychain / Windows Credential Managerへrefresh tokenのみを保存するセッション復元
- 候補者、企業、求人、選考、タスク、ファイル、AI候補者サマリー、AI求人取り込み
- AIへの入力最小化、連絡先redaction、`store: false`、Structured Outputs、人間による確認
- production内部版のmacOS実機確認
- Freeプランを補う日次論理バックアップ、Storageバックアップ、freshness監視、restore drill
- macOS / Windows / SupabaseのGitHub Actions品質チェック

### 2.2 Stage 3で残る主要項目

- Windows実機でのインストール・起動・再起動・アンインストール
- macOS Developer ID署名・Notarization
- Windows Authenticode署名
- 正式署名済みproductionビルドパイプライン
- custom SMTPによる正規招待メールUAT
- MFAの必須化範囲とAAL2強制境界
- leaked password protectionを含むSupabase Pro移行判断
- AI入力の同一性・再現性を本文保存なしで証明するメタデータ
- 利用規約、プライバシーポリシー、委託先一覧、インシデント対応Runbook

## 3. 非交渉の設計境界

1. service role key、DB password、署名秘密鍵、証明書passwordをクライアントやGitへ含めない。
2. access token、refresh token、パスワード、候補者情報をlocalStorageへ保存しない。
3. refresh tokenは既存Batch 5のOS資格情報ストア境界を維持する。
4. RLSを最終認可境界とし、UI非表示だけで権限を守らない。
5. AI入力本文、求人原文、候補者原文を新たにログ・監査表へ保存しない。
6. productionとstagingのidentifier、Keychain/Credential Manager、Supabase project、secretsを分離する。
7. 同一Supabase projectに別顧客を同居させない。複数組織RLSが別途完成するまでは顧客ごとのproject分離を前提とする。
8. 署名鍵はGitHub-hosted runnerの永続ファイルや成果物へ残さない。
9. 法的文書は専門家確認前に「法的に完成」と扱わない。
10. production migration・production設定変更・外部送信は、設計承認と明示的なGo判定後にのみ行う。

## 4. 公式仕様から確定している前提

### 4.1 Supabase Auth / MFA

- JWTの`aal`は`aal1`または`aal2`であり、TOTP等のMFA成功後は`aal2`になる。
- MFA画面を追加するだけでは強制にならない。RLS、RPC、Edge Functionを含むサーバー側でAAL2要件を検証する必要がある。
- TOTP MFAを第一候補とする。Phone MFAを必須前提にしない。
- leaked password protectionはPro以上で利用可能。
- 既存セッションとの整合、MFA登録前ユーザーの段階移行、端末紛失時の復旧を設計しなければならない。

公式資料:

- [JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [Multi-Factor Authentication](https://supabase.com/docs/guides/auth/auth-mfa)
- [Password security](https://supabase.com/docs/guides/auth/password-security)
- [User sessions](https://supabase.com/docs/guides/auth/sessions)

### 4.2 Supabaseメール送信

- Supabaseの標準SMTPはproduction用途を想定していない。
- 標準SMTPでは送信先、レート、SLAに制約がある。
- 外部顧客への招待、password reset、メール変更を正規運用する前にcustom SMTPが必要。
- SPF、DKIM、DMARC、送信ドメイン分離、レート制御、障害時の代替手段を運用設計に含める。

公式資料:

- [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

### 4.3 バックアップ

- Pro / Team / Enterpriseには日次DBバックアップがある。
- DBバックアップはStorage実体を含まないため、現行の独立StorageバックアップはPro移行後も必要。
- Free継続中の現在は、実装済みの日次論理バックアップとrestore drillを維持する。
- PITRは日次バックアップと別機能・別料金であり、事業要件とRPO/RTOから判断する。

公式資料:

- [Database Backups](https://supabase.com/docs/guides/platform/backups)

### 4.4 macOS配布

- Mac App Store外で配布するproduction版はApple Developer Program加入、Developer ID Application証明書、Hardened Runtime、署名、Notarization、ticket stapleを前提とする。
- `altool`ではなく`notarytool`を使用する。
- Gatekeeper評価と署名検証をCI・リリース受け入れ条件に含める。

公式資料:

- [Developer ID](https://developer.apple.com/support/developer-id/)
- [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Preparing your app for distribution](https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution)

### 4.5 Windows配布

- Authenticode署名とRFC 3161 timestampを前提とする。
- SHA-256を使用し、署名後にSignToolで検証する。
- 証明書またはクラウド署名サービスの選定は、利用可能地域、法人要件、費用、GitHub Actions連携、秘密鍵非持ち出しを比較して決める。

公式資料:

- [SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)
- [Time Stamping Authenticode Signatures](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures)
- [Sign an MSIX package](https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview)

## 5. 設計を依頼するサブバッチ

### Batch 6A: AI入力provenance

#### 目的

AIへ送った本文を保存せず、同一入力・redaction規則・入力schemaを後から識別できるようにする。

#### 現状

- `ai_generation_requests`は候補者サマリーのserver-only利用メタデータを保持する。
- `job_import_requests`は求人取り込みのserver-only利用メタデータを保持する。
- 両テーブルは原文・prompt・provider responseを保存しない。
- Edge Functionsは連絡先等をredactし、OpenAI APIへ`store: false`で送る。

#### Fable 5へ求める判断

1. ハッシュ対象を「redaction後かつcanonical serialization後のprovider入力」としてよいか。
2. raw SHA-256で十分か。それとも低エントロピー入力の推測耐性のため、server-only secretを使うHMAC-SHA-256が必要か。
3. HMACの場合、key version、rotation、過去記録の検証不能化をどう扱うか。
4. canonical JSONの規則（UTF-8、改行、Unicode normalization、object key順、配列順、null/undefined）をどう固定するか。
5. `redaction_version`、`input_schema_version`、`hash_algorithm`、`hash_key_version`、`input_fingerprint`の型・制約・NULL可否。
6. 候補者サマリーと求人取り込みで同一schemaにするか、別version namespaceにするか。
7. hashはprovider送信直前に計算するか。retry/cache hit/失敗時にいつ保存するか。
8. 監査ログ、利用メタデータ、AI出力との関連付けと保持期間。
9. service role以外からのSELECT/INSERT/UPDATEを引き続き拒否するRLS・GRANT設計。

#### 必須成果物

- migration案
- Edge Function変更点
- TypeScript型
- pgTAPとVitestの受け入れ条件
- backfill方針（原文がない既存行は推測して埋めない）
- rollout/rollback方針

### Batch 6B: TOTP MFAとAAL2強制

#### 目的

外部提供時のアカウント乗っ取り耐性を上げつつ、管理者ロックアウトやバックグラウンド処理停止を防ぐ。

#### Fable 5へ求める判断

1. TOTP MFAをadminだけ先行必須化するか、全ロールへ必須化するか。
2. 新規招待、既存ユーザー、MFA未登録ユーザーの段階移行。
3. `aal2`を要求する操作・テーブル・RPC・Edge Functionの一覧。
4. 全業務テーブルへrestrictive RLSを追加するか、重要操作のみ段階適用するか。
5. AAL2 JWTと既存Keychain/Credential Manager内refresh tokenの更新・再起動復元フロー。
6. TOTP登録、challenge、verify、解除、再登録のUI状態遷移。
7. 端末紛失、Authenticator紛失、管理者全員ロックアウト時の復旧手順。
8. factor解除・復旧を誰が実行できるか。監査actorをどう記録するか。
9. service roleのEdge Function、Authメール同期、バックアップ・restoreがAAL2ポリシーで壊れない境界。
10. session timeout、reauthentication、leaked password protectionをPro移行とどう組み合わせるか。

#### 必須成果物

- 状態遷移図
- RLS/RPC/Edge Function境界表
- migration案
- UIルートとコンポーネント構成
- recovery runbook
- pgTAP/Vitest/Tauri実機UAT項目
- 段階rolloutとrollback方針

### Batch 6C: Authメール・custom SMTP

#### 目的

招待、password reset、メール変更を外部顧客へ安定して届け、S3-5を完了できる状態にする。

#### Fable 5へ求める判断

1. SMTP事業者選定基準。特定事業者を推す場合も代替可能な境界にする。
2. auth専用domain/subdomain、From、Reply-To、SPF/DKIM/DMARC方針。
3. invite、password reset、email changeごとのredirect/deep-link設計。
4. Tauriが未起動、起動済み、リンク期限切れ、別端末でリンクを開いた場合のUX。
5. resend、rate limit、bounce、complaint、delivery failureの運用。
6. メール本文へ候補者情報などの業務データを含めない制約。
7. secrets配置、rotation、staging/production分離。
8. S3-5合格条件と障害時runbook。

### Batch 6D: 署名済みrelease pipeline

#### 目的

macOSとWindowsの一般配布用成果物を、再現可能かつ秘密鍵を漏らさずに生成・検証する。

#### Fable 5へ求める判断

1. macOS証明書、notary credentials、Windows証明書またはクラウド署名identityのGitHub Secrets/Environments設計。
2. Apple Developer ID署名、Hardened Runtime、entitlements、Notarization、staple、`codesign`/`spctl`検証の順序。
3. Windows署名対象（installer、exe、dll）、RFC 3161 timestamp、SignTool検証の順序。
4. unsigned QA workflowとsigned production workflowの分離。
5. protected environment、manual approval、tag/version、source SHA、artifact manifest、SHA-256、provenanceの要件。
6. pull requestやforkから署名secretsへ到達させないイベント条件。
7. signing失敗、notarization拒否、timestamp障害時のfail-closed動作。
8. 証明書更新・失効・漏洩時のrotation/revocation runbook。
9. universal macOS buildの要否とWindows installer形式の確定。
10. S3-10〜S3-13の完了判定。

#### 必須成果物

- GitHub Actions job/permission/environment設計
- secret一覧（値は記載しない）
- Tauri設定変更一覧
- 成果物・manifest形式
- 署名検証コマンドと受け入れ条件
- certificate rotation/revocation runbook
- Windows/macOS実機UAT表

### Batch 6E: 外部提供時の運用・法務境界

#### 目的

技術実装と、専門家確認が必要な法務・運用項目を分離した上で、販売前の最低限の文書体系を定義する。

#### Fable 5へ求める判断

1. 利用規約、プライバシーポリシー、委託先一覧、データ保持・削除方針の技術入力項目。
2. Supabase、OpenAI、SMTP、GitHub等を委託先一覧へどう記載するか。
3. 個人情報・要配慮個人情報の入力禁止/許容範囲とUI上の注意。
4. インシデント分類、初動、証拠保全、通知、復旧、事後レビューのrunbook。
5. 顧客解約・データ返却・削除・バックアップ失効の手順。
6. project-per-tenant方式の作成、運用、廃止手順。
7. 技術チームが作成可能なdraftと、弁護士・社労士・個人情報保護の専門家確認が必要な箇所の境界。

## 6. 横断的な設計質問

1. Stage 3を「社内Windows利用」と「外部有償顧客提供」の2段階へ分けるべきか。
2. S3-3はTauriにURLバーがないため、自動テスト6ルートを正式な合格証跡としてよいか。実機確認が必要なら、productionへ新たなdeep-link攻撃面を増やさない検証方法は何か。
3. Supabase Proを外部有償提供の必須条件とするか。Free＋独自バックアップを許容する期間があるか。
4. PITRの導入条件をRPO/RTO、候補者件数、顧客数、売上のどれで定めるか。
5. MFA、custom SMTP、署名pipeline、AI provenanceのうち、外部テスター1社を迎える前に必須のものはどれか。
6. 顧客ごとのSupabase project分離をいつまで許容し、multi-tenant再設計へ移る判断基準は何か。
7. 既存の「メールアドレスを安全に自動入力したい」という要望は、Batch 5のrefresh token復元で実用上解消済みと扱うか。追加する場合、パスワード保存は行わずOS標準autofillまたは非機密メール設定のどちらにするか。

## 7. Fable 5への提出形式

各サブバッチについて、次を含む実装可能なMarkdown設計書を返してほしい。

1. 採用案と却下案、その理由
2. 信頼境界と脅威モデル
3. データモデル、migration、GRANT/RLS
4. フロントエンド、Edge Function、Rust/Tauri、CIの責務分担
5. エラー処理とfail-closed条件
6. rollout、rollback、既存利用者移行
7. 自動テストと実機UATの受け入れ条件
8. production変更前のGo/No-Go条件
9. 外部契約・証明書・有料プランがなくても先行実装できる範囲
10. Codexへ渡す実装順とcommit分割

設計が相互依存する場合でも、最初に実装できる最小サブバッチを明示すること。Fable 5は実装を行わず、Codexが設計承認後に実装する。

## 8. Codexが提案する実装順

1. Batch 6A（AI provenance）: 外部契約なしで実装可能。ただしhash/HMACの設計判断後に着手。
2. Batch 6B（TOTP MFA）: TOTP中心なら先行可能。production強制は段階rollout後。
3. Batch 6C（custom SMTP）: 送信domain・事業者契約後に設定/UAT。
4. Batch 6D（署名pipeline）: Apple Developer ProgramとWindows署名手段の取得後に完成。
5. Batch 6E（運用・法務）: 技術draftは並行可能。一般販売前に専門家確認。

## 9. 現時点の外部ブロッカー

Codexだけでは完了できず、オーナー判断または契約・実機が必要なもの:

- Windows実機
- Apple Developer Program加入とDeveloper ID証明書
- Windowsコード署名証明書または利用可能なクラウド署名サービス
- custom SMTP事業者と送信domain
- Supabase Pro/PITRの購入判断
- 法務文書の専門家確認

これら以外の設計・コード・自動テスト・CI・ドキュメント作成はCodexが担当する。
