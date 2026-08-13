# Batch 5設計書: セッション資格情報のOS資格情報ストア化

- 作成日: 2026-08-13
- 作成: Fable 5（設計）/ 実装: Codex
- 前提: Batch 4がmainへマージ済み（`03cde05`）。Batch 4残Low 2件は本Batchに混在させない。
- 解決する指摘: Batch 1レビューH3（refresh tokenがWebView localStorageへ平文永続）
- 対応する要望: ログイン情報の再入力省略（パスワード保存なしで実現する）

## 1. 設計目標と非目標

目標:

1. Supabaseセッションの長期資格情報（refresh token）をディスク平文から排除し、macOS Keychain / Windows Credential Managerへ移す。
2. 既存のセッション復元UX（再起動後も再ログイン不要）を維持する。
3. 既存ユーザーの旧localStorageセッションを一度だけ安全に移行し、旧データを確実に消す。
4. staging版とproduction版が同一マシンで共存してもセッションが混ざらない。

非目標:

- パスワードの保存は行わない。
- メールアドレスの記憶は本Batchに含めてよいが、非機密設定として扱い、OS資格情報ストアは使わない。
- オフライン起動時のセッション復元は行わない。

## 2. 方式の選定

案A（refresh tokenだけをOSストアへ保存し、起動時に`auth.refreshSession()`を呼ぶ。`persistSession: false`）と、案B（supabase-jsのcustom storage adapterでセッションJSON全体をOSストアへ保存）を比較し、**案Aを採用する**。

理由:

1. access token・userオブジェクトはディスクへ書かず、保存する秘密を最小化できる。
2. Windows Credential Managerのblobサイズ上限に対し、refresh token単体なら十分小さい。
3. 公開API（`refreshSession`、`onAuthStateChange`）だけで構成でき、supabase-js更新の影響面が小さい。

受容するトレードオフ:

- 起動時のセッション復元にはネットワークが必要。オフライン時はログイン画面へ倒す。
- refresh token更新直後・保存前の強制終了では、次回起動時に再ログインが必要になる可能性があるが、セキュリティ劣化ではない。

## 3. アーキテクチャ

### 3.1 Rust側（Tauri commands）

`keyring` crateを使用し、次の3 commandを追加する。

- `secure_credential_set(key: String, value: String)`
- `secure_credential_get(key: String) -> Option<String>`
- `secure_credential_delete(key: String)`

設計規則:

- service名は`com.candidatecrm.desktop.production` / `com.candidatecrm.desktop.staging`。Tauri設定のidentifierから導出し、実行時環境変数では切り替えない。
- account名は`supabase-refresh-token`に固定する。commandのkey引数は許可リスト照合し、想定外keyは拒否する。
- 値をログへ出さず、エラーはkeyringの種別だけを返す。

### 3.2 フロントエンド側

- `persistSession: false`、`autoRefreshToken: true`。
- 起動時にOSストアからrefresh tokenを取得し、`auth.refreshSession({ refresh_token })`で復元する。
- 失効等の非一時エラーではOSエントリを削除する。ネットワーク断と区別できる場合は削除しない。
- `SIGNED_IN`と`TOKEN_REFRESHED`で最新refresh tokenを保存し、`SIGNED_OUT`で削除する。
- 保存・削除をawaitする。失敗はUIへ出さず、開発ログには秘密を含まない種別だけを記録する。

### 3.3 旧セッションの移行と消去

1. localStorageの`sb-<project-ref>-auth-token`を読む。
2. refresh tokenをOSストアへ保存し、`refreshSession`で確認する。
3. 成否にかかわらず旧localStorageキーを削除する。
4. 既に移行済みの再実行は無害にする。

### 3.4 fail-closed規則

OS資格情報ストアが利用できない場合、localStorageへフォールバックしない。セッション非復元へ倒す。

## 4. 既知の制約

1. macOS内部版はad-hoc署名のため、再ビルド時にKeychainアクセス許可が再表示され得る。Developer ID署名導入後に解消する。
2. Windows Credential Managerは同一ユーザーセッション内のプロセス分離を提供しない。保存時暗号化と平文ファイル露出の排除として説明する。
3. staging/productionの共存はservice名分離で担保する。

## 5. テスト（受け入れ条件）

自動:

- Rust: trait抽象＋テスト実装でset/get/deleteと許可外key拒否を確認する。
- Vitest: 保存済みtoken復元、復元失敗時削除、SIGNED_OUT削除、TOKEN_REFRESHED上書き、localStorage移行の冪等性と旧キー削除を確認する。
- 既存全テストを成功させ、DB migrationを追加しない。

macOS実機UAT:

- ログイン → 終了 → 再起動で再ログイン不要。
- ログアウトでKeychainエントリ削除。
- 旧localStorageセッション移行後に`sb-`キーが残らない。
- Keychainアクセス拒否時にfail-closedし、クラッシュしない。
- staging/productionのセッションが独立する。

Windows実機UATはS3-10と同時に行い、本Batchのマージ条件にはしない。

## 6. 実装順序

1. Rust commands、許可リスト、ユニットテスト
2. ブートストラップ／イベント連携、Vitest
3. 旧localStorage移行・消去
4. Runbook／HANDOFF／UAT追記
5. ブランチpush、CI、Fable 5レビュー、mainマージ
6. macOS実機UAT

## 7. Codexへの注意

- `npm run tauri build`を品質チェックに含める。
- Tauri capabilityで新commandをmain windowだけに許可する。
- 設計逸脱が必要なら実装せず、理由を添えてFable 5へ差し戻す。
