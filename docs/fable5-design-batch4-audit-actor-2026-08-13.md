# Batch 4設計書: 監査ログのactor帰属

- 作成日: 2026-08-13
- 作成: Fable 5(設計)/ 実装: Codex
- 前提: Batch 3がmainへマージ済みでCIがgreenであること。未達ならこの設計書の実装を開始しない。
- 解決する指摘: Batch 1レビューH4(service role経路でauth.uid()がnullになり監査行のactorが失われる)

## 1. 設計目標

1. すべての監査行で「誰が・どの経路で」を判別可能にする。
2. 人間操作(デスクトップからのRLS経由)・サービス経路(Edge Functionがrequesterを検証済み)・システム動作(トリガー・backfill・保守)の3種を区別する。
3. 既存の監査原則を変えない: metadata-only、変更前後値の非複製、admin限定参照、デスクトップからの改変不可。
4. actorをクライアントが詐称できない構造にする(確立済み規約: actor情報を受け取る関数は `service_role` GRANT限定、`authenticated` へGRANTしない)。

## 2. スキーマ設計

`audit_logs` へ列を1つ追加する。

```sql
alter table public.audit_logs
  add column actor_kind text not null default 'user'
  check (actor_kind in ('user', 'service', 'system'));
```

意味論:

- `user`: `actor_id` = `auth.uid()`。デスクトップからのRLS経由操作。
- `service`: `actor_id` = Edge FunctionがJWTから検証したrequester ID。経路はservice roleだが、起点の人間が特定できる操作(例: invite-userのrole設定、AIサマリー保存)。
- `system`: `actor_id` = null。人間の起点がない、または起点を主張すべきでない操作(メール同期トリガー、backfill、migration内のデータ修正、将来のバックアップ復元)。

既存行の扱い(同一migration内のbackfill):

- `actor_id is not null` の既存行 → `user`(defaultのままで正しい)。
- `actor_id is null` の既存行 → `system` へ更新。過去のinvite経由role_changeとAIサマリー行が該当するが、真のrequesterを遡って復元することはできないため、偽らずsystemとして記録する。この不可逆性はレビュー済みの既知事項としてmigrationコメントへ明記する。

## 3. actor伝搬の仕組み: transaction-local GUC

service経路のrequester伝搬にはtransaction-local設定を使う。

```sql
-- service_role限定のRPC冒頭で
perform set_config('app.audit_actor_id', requester_id::text, true);  -- 第3引数true = トランザクション限定
```

`record_crm_audit_log` の導出ロジック:

```sql
v_uid := (select auth.uid());
v_service_actor := nullif(current_setting('app.audit_actor_id', true), '');

if v_uid is not null then
  -- 通常のRLS経由。GUCが同時に設定されていても人間セッションを優先
  actor_id := v_uid; actor_kind := 'user';
elsif v_service_actor is not null then
  actor_id := v_service_actor::uuid; actor_kind := 'service';
else
  actor_id := null; actor_kind := 'system';
end if;
```

設計上の要点:

- 第3引数 `true`(transaction-local)を必須とする。session-localにすると、pooler経由の接続再利用で別トランザクションへactorが漏れる。
- `authenticated` から `set_config('app.audit_actor_id', ...)` を直接呼ばれた場合の詐称は、導出順序で無害化される: `auth.uid()` が非nullなら常に `user` + 実UIDが勝つため、クライアントがGUCを設定しても自分以外のactorを名乗れない。この性質をpgTAPで固定する(7節T5)。
- GUC名は `app.` プレフィックスで固定し、他の用途に流用しない。

## 4. 変更対象の棚卸しと個別設計

### 4.1 `invite-user` Edge Function(修正必須)

現状: service roleクライアントで `profiles` を直接UPDATEしてroleを設定 → actor null。

変更: 直接UPDATEを廃止し、新RPCへ置き換える。

```sql
create function public.apply_invited_profile_role(
  target_user_id uuid,
  new_role text,
  requester_id uuid
) returns void
language plpgsql security definer set search_path = ...
```

- GRANT: `service_role` のみ。`public`・`anon`・`authenticated` からREVOKE。
- 関数内で行うこと: (1)`set_config('app.audit_actor_id', requester_id::text, true)`、(2)`new_role in ('agent', 'viewer')` の検証(招待経路の許可値は既存仕様のまま)、(3)対象profileの存在確認、(4)role更新。
- `set_profile_role` を再利用しない理由: あちらは呼出し元自身のadmin検証を `auth.uid()` 基準で行う設計であり、service roleコンテキスト(auth.uid() = null)では成立しない。招待専用の狭い関数を別に置くほうが、既存関数へ分岐を足すより安全。
- Edge Function側: requester(招待を実行したadmin)のJWT検証は既存実装のまま。検証済みIDをRPCへ渡す。

### 4.2 `store_candidate_ai_summary` ほかAI系RPC(確認+最小修正)

既に `requester_id` を引数で受けている。冒頭に `set_config` を1行追加し、監査行が `service` + requesterで記録されることをテストで固定する。`claim_candidate_ai_request` 等、監査対象テーブルへ書かないRPCは変更不要。棚卸しはCodexが `service_role` GRANTを持つ全関数を `pg_proc` から列挙し、監査対象テーブルへの書込み有無で判定して設計書へ追記する。

#### 4.2.1 `service_role`実行権限関数の棚卸し（Codex追記）

2026-08-13にローカルSupabaseを全migration適用済みの状態で起動し、`pg_proc`、`pg_namespace`、`aclexplode`および`has_function_privilege`を用いて`public`/`private`スキーマを照合した。明示的な`service_role` GRANTを持つ関数に加え、PostgreSQLの既定PUBLIC EXECUTEにより`service_role`が実効権限を持つトリガー関数も漏れ防止のため列挙した。

| 関数                                                                                                                     | 権限の由来                 | requester_id | 監査対象テーブルへの書込み           | Batch 4対応                         |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------ | ------------------------------------ | ----------------------------------- |
| `public.claim_candidate_ai_request(uuid, uuid)`                                                                          | 明示GRANT                  | あり         | なし（`ai_generation_requests`のみ） | 変更不要                            |
| `public.claim_job_import_request(uuid, text)`                                                                            | 明示GRANT                  | あり         | なし（`job_import_requests`のみ）    | 変更不要                            |
| `public.get_ai_usage_snapshot()`                                                                                         | 明示GRANT                  | なし         | なし（参照のみ）                     | 変更不要                            |
| `public.immutable_text_array_to_string(text[], text)`                                                                    | 明示GRANT                  | なし         | なし（純粋関数）                     | 変更不要                            |
| `public.store_candidate_ai_summary(uuid, uuid, text, text, text, text, text, text, text, text, text, text, timestamptz)` | 明示GRANT                  | あり         | あり（`ai_summaries`）               | transaction-local GUCを設定         |
| `public.prevent_archiving_referenced_records()`                                                                          | PUBLIC既定（トリガー関数） | なし         | なし（検証のみ）                     | 変更不要                            |
| `public.prevent_referenced_application_identity_change()`                                                                | PUBLIC既定（トリガー関数） | なし         | なし（検証のみ）                     | 変更不要                            |
| `public.refresh_email_thread_from_message()`                                                                             | PUBLIC既定（トリガー関数） | なし         | あり（`email_threads`）              | システムトリガーとしてGUCなしを維持 |
| `public.set_updated_at()`                                                                                                | PUBLIC既定（トリガー関数） | なし         | なし（`NEW`のみ変更）                | 変更不要                            |
| `public.validate_application_relation()`                                                                                 | PUBLIC既定（トリガー関数） | なし         | なし（`NEW`のみ変更）                | 変更不要                            |
| `public.validate_job_contact_company()`                                                                                  | PUBLIC既定（トリガー関数） | なし         | なし（検証のみ）                     | 変更不要                            |

`private`スキーマには、`service_role`がEXECUTE権限を持つ関数は存在しなかった。したがって、設計規則「requester_idを受け取り、かつ監査対象テーブルを書き込む関数」に該当する既存関数は`store_candidate_ai_summary`だけであり、追加される`apply_invited_profile_role`と合わせて2経路のみを変更対象とする。

### 4.3 メール同期トリガー・backfill(変更不要)

`auth.uid()` null かつ GUC未設定 → 自動的に `system` になる。Batch 1で意図どおり動くため、コード変更は不要。テストで `system` 分類を固定するのみ(7節T3)。

### 4.4 UI(任意・最小)

監査ログ画面(admin)で `actor_kind` を表示する。`system` はダッシュ等でなく明示ラベル(例: システム)にする。列追加のみで、フィルタ実装は不要。

## 5. 実装しないこと(明示)

- 監査行への変更前後値・本文の追加(metadata-only原則の維持)。
- `set_profile_role` の変更(既存の人間経路は `user` + auth.uid()で既に正しい)。
- 監査ログのUPDATE/DELETE経路の追加(不変性維持)。
- `authenticated` へのactor引数付きRPCのGRANT(確立済み規約)。

## 6. migration構成と適用順序

1本のmigrationにまとめてよい(すべて監査actorという単一関心のため): 列追加+check → 既存null行のsystem backfill → `record_crm_audit_log` 置換 → `apply_invited_profile_role` 新設+GRANT/REVOKE。Edge Function変更(invite-user)は同一ブランチの別commitとし、migrationが先に適用されても旧Edge Functionが壊れない順序であることを確認する(直接UPDATE経路はmigration適用後も動作し、監査上systemと記録されるだけ — 劣化なし・非破壊)。

## 7. テスト(受け入れ条件)

pgTAP(新ファイル `004_audit_actor.test.sql`):

- T1: adminがcandidatesを更新 → 監査行が `actor_kind = 'user'`、`actor_id` = そのadmin。
- T2: `apply_invited_profile_role` をservice roleコンテキストで実行 → role_change行が `service` + requester_id。あわせて `authenticated` からの同関数EXECUTEが拒否されること。
- T3: `auth.users.email` 更新 → profiles更新の監査行が `system` + actor null。
- T4: 既存null行backfillの結果、`actor_id is null and actor_kind <> 'system'` の行がゼロ。
- T5: 詐称防止 — authenticatedユーザーAが `set_config('app.audit_actor_id', '<ユーザーBのID>', true)` を実行してからcandidatesを更新しても、監査行は `user` + AのID。
- T6: `apply_invited_profile_role` が `admin` や `suspended` をnew_roleとして拒否すること。

vitest: invite-userの直接UPDATE廃止(コード内に `from("profiles").update` 相当が残っていないこと)の静的確認。

既存テスト: 000/001/002/003の全断定が無変更で成功。

## 8. Codexへの注意

- 監査トリガー置換は `create or replace` で行い、発火対象テーブル・記録メタデータの範囲を一切変えない。
- 本設計書からの逸脱が必要になった場合は、実装せず理由を添えてFable 5へ差し戻す。
- production適用条件は従来どおり(ローカルクリーンDB → pgTAP → staging → drill → Runbook)。
