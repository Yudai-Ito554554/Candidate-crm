# Fable 5再レビュー結果: Batch 1(suspendedロール・Authメール同期)

- レビュー日: 2026-08-12
- 対象: `fable5-review-fixes` @ `0e02ad43a332b82f40b1576b5604db5169f3c5bd`(実コードをclone・checkoutし、`main..HEAD` 全差分13ファイルを確認)
- 役割: Fable 5はレビューと受け入れ条件の提示のみ。実装はCodexが行う。
- 禁止事項の遵守: production・stagingへの接続・変更なし。読んだのはGitHub上のコードのみ。

---

## 総合判定

**Batch 2へのGo、および `main` へのマージ: 承認(必須修正なし)。**

前回口頭で示した照合ポイント — check制約の5値化、advisory lock維持、最終admin保護のsuspended経路、RLSポリシー無変更、自己profile読取りのみでの停止画面成立、トリガーのWHEN句・SECURITY DEFINER・RAISEなし構成・backfill・Data API REVOKE — はすべて実コードで満たされていることを確認した。pgTAP実行時テスト(10件)は自己検証的に構成されており(suspended/pendingのprofiles件数=1の断定が `auth.uid()` エミュレーションの正動作自体を証明する)、単なる形式チェックになっていない。

MacローカルSupabase未検証の点は、CI隔離環境(クリーンDBへの全migration再適用+pgTAP、同一スクリプト)が証跡として同等と評価する。マージの前提条件としてMacローカル実行を追加で要求しない。ただしproduction適用条件(action-plan 6節: staging実アカウントでのsuspended確認、restore drill等)は従来どおり維持する。

---

## 1. 設計上の問題とリスク

重大なものはない。以下は設計の確認結果。

- suspendedを許可リスト方式RLSから自然に除外する設計は正しい。migrationに `create policy` / `drop policy` が一切含まれないことをdiffで確認し、構造テスト(`profile-role-permissions.test.ts`)がこの不在を将来にわたり固定している点も良い。
- `set_profile_role` の最終admin保護は `new_role <> 'admin'` 条件がsuspended・pending・agent・viewerへのすべての降格を包含する構造で、suspended専用の分岐を増やしていない。advisory lockも維持。pgTAPでSQLSTATE 23514を実証済み。
- 停止画面はAppLayoutで早期returnし、ナビゲーション・業務データを一切描画しない。`role === null` はpending側の分岐に吸収されており、suspendedがpendingへフォールバックする経路はない。役割ラベルは `Record<ProfileRole, string>` で網羅性がコンパイル時に固定される。
- ロール変更はUI→`useSetProfileRoleMutation`→`set_profile_role` RPCの単一経路のまま。profilesを直接UPDATEするコードは追加されていない。

## 2. セキュリティ上の問題とリスク

必須修正に相当するものはない。確認済みの境界:

- suspendedの遮断は多層で成立している: テーブルRLS(pgTAPで実証)、Storageポリシー(4E migrationの許可リスト方式により遮断されるが、テスト未追加 — 後述R2)、Edge Function(`generate-candidate-summary` と `get-ai-usage` はいずれも `admin` / `agent` のみ許可、`invite-user` はadmin限定。いずれも本Batchで無変更であることを確認)。
- メール同期トリガーは、WHEN句による発火限定、no-op UPDATE構成(profile行不在時に何もしない)、明示的RAISEなしにより、Auth側のメール変更操作を失敗させるリスクを排除している。`authenticated` からのEXECUTE権限REVOKEはトリガー発火を妨げない(EXECUTE検査はCREATE TRIGGER時にownerに対して行われるため。既存 `handle_new_user` で同型が実証済み)。
- pgTAPの発火限定テスト(`last_sign_in_at` 更新で監査行が増えないこと)は、WHEN句の実効性をSQL構造でなく挙動で証明しており、テスト設計として適切。

残余リスク(受け入れ可能、記録のみ):

- suspendedユーザーはAuth上は有効なセッションとrefresh tokenを保持し続ける。業務データはRLSで即時遮断されるため実害はないが、退職者運用ではAuth側のban・セッション失効の併用が望ましい(R4)。
- メール同期によるactor_id nullの監査行はBatch 4送り。migration内コメントで意図が明示されているため、将来の読み手が事故と誤認するリスクは低い。

## 3. 分類

### 必須修正(マージ前)

なし。

### 推奨修正(Batch 2着手を妨げない。以降の任意Batchに同梱可)

- **R1: pgTAPのJWTエミュレーションの版数耐性。** 現在は `request.jwt.claim.sub`(単数形GUC)のみを設定している。Supabase/PostgRESTの版数により `auth.uid()` の参照先が `request.jwt.claims`(JSON)側になるため、将来のCLI更新でテストが静かに壊れ得る。両方を設定する共通ヘルパーにしておく。現時点でテストが正しく機能していることは件数断定から確認済み。
- **R2: Storageポリシーのsuspended遮断pgTAP。** `crm-files` の読取り・書込みポリシーは許可リスト方式なのでsuspendedは遮断されるが、テーブルRLSと同水準の実行時証跡がない。`storage.objects` への直接INSERT/SELECT試行のテストを追加する。
- **R3: SECURITY DEFINER関数の内部role再検証テスト。** `record_candidate_view` はsuspendedに対しerrcode 42501を返すはず(関数内で許可リスト検証)。suspendedユーザーとしての呼出しテストを1件追加し、RLS以外の防衛線も証跡化する。
- **R4: 停止運用の1行追加。** 退職者・契約終了者の停止手順として、`set_profile_role` での suspended化に加えAuth側のセッション失効(Supabase Auth adminのban相当)を行う旨を運用文書へ追記する。実装(管理UI・Edge Function化)はBatch 4以降で可。
- **R5: pending降格の扱いを確定する。** `set_profile_role` とUIのロール選択肢は、suspended導入後も任意ユーザーの `pending` への変更を許容している。pendingを初回承認待ち専用と定義したなら、UI選択肢からpendingを外す(DB側は寛容のままで害なし)か、再承認フローとして意図的に残すことを文書に明記するか、どちらかに決める。現状は定義と実装の間に小さな不整合がある。

### 将来対応(計画済み・変更不要)

- 監査actor null(Batch 4)、flaky/HydrateFallback(M4)、AI入力ハッシュ(Batch 6内)。いずれもaction-planへの配置を確認した。

## 4. Codexが実装するための受け入れ条件(R1〜R3)

1. R1: pgTAPテスト内でJWT subを設定する箇所を関数化し、`request.jwt.claim.sub` と `request.jwt.claims`(`{"sub": "...", "role": "authenticated"}` 相当のJSON)の両方を `set_config(..., true)` で設定する。既存10件+000の30件が引き続き全件成功すること。
2. R2: `001_batch1_account_lifecycle.test.sql` またはテストファイル追加で、suspendedユーザーとして `storage.objects`(bucket `crm-files`)のSELECTが0件、INSERTが拒否されることを検証する。planの件数を更新する。
3. R3: suspendedユーザーとして `select public.record_candidate_view('<候補者ID>')` がerrcode 42501で失敗することを `throws_ok` で検証する。
4. 共通: CIのSupabase migration/policy checksがgreenであること。既存テストの意味(USING/WITH CHECKの検証対象)を変えないこと。

## 5. Go / No-Go判断

- **Batch 2(自動バックアップ)へ: Go。** R1〜R5はいずれもBatch 1の安全性を損なう欠陥ではなく、証跡と運用定義の補強である。
- **`main` マージ: Go。** 品質チェック全件green、CI隔離環境でのクリーンDB検証をMacローカル検証の同等証跡と認める。
- **production適用: 従来条件のまま No-Go継続。** action-plan 6節(stagingでのsuspended実アカウント確認、Authメール変更のプロフィール追随確認、restore drill、dry-run)を満たすまで適用しない。この条件自体は適切であり変更を求めない。

## 6. Batch 2(内部利用向け自動バックアップ)設計指針と受け入れ条件

Codexが実装に入れるよう、設計上の要点と受け入れ条件を先渡しする。

設計指針:

- 実行基盤はオーナーMacのlaunchd(日次)。リポジトリにはスクリプトとplistテンプレートのみを置き、絶対パス・接続情報・鍵は置かない(`verify:repo` 通過が前提)。
- production接続情報は既存Runbookの隔離ディレクトリ+ポインタファイル方式に従い、メイン開発リポジトリをproductionへlinkしない原則を維持する。
- 取得対象は(1)DB論理ダンプ、(2)Storage `crm-files` の同期、(3)取得メタデータ(日時、サイズ、対象project ref、スクリプト版)の3点。
- 保持世代の初期値: 日次14世代+週次8世代(変更可、文書化必須)。保存先はFileVault有効なローカルディスクとし、外部媒体・クラウドへ複製する場合は暗号化を必須とする。
- 失敗時に人間へ届く通知(macOS通知+ログファイル。無音失敗の禁止)。
- `supabase projects api-keys` を実行しない既存ルールをスクリプト内コメントにも明記する。

受け入れ条件:

1. launchdからの日次実行でDBダンプとStorage同期が取得され、成功・失敗がログと通知で判別できる。
2. 復元drill手順書が存在し、分離環境への初回リストアを1回実施して記録する(既存Stage 1 drillの流儀に合わせる)。
3. 保持世代のローテーションが実装され、上限超過分が削除される。
4. trackedファイルに秘密・絶対パスが含まれず、全品質チェックがgreen。
5. HANDOFFとaction-planのBatch 2状態が実態と同期している。

## 7. 参考: 今回確認した主な証跡

- `supabase/migrations/20260811124525_add_suspended_profile_role.sql`(check制約5値、advisory lock、ポリシー変更なし)
- `supabase/migrations/20260811124746_sync_profile_email_from_auth.sql`(WHEN句、no-op UPDATE、REVOKE、backfill)
- `supabase/tests/001_batch1_account_lifecycle.test.sql`(10件。最終admin保護23514、suspended/pending遮断、WHEN句の挙動証明、メール追随)
- `supabase/tests/000_schema_security.test.sql`(27→30件。トリガー列限定+WHEN述語の構造検証、helper非API可用性)
- `src/components/layout/app-layout.tsx` / `.test.tsx`(停止画面の早期return、業務UI非描画のテスト)
- `src/features/settings/profile-model.ts` / `src/types/database.ts`(union追加とRecord網羅性)
- `supabase/functions/get-ai-usage` / `generate-candidate-summary` / `invite-user`(role許可リストが本Batchで無変更であること)
