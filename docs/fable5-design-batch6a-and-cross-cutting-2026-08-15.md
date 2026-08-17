# Fable 5回答: Batch 6横断判断 + Batch 6A(AI入力provenance)設計書

- 作成日: 2026-08-15
- 作成: Fable 5(設計)/ 実装: Codex
- 基準commit: `859798c`
- production操作: なし

---

## 0. 本回答の範囲と、5サブバッチを一括で書かない理由

本文書は(1)横断的設計質問7件への回答、(2)サブバッチの順序確定、(3)**Batch 6Aの完全な実装可能設計書**を含む。6B〜6Eの設計書は本文書に含めない。

理由: 6C(SMTP事業者)、6D(署名手段)、6B(Pro移行とMFA強制範囲)は、まだ確定していない外部契約の選択によって設計の骨格が変わる。契約前に詳細設計を書けば、書き直すか、既成事実として不適切な選択を固定するかのどちらかになる。依頼書自身が採用しているサブバッチ単位のサイクル(設計→実装→レビュー)と整合させ、**実装可能になったサブバッチの設計だけを、その直前に出す**方式を提案する。6B〜6Eの設計は、9節の起動条件が満たされた時点で個別に依頼してほしい。

---

## 1. 横断的設計質問への回答

### Q1. Stage 3を2段階へ分けるべきか — 分けるべき(強く推奨)

現在のStage 3は「社内Windows展開」と「外部有償提供」という、ブロッカーも判定者も異なる2つを1表で管理しており、S3-10(Windows実機)が終わらない限り全体が進まないように見える構造になっている。次へ分割する。

- **Stage 3A(社内Windows展開)**: S3-1、S3-3、S3-6、S3-7、S3-10、Batch 5のWindows残UAT。必要な外部資源はWindows実機のみ。署名なしQA版の運用ルール(B-5)で足りる。
- **Stage 3B(外部有償提供)**: S3-5、S3-11〜S3-13、Supabase Pro、MFA、custom SMTP、AI provenance、法務文書、テナント分離手順。

分割の実利は判定の独立性にある。3Aは3Bの外部契約を待たずにGo判定でき、3Bは3Aの実機作業と無関係に設計・実装を進められる。

### Q2. S3-3の合格証跡 — 前回の回答を維持(web buildをブラウザで実行)

Batch 1レビュー時の回答から変更なし。このアプリはTauriでもブラウザでも同一のReact SPAなので、**web buildをstagingへ向けてブラウザで起動し、viewerアカウントでURLバーから編集6ルートを直打ちする**のが「URLを直接入力する」の忠実な再現であり、production配布物へdeep-link攻撃面を一切増やさない。

正式な合格証跡の構成:

1. 一次証跡: RLSのpgTAPとroute guard自動テスト(権限の正本はRLS)。
2. UAT証跡: 上記web build方式による実アカウント確認。
3. 記録: 実施日、使用ビルド(staging web)、アカウント、6ルートそれぞれの結果。

テスト専用deep-linkの実装は引き続き不許可。

### Q3. Supabase Proを外部有償提供の必須条件とするか — 必須

leaked password protection、自動バックアップ、project pause回避、SMTP関連の制約緩和がいずれも有償提供の前提になる。Free+独自バックアップの許容範囲は次のとおり。

- 許容: 社内試験運用(現在)、および無償の外部テスター1社によるパイロット。ただしパイロットでも顧客データを預かる以上、独自バックアップの稼働(既に達成)とrestore drill記録は必須。
- 非許容: 課金開始以降。課金開始日をもってPro移行を完了していること。

### Q4. PITRの導入条件 — RPOで定める。売上・顧客数では定めない

判断基準は「24時間分のデータ喪失を業務が許容できるか」の一点。現行の日次論理バックアップのRPOは最大24時間である。

導入条件(いずれか成立でPITR):

1. 1日あたりの候補者・活動記録の入力量が、再入力で回復不能な水準に達したとき(目安: 1日あたりの新規・更新レコードが手作業で復元できない量)。
2. 顧客との契約でRPOを24時間未満と約束したとき。
3. 顧客データの消失が契約違反・信用毀損に直結する有償顧客が1社でも存在するとき。

3は実質「有償提供開始=PITR検討」を意味するが、必須化ではなく判断の起点とする。RTOについては、現行restore drillの実測所要時間を記録し、それが顧客への説明に耐えるかで別途判断する。

### Q5. 外部テスター1社を迎える前に必須のもの

| サブバッチ       | パイロット(無償テスター1社) | 有償GA                       |
| ---------------- | --------------------------- | ---------------------------- |
| 6A AI provenance | 推奨(必須でない)            | 必須                         |
| 6B TOTP MFA      | 推奨(adminのみ先行)         | 必須(admin)、agent以下は推奨 |
| 6C custom SMTP   | **必須**                    | 必須                         |
| 6D 署名pipeline  | **必須**                    | 必須                         |
| 6E 運用・法務    | 最低限のdraft必須           | 専門家確認済み版が必須       |

6Cと6Dがパイロットでも必須な理由: 招待メールが本人以外へ届かなければテスターはログインできず、未署名ビルドはGatekeeper/SmartScreenでそもそも起動しない。技術的にパイロット自体が成立しない。

### Q6. project-per-tenantからmulti-tenantへ移る判断基準

次のいずれかが成立した時点で移行設計に着手する(移行完了ではなく着手)。

1. テナント数が5を超えたとき。
2. migration fan-outで適用漏れ・設定差分が1度でも発生したとき(件数に関わらず。運用が破綻している証拠)。
3. 顧客が組織横断機能(複数拠点の統合ビュー等)を要求したとき。
4. テナント追加の所要時間が、営業サイクルに対して遅すぎると判断されたとき。

逆に、3テナント以下で1〜4が起きていない間は、project分離のほうが安全でありmulti-tenant化を急がない。

### Q7. メールアドレス自動入力の要望 — Batch 5で実用上解消済みとして扱う

元の要望は「毎回メールアドレスとパスワードを入力したくない」であり、Batch 5のセッション復元により通常運用では入力機会自体が消えた。追加実装は不要。

将来、セッション失効時の再入力を軽減したい要望が改めて出た場合のみ、**非機密設定としてのメールアドレス記憶**(Tauriの通常設定保存、OS資格情報ストアを使わない)を実装する。OS標準autofillはTauri WebViewでの挙動が環境依存なので採らない。パスワード保存は引き続き恒久的に不許可。

---

## 2. Batch 6A設計書: AI入力provenance

### 2.1 目的と非目的

目的: AIへ送信した本文を保存せずに、(a)同一入力であったこと、(b)どのredaction規則・入力schemaで生成されたかを、後から機械的に識別できるようにする。

非目的: 入力本文の復元、AI出力の再現、プロンプトの保存。これらは実装しない。

### 2.2 採用案と却下案

| 論点         | 採用                                                                    | 却下                                     | 理由                                                                                                   |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ハッシュ対象 | 送信直前のcanonical serialization済み文字列(実際に送るバイト列そのもの) | 送信前のJSオブジェクトを別途整形したもの | 「送ったもの」と「ハッシュしたもの」の乖離を構造的に排除するため。同一文字列を送信にもハッシュにも使う |
| アルゴリズム | HMAC-SHA-256(server-only key)                                           | raw SHA-256                              | 下記2.3                                                                                                |
| schema共有   | 列構成は両テーブル共通、versionは domain付きnamespace                   | 完全に別schema / 完全に同一namespace     | テストと検証コードを共通化しつつ、version値の衝突を防ぐ                                                |
| backfill     | 行わない(既存行はNULL)                                                  | 推測値・既定値での充填                   | 原文がない行のfingerprintは検証不能であり、値があること自体が誤った保証になる                          |

### 2.3 判断: HMAC-SHA-256を採用する

依頼書の論点2への回答。**raw SHA-256では不十分。HMAC-SHA-256を採用する。**

脅威モデル: DBダンプ(バックアップ含む)が漏洩した攻撃者を想定する。raw SHA-256の場合、攻撃者は「特定の求人票原文/特定の候補者プロフィール」を自分で正規化・ハッシュし、fingerprintと突合することで**その原文がAIへ送られたことを確認できる**。求人票は公開URL由来のものが多く、候補者データも他経路で入手した情報との照合が成立し得る。つまりfingerprint自体が確認オラクルになる。

HMACならkeyがEdge Function secretsにのみ存在するため、DBのみの漏洩では突合できない。provenanceの用途(同一性の識別)はkeyを持つサーバー側でのみ行えればよく、HMACで機能上の損失はない。

key管理(論点3への回答):

- key本体は `AI_FINGERPRINT_HMAC_KEY_V<n>` としてEdge Function secretsにのみ置く。DB・クライアント・リポジトリへ置かない。
- `hash_key_version` 列に版番号を記録する。
- rotationは**加算のみ**。新規行は最新keyで記録し、**旧keyは破棄しない**(破棄すると過去記録が検証不能になる)。旧keyの保管はsecretsに残す運用とし、runbookへ「AI provenance keyは削除しない」を明記する。
- key漏洩時: 新版keyを追加して以後の記録を切り替える。過去行の再計算は原文がないため不可能であり、漏洩以前の行は「確認オラクル化のリスクを負った状態」として記録する。この不可逆性をrunbookへ書く。

### 2.4 canonical serialization規則(論点4への回答)

共有モジュール(Edge Function間で1実装)として定義し、規則自体を `input_schema_version` で版管理する。

1. エンコーディング: UTF-8。
2. Unicode正規化: NFC。
3. 改行: CRLF・CR をすべて LF へ正規化。
4. オブジェクトキー: コードポイント昇順でソート。
5. 配列: 順序を保持(意味を持つため並べ替えない)。
6. `null` および `undefined` の値を持つキーは**出力しない**(存在しないことと明示的nullを区別しない)。
7. 空白: JSONの区切り以外の空白を含めない(`JSON.stringify` のindentなし)。
8. 数値: JSONの最短表現。NaN・Infinityは入力に許可しない(検出時はエラー)。
9. 文字列内容の trim・大小変換は**行わない**(入力の同一性を保つため)。

重要な実装制約: 上記で生成した文字列を、**そのままprovider APIのbodyへ使う**。ハッシュ用と送信用に別々のシリアライズを行わない。

### 2.5 データモデル

`ai_generation_requests` と `job_import_requests` の双方へ同一の5列を追加する。

```sql
alter table public.ai_generation_requests
  add column input_fingerprint text,
  add column hash_algorithm text,
  add column hash_key_version integer,
  add column redaction_version text,
  add column input_schema_version text;
```

制約:

- `input_fingerprint`: 64桁の小文字hex。`check (input_fingerprint ~ '^[0-9a-f]{64}$')`。
- `hash_algorithm`: `check (hash_algorithm in ('hmac-sha256'))`。将来の追加は新migrationで。
- `hash_key_version`: `check (hash_key_version >= 1)`。
- `redaction_version` / `input_schema_version`: domain付き文字列。例 `candidate-summary/1`、`job-import/1`。`check (... ~ '^[a-z0-9-]+/[0-9]+$')`。
- **all-or-nothing制約**: 5列は全てNULLか全て非NULLのいずれかであること。

```sql
alter table public.ai_generation_requests
  add constraint ai_generation_requests_provenance_complete check (
    (input_fingerprint is null and hash_algorithm is null and hash_key_version is null
      and redaction_version is null and input_schema_version is null)
    or (input_fingerprint is not null and hash_algorithm is not null and hash_key_version is not null
      and redaction_version is not null and input_schema_version is not null)
  );
```

NULL可否の意味論(論点5への回答): 全列NULL = 「providerへの送信が発生していない行」(既存行、cache hit、送信前失敗)。全列非NULL = 「この指紋の入力をproviderへ送信した行」。この二値で読めるようにするため、all-or-nothing制約が必須。

version namespace(論点6への回答): 列は共通、値のnamespaceを分ける。候補者サマリーのredaction規則が変わっても求人取り込みのversionは動かない。

### 2.6 記録タイミング(論点7への回答)

1. 既存フロー(claim → 入力構築 → redaction → provider送信 → 結果保存)を変えない。
2. redaction完了後、canonical serializationを1回だけ実行し、その文字列に対してHMACを計算する。
3. **provider送信の直前に、provenance 5列を当該requestレコードへUPDATEする**。送信より前に記録することで、送信後にプロセスが落ちても「何を送ったか」が残る。
4. provider呼び出しが失敗しても列は残す(送信した事実は変わらない)。既存の失敗ステータス記録と併存させる。
5. **cache hitではproviderへ送信しないため、5列はNULLのまま**。既存のcacheフラグで区別できるため、新たなフラグは追加しない。
6. retryは新しいrequest行として扱われ、同一入力なら同一fingerprintになる。これは意図した挙動(同一性の識別が目的)。

### 2.7 権限・RLS(論点9への回答)

- 両テーブルは既にserver-only(authenticated/anonにGRANTなし、RLSで遮断)。列追加は権限に影響しないが、**列追加後も authenticated/anon がSELECT/INSERT/UPDATEできないことをpgTAPで再固定する**。列単位GRANTの加算性で過去に事故があった経緯を踏まえ、テーブル単位の権限が変化していないことを明示的に検証する。
- Edge Functionからの書込みはservice_role経由。既存のclaim RPCと同じ境界。
- 監査ログへfingerprintを複製しない(metadata-only原則の維持、および複製先が増えると漏洩面が増えるため)。

### 2.8 保持期間(論点8への回答)

新たな保持ルールを設けない。両requestテーブルの既存の保持方針に従う。理由: fingerprintは非可逆であり、HMAC keyがDB外にある限り、保持してもPIIの露出面を増やさない。AI出力(`ai_summaries`、`jobs`)との関連付けは既存の外部キー・request idで足りる。

### 2.9 fail-closed条件

- HMAC keyがsecretsに存在しない、または空 → **provider送信を行わずエラー終了**。provenanceなしのAI呼び出しを許さない(記録を任意にすると、記録漏れが常態化する)。
- canonical serializationが失敗(NaN/Infinity/循環参照) → 送信せずエラー終了。
- provenance列のUPDATEが失敗 → 送信せずエラー終了。
- いずれの場合もエラーメッセージに入力本文・fingerprint・keyを含めない。

### 2.10 テスト受け入れ条件

pgTAP(新規 `006_ai_provenance.test.sql`):

- 5列が両テーブルに存在し、型・check制約が期待どおり。
- all-or-nothing制約: 部分的にNULLの行のINSERTが拒否される(両テーブル各1件)。
- fingerprint形式違反(非hex、63桁、大文字)が拒否される。
- `hash_algorithm` の想定外値が拒否される。
- authenticated・anonが両テーブルへSELECT/INSERT/UPDATEできない(既存の再固定)。

Vitest/Deno:

- canonical serializationの規則テスト: キー順序が異なる同値オブジェクトが同一文字列になる、配列順序の違いが別文字列になる、NFC正規化、CRLF→LF、null/undefinedキーの除去、NaNでのエラー。
- HMACの既知ベクタ(固定key・固定入力→固定出力)で実装が正しいこと。
- 同一入力→同一fingerprint、1文字違い→別fingerprint。
- key未設定時に送信が行われないこと(providerモックが呼ばれないことの断定)。
- cache hit時に5列がNULLのままであること。
- 送信直前にUPDATEが行われる順序(モック呼び出し順の断定)。
- エラー出力に本文・key・fingerprintが含まれないこと。

### 2.11 rollout / rollback / 移行

- rollout: migration適用 → Edge Function deploy の順。migration先行でも旧Edge Functionは列を書かないだけで動作するため非破壊。
- rollback: Edge Functionを旧版へ戻せば列がNULLのまま記録される。列削除のrollback migrationは不要かつ非推奨(記録済みprovenanceを失うため)。
- 既存行: NULLのまま。backfillしない。「2026-08-15以前の行はprovenanceを持たない」ことをHANDOFFとrunbookへ記録する。

### 2.12 Go/No-Go(production適用前)

1. ローカルクリーンDBで全migration成功、pgTAP全件成功。
2. HMAC key(v1)がstaging・production双方のEdge Function secretsへ設定済み(値は記録しない)。
3. stagingで実際にAI候補者サマリーとAI求人取り込みを1回ずつ実行し、5列が期待形式で記録されること、同一入力の再実行で同一fingerprintになることを確認。
4. key未設定状態でのfail-closed動作をstagingで1回実証(一時的にkeyを外して実行し、送信されないことを確認。確認後に戻す)。
5. runbookへ「AI provenance keyは削除しない」「key漏洩時の扱い」を追記済み。
6. 既存Runbookのproduction適用条件(バックアップ、dry-run、Go/No-Go記録)を満たす。

### 2.13 実装順とcommit分割

1. `feat: add canonical serialization and hmac fingerprint module`(共有モジュール+単体テスト)
2. `feat: add ai provenance columns`(migration + pgTAP)
3. `feat: record provenance before provider dispatch`(Edge Function 2本 + テスト)
4. `docs: record ai provenance key policy`(runbook・HANDOFF)

3を最後にすることで、列と計算ロジックが揃うまで送信経路を触らない。

---

## 3. サブバッチの順序と起動条件

| 順  | サブバッチ           | 起動条件                                                                                    | 設計依頼のタイミング                                       |
| --- | -------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | **6A AI provenance** | なし(即着手可)                                                                              | 本文書で完了                                               |
| 2   | 6B TOTP MFA          | Pro移行判断。Free中でもTOTP実装自体は可能だが、leaked password protectionと併せて設計したい | Pro移行を決めた時点、またはパイロット顧客が見えた時点      |
| 3   | 6C custom SMTP       | SMTP事業者と送信domainの確定                                                                | 事業者候補を2〜3社に絞った時点(選定基準の設計を含めて依頼) |
| 4   | 6D 署名pipeline      | Apple Developer Program加入、Windows署名手段の確定                                          | 両方またはどちらか一方が確定した時点(macOS先行可)          |
| 5   | 6E 運用・法務        | なし(draftは並行可)                                                                         | 6C・6Dと並行、または外部提供が具体化した時点               |

6Aだけが外部依存ゼロで、かつ完成しても外部提供以外に副作用がない。ここから始めるのが正しい。

Codexへの指示は、本文書の2節を設計正本として6Aの実装に入り、ブランチpush → CIグリーン → HEADのSHAとRun IDを報告、で足りる。
