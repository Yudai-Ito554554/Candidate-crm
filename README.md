# Candidate CRM

転職エージェント向け候補者 CRM のデスクトップアプリです。macOS と Windows の双方で開発できる基盤に加え、Phase 3では候補者中心の業務UIを維持したまま、Supabase認証と組織単位のデータモデルを導入しています。

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

`.env.example` を `.env` にコピーし、SupabaseのProject URLとPublishable keyを設定すると認証モードになります。未設定の場合は従来どおり型付き仮データモードで起動します。

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

## Phase 3 のSupabase基盤

- メールアドレス・パスワード認証とセッション復元
- 未設定時に仮データモードへフォールバック
- 組織、ユーザー、企業、候補者、求人、選考、タスク、タイムライン、Inbox、AI分析の初期スキーマ
- 全業務テーブルのRow Level Security
- 組織をまたぐ参照を防ぐ複合外部キー
- 型付きSupabaseクライアントとデータ取得リポジトリ

ローカルDBの起動・migration適用方法は`supabase/README.md`を参照してください。実プロジェクトへ接続するまでは画面データ自体は既存の仮データを使用します。

## 現在の範囲外

実データへの画面切替、初期データ移行、ユーザー招待、パスワード再設定、ファイルアップロード、メール・AI連携、編集・新規登録フォームの保存は未実装です。
