# Candidate CRM 作業引き継ぎ（2026-08-19 追補、職場PC → 自宅PCへの移行）

同日の `docs/development-handoff-2026-08-19.md` の続きです。あちらが作業内容の記録、本書は **作業機を職場PCから自宅PCへ移すための引き継ぎ** です。production適用の実行計画は `docs/production-release-plan-2026-08-19-batch6a.md` が正本で、本書はそれを置き換えません。

> **2026-08-20 追記: 本書の前提は解消した。** 同日に職場PCで `wsl --install` が成功し（403は出なかった）、WSL2が使えるようになった。再起動後に `docker info` が通れば **production適用は職場PCで実行できる**。以下の「職場PCでは実行不可能」という結論は、その時点の観測として残すが現在は有効でない。最新の状況は `docs/development-handoff-2026-08-20.md` 5節が正本。自宅PCで作業する場合の手順としては本書は引き続き有効。

## 結論

- **職場PCではWSL2のインストールが管理ポリシーによりブロックされた（403）。** Docker Desktopの導入も断念した
- したがって **production適用は職場PCでは実行不可能**。自宅PCで行う
- **職場PCから持ち帰るものはない。** 自宅PCでは `git pull` のみで最新に追いつく（zip等での持ち出しは不要）

## 1. 職場PCで加えた変更

このセッションで行ったリポジトリへの変更は次の1件のみ。

- `git merge --ff-only origin/main` により `main` を `5eb7f46` → `33280c8` へ fast-forward（`docs/production-release-plan-2026-08-19-batch6a.md` と `docs/development-handoff-2026-08-19.md` を取得）

**持ち帰りが必要なものは「なし」。** 根拠として次を確認済み。

| 確認内容                                               | 結果                             |
| ------------------------------------------------------ | -------------------------------- |
| `git status --short`                                   | 出力なし（作業ツリーclean）      |
| `git rev-list --left-right --count HEAD...origin/main` | `0	0`（ローカル独自コミットなし） |
| `git stash list`                                       | 空                               |
| `git status --porcelain -uall`                         | 出力なし（未追跡ファイルなし）   |

`main` の内容はすべて GitHub 上にあり、ローカルにしか存在しないコミット・stash・未追跡ファイルは存在しない。**自宅PCでの `git pull` が唯一必要な同期手段であり、ファイルの持ち出しは不要。**

例外は追跡対象外の `.env` だが、職場PCでは値が両方とも空（キー行のみ）で、持ち帰る価値のある内容を持たない。`.gitignore:10` により追跡対象外であることは前セッションで確認済み。自宅PCでは値を新たに設定する（下記4章）。

## 2. 職場PCの環境確認結果（2026-08-19時点）

| 項目                              | 状態                                                  |
| --------------------------------- | ----------------------------------------------------- |
| git / Node.js / npm / gh / Rust   | 導入済み（gh は `Yudai-Ito554554` でログイン済み）    |
| リポジトリ `C:\dev\candidate-crm` | clone済み・`npm ci` 済み・`33280c8` と同期            |
| Supabase CLI                      | 2.111.0（`npx` 経由）。**未ログイン**、link先も未設定 |
| `.env`                            | キー行のみで値は空                                    |
| **WSL2**                          | **導入不可**（管理ポリシーによりブロック、403）       |
| **Docker Desktop**                | **未インストール**（WSL2が前提のため導入を断念）      |

## 3. WSL2 / Docker が必要な理由

`docs/production-release-plan-2026-08-19-batch6a.md` の前提条件1のとおり。

- **`supabase db dump` は `pg_dump` をDockerコンテナ内で実行する。** Dockerデーモンがないとバックアップが取得できず、0バイトのファイルが生成されるだけであることを2026-08-19に実地確認済み
- Supabase **Freeプランのため自動バックアップがなく、適用直前のバックアップが唯一の復旧手段**。Runbook 6.1のfail-fastゲート（今回は `.backup-db-ok` / `.backup-storage-ok` の2マーカー版）も、バックアップ未取得なら必ず中止になる
- したがって **バックアップなしにmigration適用へ進む選択肢はない**。7本にはBatch 3のRLS全面書き換え（51 policy・66箇所）が含まれるため、なおさら
- 副次的に、ローカルの `npm run supabase:reset` / `supabase:test` も実行不可。DB検証は従来どおりCIのUbuntuジョブが担保する

職場PCではWSL2が組織のポリシーで拒否されるため、この前提は将来も満たせない。**職場PCでの回避策（Docker以外でのdump等）は探さない方針とする。**

## 4. 自宅PCでの再開手順

### 4.1 事前確認

自宅PCで次が満たされていること。満たされていなければ、前のPC向けに用意した環境構築手順（`wsl --install` → 再起動 → winget で Git / Node.js LTS / Rustup / GitHub CLI / Docker Desktop）を先に実施する。

```powershell
git --version; node --version; npm --version; gh --version
docker info
```

**`docker info` が成功することが着手の必須条件。**

### 4.2 リポジトリの同期

既にcloneがある場合:

```powershell
cd C:\dev\candidate-crm
git status
git pull --ff-only
git log --oneline -5
```

`33280c8 docs: add production release plan for the pending seven migrations` 以降が入っていればよい（本書のコミットを含む）。cloneがない場合は `git clone https://github.com/Yudai-Ito554554/Candidate-crm.git candidate-crm` → `npm ci`。

### 4.3 認証とlink

```powershell
gh auth login
npx supabase login
```

link先は **production `dsaqarejqslzgcatkxeh`** へ切り替える（staging は `admjgbfrfoczpxdtxmgy`）。`.env` も production の値（`VITE_APP_ENV=production` / production URL / production publishable key）へ差し替える。**link先とアプリ設定の不一致は `npm run supabase:check:linked` が検出するゲートなので、必ず両方揃える。**

### 4.4 以降

`docs/production-release-plan-2026-08-19-batch6a.md` の「実行順序」11ステップに従う。着手前に読む文書:

- `AGENTS.md`
- `docs/production-release-plan-2026-08-19-batch6a.md`（今回の正本）
- `docs/production-release-runbook.md`（Runbookとの差異は計画書の該当表を参照）
- `docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md` 2.12節

変わっていない重要事項:

- restore drill は今回不要（Stage 1で完了済み）。**必須なのは適用前バックアップのみ**
- dry-run で**7本以外**が出たら中止
- production用 `AI_FINGERPRINT_HMAC_KEY_V1` は**未生成**。stagingとは別の値にし、生成直後にパスワードマネージャへ保存 → 保存物を開いて生成値と一致することを目視確認 → Supabaseへ貼付 → SHA256ダイジェストで照合（stagingで貼り間違いの実例あり）
- **productionではfail-closedの実証を再演しない。key設定後に削除しない**
- `supabase projects api-keys` は実行しない（service_role JWTが平文出力される）
- 7本まとめての適用でBatch 3のRLS全面書き換えを含むため、適用後に本番アプリでの基本動作確認を行う（計画書「適用後検証」の表）。実在データは入力しない

## 5. production適用後に残るタスク（変更なし）

- **S3-3（viewer直URL確認）**: 2026-08-19にFable 5が案D（UAT要件の再定義）を決定し、前回方式は撤回済み（`docs/fable5-decision-s3-3-2026-08-19.md`）。合格条件(1)(2)は達成済みで、残るはstaging Tauriアプリでの実機UAT(3)のみ
- **S3-7**: 企業・求人の重複警告/アーカイブ/復元の実地確認
- **社員2名への配布**: Supabaseダッシュボードで直接ユーザー作成（Freeプランは招待メールが届かない）→ production版Windowsビルド配布 → role を agent か viewer に設定
- ~~`scripts/check-supabase-readiness.mjs` のWindowsバグ~~ **2026-08-19に修正済み（`3debb76`）。** 自宅PCでも `npm run supabase:check:linked` がそのまま使える

## 6. 秘密情報の扱い

本書にパスワード・APIキー・接続文字列の値は含めていない。職場PCのセッション中も、秘密情報をチャットやリポジトリへ出していない。職場PCの `.env` は値が空であり、秘密情報は保持していない。
