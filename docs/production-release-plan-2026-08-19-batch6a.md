# production適用計画: 未適用migration 7本 + Batch 6A（2026-08-19起案）

`docs/production-release-runbook.md` を今回の対象に合わせて具体化した実行計画です。Runbookが正本で、本書はそれを置き換えません。**Runbookの記述が今回の対象と食い違う箇所（後述「Runbookとの差異」）を明示するために作成しています。**

対象: production `dsaqarejqslzgcatkxeh`（`candidate-crm`）
起案時点の `main`: `790f6ea`
staging（`admjgbfrfoczpxdtxmgy`）へは2026-08-19に同一の7本を適用済みで、問題なく動作している（証跡は `docs/production-go-no-go-checklist.md` の「Stage 3 参考情報」）。

## 適用対象（7本、2026-08-19時点で `migration list --linked` により確認）

| version        | ファイル                                   | 内容                                             |
| -------------- | ------------------------------------------ | ------------------------------------------------ |
| 20260811124525 | `add_suspended_profile_role`               | `suspended` ロール追加                           |
| 20260811124746 | `sync_profile_email_from_auth`             | profile email 同期                               |
| 20260813024735 | `optimize_rls_role_initplan`               | Batch 3。51 policy・66箇所のロール参照を書き換え |
| 20260813103834 | `audit_actor_attribution`                  | Batch 4。監査actorを user/service/system へ分類  |
| 20260814105946 | `restrict_invited_profile_role_to_pending` | 招待RPCのpending限定                             |
| 20260814110220 | `restrict_trigger_function_execute`        | trigger専用関数のEXECUTE権限整理                 |
| 20260817030000 | `ai_provenance_columns`                    | Batch 6A。AI入力provenanceの5列                  |

いずれもFable 5レビュー承認済みで `main` にマージ済み、CIのUbuntuジョブでクリーンDBからの適用とpgTAPを通過している。**承認済み対象以外が dry-run に現れた場合は中止する**（Runbook 5節）。

## 前提条件（着手前に満たすこと）

1. **WSL2 + Docker Desktop が動作していること。** `supabase db dump` は `pg_dump` をコンテナ内で実行するため Docker デーモンが必須。2026-08-19時点のWindows機はWSL2未導入で、Runbook 2節のバックアップが実行できず0バイトのファイルが生成されることを実地に確認済み。`docker info` が成功することを着手前に確認する。
2. **適用直前のバックアップ**（Runbook 2節・3節）を取得済みであること。Freeプランのため自動バックアップがなく、これが唯一の復旧手段。
3. production用 `AI_FINGERPRINT_HMAC_KEY_V1` を設定済みであること（**stagingとは別の値**）。設定直後にDashboardのSHA256ダイジェストを控えと照合する（`docs/backup-runbook.md` 9節 項目4）。

## restore drillの扱い（今回は実施しない）

Runbook 4節のrestore drillはStage 1の必須項目で、チェックリスト S1-4 は2026-08-10に ☒ 済、2026-08-14にもproductionバックアップからの drill を完了している。**今回のリリースでは実施しない**とリリース判断者が判断した（2026-08-19）。毎回必須なのは2節・3節のバックアップであり、drillはStage 1のゲートとして既に満たされているという整理。

この判断により、**Runbook 6.1のfail-fastゲートをそのまま実行すると `.restore-drill-ok` が無いため中止になる。** 今回は同ゲートを次の2マーカーで実行する。Runbook 6.1の本文（Stage 1向け）は変更しない。

```bash
for marker in .backup-db-ok .backup-storage-ok; do
  if [ ! -f "$BACKUP_DIR/$marker" ]; then
    echo "FATAL: $marker not found. Backup is not verified." >&2
    exit 1
  fi
done
```

## 実行順序

**secrets設定 → migration適用 → Edge Function deploy** の順を厳守する（設計書 `docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md` 2.11節）。列がない状態でdeployするとprovenance UPDATEが失敗し、fail-closedでAI送信自体が止まる。

1. Runbook 1節の誤接続防止チェック（1名実施のため1.1の二段階確認を行う）
2. Runbook 2節: DBバックアップ（roles / schema / data）。`.backup-db-ok` マーカーを確認
3. Runbook 3節: Storageバックアップ。`.backup-storage-ok` マーカーを確認
4. production secretsへ `AI_FINGERPRINT_HMAC_KEY_V1` を設定し、ダイジェストを照合
5. 上記の2マーカー版fail-fastゲート
6. `db push --dry-run` で**7本だけ**が出ることを確認（1件でも差異があれば中止）
7. `db push` で適用
8. `migration list --linked` で未適用0を確認
9. Edge Function を2本deploy（`generate-candidate-summary`、`extract-job-posting`）し、`functions list` で `ACTIVE` / `verify_jwt: true` を確認
10. 適用後検証（下記）
11. 結果を `docs/production-go-no-go-checklist.md` へ記録

## 適用後検証

### 技術的検証（SQL）

Runbook 6.3節はStage 1の2migration（列権限）向けの内容で、今回の7本には対応していない。また同節が使う `supabase db query` サブコマンドは **CLI 2.111.0 に存在しない**（`supabase db` のサブコマンドは diff / dump / push / pull / reset / lint）。今回はSupabase DashboardのSQL Editorで以下を確認する。

- `ai_generation_requests` と `job_import_requests` に5列（`input_fingerprint` / `hash_algorithm` / `hash_key_version` / `redaction_version` / `input_schema_version`）が存在する
- 既存行の5列がすべてNULLである（backfillしていないこと）
- `profiles` のロールCHECK制約に `suspended` が含まれる
- 監査ログのactor分類列が存在する
- Stage 1で確認した列権限が維持されている（`email_threads` の authenticated UPDATE は `archived_at`, `status` の2列、`files` は `archived_at` の1列）

### 本番アプリでの基本動作確認

**7本まとめての適用であり、Batch 3のRLS全面書き換えを含むため、実アプリでの確認を行う**（2026-08-19、リリース判断者の指示）。Runbook 13節に従い、**実在する候補者・企業・求人データは入力しない**。既存データの閲覧を中心に確認する。

| 項目                                                                      | 結果 |
| ------------------------------------------------------------------------- | ---- |
| ログイン / ログアウト / アプリ再起動後のセッション復元                    |      |
| ホーム画面が正常表示（エラー画面にならない）                              |      |
| 候補者・企業・求人の一覧と詳細が閲覧できる（RLS書き換え後の読み取り確認） |      |
| 監査ログがadminで閲覧でき、直前の操作が記録されている                     |      |
| AI機能疎通1回（架空データ。`docs/fixtures/job-import-sample.txt`）        |      |
| 上記AI実行で5列が期待形式で記録される                                     |      |

AI疎通は架空の求人票で行い、実在データを使わない。実行後にDBで5列を確認する。

## Runbookとの差異（今回の適用で読み替える箇所）

| Runbook箇所 | 記述                                             | 今回の扱い                                                             |
| ----------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| 6.1         | `.restore-drill-ok` を含む3マーカーを必須とする  | drillを実施しないため2マーカー版で実行（上記）                         |
| 6.2         | dry-runに2件だけが表示されることを確認、他は中止 | 今回は上表の**7本**が対象。7本以外が出た場合に中止                     |
| 6.3         | 列権限2件の確認。`supabase db query` を使用      | CLI 2.111.0に `db query` は無い。DashboardのSQL Editorで上記項目を確認 |
| 5           | Stage 1の2件を適用済みとして記載                 | 今回の対象は上表7本。適用前に `migration list --linked` で再確認する   |

これらはRunbook本文の更新候補でもある。今回の適用完了後、Runbookを「Stage 1専用の記述」と「以降のリリース共通の記述」に整理することを推奨する。

## ロールバック方針

Runbook 16節に従う。Batch 6Aについては設計書2.11節のとおり、Edge Functionを旧版へ戻せば列がNULLのまま記録される。**列削除のrollback migrationは作らない**（記録済みprovenanceを失うため）。
