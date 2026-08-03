# Candidate CRM

転職エージェント向け候補者 CRM のデスクトップアプリです。Phase 1 では、macOS と Windows の双方で開発できる基盤とセットアップ確認画面のみを提供します。

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

`.env.example` を `.env` にコピーできますが、Phase 1 では環境変数をまだ使用しません。

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

## Phase 1 の範囲外

Supabase 接続、認証、候補者管理、求人管理、パイプライン、データベース、AI 連携は未実装です。
