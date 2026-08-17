# Codex実装指示書: Batch 6A(AI入力provenance)

- 作成日: 2026-08-15
- 設計正本: `docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md` の2節
- 実装環境: Windows(Docker Desktop + WSL2でローカルSupabase)
- 基準: `main`(残Low hardening統合済み)

## 0. 前提確認(実装前に必ず実行)

```powershell
git config --global core.autocrlf   # false または未設定であること。true なら false へ変更
git status
git log --oneline -5
npm ci
npm run typecheck
npm run test
npm run supabase:check:local
```

`core.autocrlf` が `true` だと `.gitattributes`(`* text=auto eol=lf`)と衝突し、`format:check` がリポジトリ全体で失敗する。ここで直しておくこと。

Supabase CLIは `2.111.0` に固定(`2.112.0` は `projects list` のパース不具合あり)。

## 1. 絶対的な禁止事項

- production・staging Supabaseへ接続しない。`supabase link`、`supabase db push`、`supabase projects api-keys` を実行しない。
- Edge Functionをdeployしない(実装とローカルテストのみ)。
- `main` へ直接push・force pushしない。既存migrationを書き換えない。
- HMAC keyの値、`.env`、secretsをコミット・ログ・チャットへ出さない。
- AI入力本文・求人原文・候補者原文を新たにログ・DB・テストfixtureへ保存しない(テストは架空データを使う)。
- 設計書からの逸脱が必要になった場合は、実装せず理由を添えてFable 5へ差し戻す。

## 2. Task 1: canonical serialization + HMACモジュール

Edge Function 2本から共有できる単一実装として作る(既存の共有配置規約に従う。なければ `supabase/functions/_shared/` 相当へ)。

規則(設計書2.4節が正本):

1. UTF-8
2. Unicode NFC正規化
3. CRLF・CR → LF
4. オブジェクトキーはコードポイント昇順ソート
5. 配列は順序保持(並べ替えない)
6. `null` / `undefined` の値を持つキーは出力しない
7. JSON区切り以外の空白なし(indentなし)
8. 数値はJSON最短表現。NaN・Infinityは入力に不許可(検出時エラー)
9. 文字列内容のtrim・大小変換は行わない

**重要**: この関数が返した文字列を、そのままprovider APIのbodyに使う。ハッシュ用と送信用に別々のシリアライズを行わない。

HMAC: SHA-256、keyはEdge Function secrets `AI_FINGERPRINT_HMAC_KEY_V1` から読む。出力は64桁小文字hex。

テスト(Deno/Vitest、この時点で全て緑にする):

- キー順序違いの同値オブジェクトが同一文字列になる
- 配列順序違いは別文字列になる
- NFC正規化、CRLF→LF、null/undefinedキー除去
- NaN・Infinity・循環参照でエラー
- HMAC既知ベクタ(固定key・固定入力→固定出力)
- 同一入力→同一fingerprint、1文字違い→別fingerprint

commit: `feat: add canonical serialization and hmac fingerprint module`

## 3. Task 2: migration

`ai_generation_requests` と `job_import_requests` の双方へ同一5列を追加する新規migration 1本。

列: `input_fingerprint text`、`hash_algorithm text`、`hash_key_version integer`、`redaction_version text`、`input_schema_version text`(いずれもnullable)

制約(両テーブル):

- `input_fingerprint ~ '^[0-9a-f]{64}$'`
- `hash_algorithm in ('hmac-sha256')`
- `hash_key_version >= 1`
- `redaction_version ~ '^[a-z0-9-]+/[0-9]+$'`、`input_schema_version` も同形式
- **all-or-nothing制約**: 5列が全てNULLか全て非NULLのいずれか(設計書2.5節のSQLを使う)

backfillは行わない。既存行はNULLのまま。migrationコメントへ「原文が存在しない既存行のfingerprintは算出不能であり、推測値で埋めない」と明記する。

pgTAP(新規 `006_ai_provenance.test.sql`):

- 両テーブルに5列が存在し型が期待どおり
- 部分的にNULLの行のINSERTが拒否される(両テーブル各1件)
- fingerprint形式違反(非hex・63桁・大文字)が拒否される
- `hash_algorithm` の想定外値が拒否される
- authenticated・anonが両テーブルへSELECT/INSERT/UPDATEできない(既存境界の再固定)

`npm run supabase:reset` と `npm run supabase:test` で検証。

commit: `feat: add ai provenance columns`

## 4. Task 3: Edge Function連携

対象: `generate-candidate-summary`、`extract-job-posting`。

順序(設計書2.6節):

1. 既存のclaim → 入力構築 → redactionは変更しない
2. redaction完了後、canonical serializationを1回実行
3. その文字列にHMACを計算
4. **provider送信の直前に** provenance 5列を当該request行へUPDATE
5. provider呼び出しが失敗しても列は残す
6. **cache hitでは5列をNULLのままにする**(送信していないため)。新たなフラグは追加しない

version値の初期設定: `redaction_version` と `input_schema_version` はdomain付きnamespace。候補者サマリーは `candidate-summary/1`、求人取り込みは `job-import/1`。

fail-closed(設計書2.9節):

- HMAC keyが未設定・空 → **provider送信せずエラー終了**
- canonical serialization失敗 → 送信せずエラー終了
- provenance列のUPDATE失敗 → 送信せずエラー終了
- エラーメッセージに入力本文・fingerprint・keyを含めない

テスト:

- key未設定時にproviderモックが呼ばれないこと(呼び出し回数0の断定)
- cache hit時に5列がNULLのまま
- 送信直前にUPDATEが行われる順序(モック呼び出し順の断定)
- エラー出力に本文・key・fingerprintが含まれないこと
- TypeScript型へ5列を追加(`src/types/database.ts` 等)

commit: `feat: record provenance before provider dispatch`

## 5. Task 4: 文書

- `docs/backup-runbook.md` または新規のkey運用節へ: 「AI provenance HMAC keyは削除しない(削除すると過去記録が検証不能になる)」「rotationは加算のみ、旧keyをsecretsから消さない」「key漏洩時は新版を追加し、漏洩以前の行は確認オラクル化のリスクを負った状態として記録する」
- `HANDOFF.md`: Batch 6A実装状況、2026-08-15以前の行はprovenanceを持たないこと
- `.env.example` またはsecrets一覧の文書へ `AI_FINGERPRINT_HMAC_KEY_V1` の**名前だけ**追加(値は書かない)

commit: `docs: record ai provenance key policy`

## 6. 品質チェックとpush

```powershell
npm run format
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
npm run verify:repo
npm run supabase:reset
npm run supabase:test
git diff --check
```

ブランチ `fable5-ai-provenance-batch6a` へpush → CIグリーン確認 → HEADのSHAとRun IDを報告。`main` マージはFable 5レビュー後。

## 7. 完了報告

1. 4 commitのSHAと内容
2. pgTAP件数(既存+006)、Vitest件数
3. fail-closed 3経路のテスト結果
4. CI Run IDと3ジョブの結果
5. **未実施として残るもの**: stagingでの実動作確認、HMAC keyのsecrets設定、Edge Function deploy、production適用(いずれもオーナー作業。設計書2.12節のGo/No-Go条件が正本)
