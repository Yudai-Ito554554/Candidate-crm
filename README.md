# Candidate CRM

転職エージェント向け候補者 CRM のデスクトップアプリです。macOS と Windows の双方で開発できる基盤に加え、Phase 3Aでは候補者中心の業務UIを維持したままSupabase認証を導入しています。

## 技術スタック

- Tauri 2 / React / TypeScript / Vite
- Tailwind CSS / shadcn/ui
- React Router / TanStack Query
- React Hook Form / Zod
- Vitest / Testing Library
- ESLint / Prettier

## 必要環境

- Node.js 22 以上
- npm 10 以上
- Rust stable
- Tauri 2 の OS 別 prerequisites

Tauri の prerequisites は[公式ドキュメント](https://v2.tauri.app/start/prerequisites/)を参照してください。Windows では Microsoft C++ Build Tools と WebView2、macOS では Xcode Command Line Tools が必要です。

## セットアップ

```sh
npm install
```

`.env.example` を `.env` にコピーし、SupabaseのProject URLとPublishable keyを設定してください。不足または形式不正の場合は、CRM画面の代わりに設定エラー画面を表示します。

```sh
cp .env.example .env
```

`service_role`キーはデスクトップアプリへ設定しないでください。

## 開発

ブラウザでフロントエンドを起動します。

```sh
npm run dev
```

Tauri デスクトップアプリを起動します。

```sh
npm run tauri dev
```

## 品質チェック

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npm run build
```

Tauri アプリ自体のビルドは次のコマンドです。

```sh
npm run tauri build
```

## Phase 2.5 の画面

- 今日の対応を起点とするホーム
- 候補者一覧・候補者内パイプライン
- タイムラインを起点とする候補者詳細
- 求人一覧・求人詳細
- Inbox
- 今日の予定
- タスク一覧
- レポート
- 設定

データは `src/data/mock-data.ts` と `src/data/workspace-data.ts` の型付き仮データです。パイプラインの変更は画面内だけで保持され、再読み込みすると元に戻ります。未実装操作は画面上で「次の Phase で実装予定」と案内します。

## Phase 3A のSupabase認証

- メールアドレス・パスワード認証とセッション復元
- 未ログイン時のCRMルート保護
- 現在端末からのログアウト
- ログアウト時のTanStack Queryキャッシュ破棄
- 環境変数のZod検証と日本語設定エラー
- 認証エラーの日本語表示

画面データ自体は既存のTypeScript仮データを引き続き使用します。

## 現在の範囲外

データベースmigration、profilesテーブル、候補者データのSupabase取得、新規登録、ユーザー招待、パスワード再設定、Googleログイン、ファイル・メール・AI連携は未実装です。
