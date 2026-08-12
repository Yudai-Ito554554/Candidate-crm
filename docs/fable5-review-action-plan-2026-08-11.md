# Fable 5レビュー対応計画

作成日: 2026-08-11

対象レビュー: Candidate CRM 設計・セキュリティレビュー結果（Fable 5）

基準HEAD: `1fe067969613e63a9432445bf892381c3b5a7cad`

## 1. 方針

レビュー指摘は、外部顧客提供前のBlocker、Stage 3前のHigh、内部利用中のMedium、将来改善のLowに分けて扱う。

- productionやstagingへ直接適用しない。
- schema変更は新規migrationとして追加し、既存migrationを書き換えない。
- migrationはローカルのクリーンDB、pgTAP、staging、restore drill、production Runbookの順で検証する。
- 認証、RLS、監査方式の変更は1つのmigrationへ混在させない。
- 外部提供時は、同一Supabase projectへ複数顧客を相乗りさせない。

## 2. レビュー指摘の採否

### 採用

| ID  | 指摘                               | 判断                                                                                         |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| B1  | テナント境界が存在しない           | 採用。同一projectへの複数顧客相乗りを禁止する。初期顧客はproject-per-tenantを候補とする。    |
| B2  | Freeプランに継続バックアップがない | 採用。内部利用向け日次バックアップを先に設計し、外部提供前はPro移行を必須判定とする。        |
| B3  | 正式コード署名が未完了             | 採用。外部配布のBlockerとして維持する。                                                      |
| B4  | 法務・データ保護文書が未整備       | 採用。技術実装と並行して専門家確認を前提に準備する。                                         |
| H1  | `profiles.email`がAuthと非同期     | 採用。Auth更新を正本としてプロフィール表示用メールを同期する。                               |
| H2  | `pending`と停止済みが混在          | 採用。`suspended`を独立ロールとして追加する。                                                |
| H3  | refresh tokenの保存先              | 採用。パスワード保存は行わず、Supabase Auth storageのOS資格情報ストア化を別Phaseで設計する。 |
| H4  | service role経路の監査actor欠落    | 採用。対象Edge FunctionとRPCを棚卸しし、actor帰属規約を統一する。                            |
| H5  | AI入力の再現性不足                 | 採用。本文を保存せず、redaction後入力ハッシュとバージョンを記録する案を設計する。            |
| H6  | SSRFのDNS再バインディング残余      | リスクとして採用。現行対策を維持し、取得プロキシ等は将来改善とする。                         |
| M1  | RLS関数のinitPlan最適化不足        | 採用。公式推奨どおり`(select public.current_profile_role())`へ変更する独立migrationを作る。  |
| M2  | 氏名redactionの表記ゆれ            | 採用。表記ゆれと海外連絡先を含む評価・単体テストを追加する。                                 |
| M3  | Edge FunctionのCORSが`*`           | 要追加調査。Tauri/WebViewと認証ディープリンクのorigin実測後に許可リストを決める。            |
| M4  | flakyテストとHydrateFallback警告   | 採用。優先度Lowの独立タスクとして、Batch 3完了後に原因を固定して解消する。                   |

### 保留

- 複数組織RLSへの大型移行は、初期顧客数とproject-per-tenant運用負荷が明確になるまで行わない。
- Gmail・Outlook同期は、認証・バックアップ・正式配布・監査actor対応より後にする。
- 自動更新は初回外部提供の必須条件にはしないが、顧客3社を目安に再判定する。

## 3. 実装バッチ

### Batch 0: CI green回復

- `HANDOFF.md`をPrettier整形する。
- production内部成果物Run `31482456482`の成功を反映し、未実行という古い記述を削除する。
- 全品質チェックを通す。

状態: ローカル完了。commit・push前。

### Batch 1: 利用者状態とAuth表示情報

- `suspended`ロールを追加する。
- `pending`を初回承認待ちだけに限定する。
- 停止済みユーザーには業務画面を描画せず、停止案内とログアウトだけを表示する。
- `auth.users.email`更新時に`profiles.email`を同期するtriggerを追加する。
- trigger helperをData APIから実行できないようREVOKEする。
- TypeScript union、表示ラベル、UI、静的migrationテスト、pgTAPを更新する。

状態: 実装・TypeScript検証完了。ローカルSupabase検証待ち。

### Batch 2: 内部利用向け自動バックアップ

- macOS内部利用向け日次DB/Storageバックアップを実装する。
- 成功・失敗通知、保持期間、暗号化、復元drill周期を定める。
- production障害時に候補者データを復元できない現在進行形のリスクを、性能改善より先に閉じる。

状態: 未着手。Batch 1のクリーンDB検証後に最優先で行う。

### Batch 3: RLS性能改善

- 現在有効な全policyをローカルDBから棚卸しする。
- 行に依存しない`current_profile_role()`を`(select public.current_profile_role())`へ変更する。
- `USING`と`WITH CHECK`の意味を変えない。
- suspended、pending、viewerの拒否をpgTAPで確認する。

状態: 未着手。Batch 1のクリーンDB検証後に行う。

### Batch 4: 監査actor

- service roleを使う全Edge FunctionとRPCを列挙する。
- invite、AI候補者サマリー、AI求人取り込みのactor帰属を確認する。
- Authメール同期のtriggerと既存不整合行backfillも、actorがnullになるsystem operationとして分類する。
- JWTで確認したrequester IDを、改ざんできないサーバー側引数としてRPCへ渡す。
- actor引数を受け取るRPCは`service_role`へのGRANTに限定し、`authenticated`へGRANTしない。authenticatedから呼べるRPCへactor引数を追加すると、クライアントが他者IDを詐称できるため。
- `auth.uid()`がnullのsystem operationと、人間操作を区別できる監査仕様にする。

状態: 未着手。設計レビュー後に実装する。

### Batch 5: セッション保存

- 現行localStorageのキーとセッション復元挙動をテスト環境で確認する。
- Supabase Authのcustom storage adapterを定義する。
- Rust側keyring利用時のmacOS Keychain・Windows Credential Manager動作を試作する。
- 移行時に既存セッションを安全に消去または移送する。
- パスワード自体は保存しない。

状態: 未着手。Tauri/Rust変更を伴う独立Phaseとする。

### Batch 6: 外部提供基盤

- 外部提供前にSupabase Pro、MFA、leaked password protection、カスタムSMTPを判定する。
- Apple Developer ID署名・NotarizationとWindowsクラウド署名を実装する。
- AI入力本文は保存せず、redaction後入力のSHA-256ハッシュ、redactionバージョン、入力スキーマバージョンを記録する。
- 利用規約、プライバシーポリシー、委託先一覧、インシデント対応Runbookを準備する。

状態: 未着手。

### Batch 3後の独立小タスク: テスト安定化と警告除去

- 全体検索テストはfake timersでdebounceを進め、必要な`findBy`だけタイムアウトを5〜7秒へ延長する。
- 遷移先routeを事前importし、lazy route解決を待つ競合を除く。
- login系を含む他のlazy route群へ`hydrateFallbackElement`を追加し、警告を消す。
- 業務ロジックの待機時間は変更せず、テストとrouter初期描画だけを安定化する。

状態: 未着手。Batch 3完了後に独立して行う。

## 4. 今回の検証結果

- `npm run format:check`: 成功
- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm test`: 65ファイル、342件成功
- `npm run build`: 成功（Batch 1変更後）
- `npm run verify:repo`: 成功（Batch 1変更後）
- `npm run supabase:check:local`: 安全に停止
  - `.env`未作成
  - ローカルDocker未起動
  - production・stagingへの接続や変更は行っていない

Batch 1の引き渡し前に、ローカルSupabaseを起動して次を実施する。

1. `npm run supabase:check:local`
2. `npm run supabase:reset`
3. `npm run supabase:test`
4. Security Advisor相当のローカル確認
5. 全フロントエンド品質チェックの再実行

## 5. 外部提供の暫定テナント方針

複数組織RLSが完成するまで、同一projectへ別顧客を追加しない。外部試験提供を行う場合は、顧客ごとに次を分離する。

- Supabase project
- Auth利用者
- DatabaseとStorage
- Edge Function secrets
- URLとpublishable key
- バックアップ
- migration適用記録
- 監査・障害対応記録

project-per-tenantを採用する場合も、手作業だけでprojectを増やさず、migration・設定・Edge Functionの差分検知とfan-out手順を先に用意する。

## 6. production適用条件

今回追加するmigrationをproductionへ適用してはならない。次をすべて満たした後、既存Runbookに従って別作業として判断する。

- ローカルクリーンDBで全migration成功
- pgTAP成功
- staging適用前バックアップ
- staging実アカウントでadmin、agent、viewer、pending、suspendedを確認
- Authメール変更後のプロフィール表示同期を確認
- restore drill成功
- migration dry-runで想定外差分なし
- Go/No-Go記録と実行者の明示
