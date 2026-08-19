# Candidate CRM 作業引き継ぎ（2026-08-19、職場Windows PCでの再開セッション）

このセッションの作業ログと、次回すぐ再開するための手順です。プロジェクト全体の状況は `HANDOFF.md`、ルールは `AGENTS.md` が正本。ここには「次の続き」に必要なことだけを書きます。

## 現在の位置

- `main` HEAD: `5eb7f46`（このセッション開始時にリモートから取得）。直近CI Run `32037266260` は全3ジョブ成功
- **作業機が職場のWindows PCへ移った。** `C:\dev\candidate-crm`。Git/Node/Rust/gh/VS Build Tools は導入済み
- **staging（`admjgbfrfoczpxdtxmgy`）へ Batch 6A を適用完了。** production（`dsaqarejqslzgcatkxeh`）へは一切操作していない
- 中断地点: **production適用の直前**。設計書2.12節のstaging側要件はすべて満たしている

## このセッションで完了したこと

### 1. Batch 6A（AI入力provenance）のstaging適用

詳細な証跡は `docs/production-go-no-go-checklist.md` の「Stage 3 参考情報: Batch 6A（AI入力provenance）のstaging適用記録（2026-08-19）」が正本。要点のみ:

- secrets `AI_FINGERPRINT_HMAC_KEY_V1` を設定
- **migrationは7本未適用だった**（Batch 6Aの1本だけではなく、Batch 3のRLS書き換えとBatch 4の監査actor分類を含む）。dry-runで確認のうえ7本適用し、未適用0を確認
- `generate-candidate-summary` / `extract-job-posting` を deploy（ACTIVE / v4 / verify_jwt: true）
- 両機能を実行し5列を確認、同一入力の再実行で同一fingerprintを確認、AI出力の劣化がないことを確認
- key削除状態でfail-closedを実証（行が1件も作られず、providerへも送信されない）

### 2. key再登録での取り違えと復旧

fail-closed確認後の再登録で一度だけ誤った値が入り、`ai_generation_requests` の 06:21:10 UTC の1行が検証不能なまま残った。控えの値で登録し直してダイジェスト・fingerprintとも復旧済み。得られた運用知見は `docs/backup-runbook.md` 9節の項目4・5へ追記した。**productionではfail-closedを再演しない。**

### 3. `.env` をstaging向けに設定

`VITE_APP_ENV=staging` / staging URL / staging publishable key。`.gitignore:10` により追跡対象外であることを確認済み。

## 次回やること

### 1. Batch 6A の production 適用（最優先）

設計書 `docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md` 2.12節が正本。順序は **secrets設定 → migration適用 → Edge Function deploy**。

未確認の重要事項として、**production側のmigration適用状況を先に `supabase migration list --linked` で確認すること。** stagingが7本遅れていた前例があるため、Batch 6Aの1本だけとは限らない。適用対象がBatch 6A以外を含む場合は、その内容を確認してから判断する。

production適用前に、既存Runbookのproduction適用条件（バックアップ、dry-run、Go/No-Go記録）を満たすこと（2.12節 項目6、本セッションでは未評価）。

production用のHMAC keyは**stagingとは別の値**にする。設定後ただちにパスワードマネージャへ保管し、Dashboardのダイジェストを控えと照合する。

### 2. S3-3 の方式再決定（ブロック中）

Fable 5が指定した「web buildをブラウザで開き、viewerでURLバーから編集6ルートを直打ち」は、**このコードベースでは成立しない**ことが判明した。

- `src/lib/supabase.ts:19` が `persistSession: false`
- セッション復元はOS資格情報ストア経由のみ（`src/features/auth/auth-provider.tsx:60-66`）。ブラウザには存在しないため、完全リロードで必ずログアウトする
- `src/features/auth/protected-route.tsx:16` は遷移元を保持せず `/login` へ飛ばす
- `src/pages/login-page.tsx:34,72` はログイン後に常に `/` へ遷移する

したがってURLバー入力では、要求したルートに到達する前に未ログイン状態になり、「編集画面が開かない」理由がviewerのロール制御だと言えない。検討した選択肢:

- **A**: ログイン後に要求ルートへ復帰する実装を追加（`protected-route` で遷移元を保持し、`login-page` で復帰）。Tauriのディープリンクにも効く正攻法。コード変更とレビューが必要
- **B**: viewerでログイン後、SPA内のナビゲーションで6ルートを確認する。コード変更なしだがFable 5の指定方式とは異なるため、証跡の妥当性を再確認する必要がある
- **C**: S3-3を保留し他項目を先行する

未決定。Fable 5へ再照会するのが妥当と思われる。

### 3. S3-7（企業・求人の重複警告/アーカイブ/復元の実地確認）

stagingアプリでの画面操作のみ。候補者は確認済み、企業・求人が未確認。

## 未実施のまま残っていること

### `scripts/check-supabase-readiness.mjs` のWindowsバグ（未修正）

`npm run supabase:check:linked` が Windows で必ず「Supabase CLIの認証状態を確認できません」を返す。環境ではなくコードの問題。

`resolveSupabaseCommand()`（同ファイル 42-58行）がWindowsで `node_modules/.bin/supabase.cmd` を解決し、`checkSupabaseAuthentication()`（同 68-82行）が `shell` 指定なしで `spawnSync` する。Node は CVE-2024-27980 対策以降、`.cmd` の直接spawnを **EINVAL** で拒否するため、認証済みでも必ず失敗する。macOSでは拡張子なしの `supabase` を spawn するため発生しない。

再現:

```
status= null error= EINVAL spawnSync ...supabase.cmd EINVAL
```

同じコマンドをシェル経由で実行すると `exit=0` で正常にプロジェクト一覧が返る。**false negative** である。

本セッションでは、残る5項目（`.env`存在・URL形式・publishable key・CLI存在・**link済みrefとアプリ設定の一致**）が通っていること、および認証状態を手動で `exit=0` として確認したことをもって先へ進めた。

**2026-08-19に修正済み（`3debb76`）。** 共通ヘルパ `spawnSupabaseCli()` を追加し、win32のみ引用済みの単一コマンド文字列をシェル経由で実行する（`shell: true` と引数配列の併用はNode 24の `DEP0190` に当たるため避けた）。詳細は `docs/development-handoff-2026-08-20.md` 1.1節。

### WSL2未導入

前回から変わらず。ローカルの `supabase:reset` / `supabase:test` は実行不可で、DB検証はCIのUbuntuジョブが担保。

**2026-08-19 追記: 職場PCではWSL2のインストールが管理ポリシーによりブロックされた（403）。** Docker導入を断念し、production適用は自宅PCで行う。移行手順は `docs/development-handoff-2026-08-19-home-pc-resume.md`。

### AI出力の表示崩れ（軽微）

候補者サマリーの「面談で確認すべきこと」に、モデルが改行を実文字ではなく `\n` の2文字として返す場合があり、画面へそのまま表示される。2026-08-19の2回目の生成で発生し、1回目と4回目では発生しなかった。コードの退行ではなくモデル出力の揺れだが、利用者の目に触れる表示崩れとして記録する。

## 再開時の最初のコマンド

```powershell
cd C:\dev\candidate-crm
git status
git log --oneline -5
& "C:\Program Files\GitHub CLI\gh.exe" run list --branch main --limit 5
```

`git status` がcleanでない場合は、誰の作業か確認してから進める。`.env` は現在stagingを向いている。productionへ向ける場合は `VITE_APP_ENV` と URL・keyの3つとも差し替えること。

## 秘密情報の扱い

このドキュメントにパスワード・APIキー・接続文字列の値は含めていない。`AI_FINGERPRINT_HMAC_KEY_V1` は名前とSHA256ダイジェストのみを扱い、値はセッション中も一度もチャット・リポジトリへ出していない。fingerprint値はDBへ記録される公開情報であり秘密ではない。
