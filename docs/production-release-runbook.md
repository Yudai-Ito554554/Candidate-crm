# Candidate CRM 本番移行Runbook

最終更新: 2026-08-10（Asia/Tokyo、本番Stage 1実施結果を反映）
Release Candidate baseline: `aba26b5`（`main`ブランチ）

このRunbookは、非本番Supabase（`candidate-crm-staging` / project ref `admjgbfrfoczpxdtxmgy`）でのUATを踏まえ、本番Supabase（`candidate-crm` / project ref `dsaqarejqslzgcatkxeh`）へ移行する際の手順書です。

> **実施記録（2026-08-10）:** Stage 1は完了しています。対象2migrationはproductionへ適用済みで、列権限、全publicテーブル件数、Storageメタデータ、Advisorを適用前後で検証済みです。本RunbookのStage 1適用手順を同じproductionへ再実行しないでください。以降のリリースでは`migration list --linked`と`db push --dry-run`から未適用差分を毎回動的に確認します。

実際に本番操作を行う担当者は、実施前に必ず [`docs/production-go-no-go-checklist.md`](./production-go-no-go-checklist.md) を確認し、実施しようとしている段階（Stage 1〜3）の重大項目がすべて満たされていることを確認してください。

## 0. 前提・用語

- 「production」= project ref `dsaqarejqslzgcatkxeh`（Supabase project名 `candidate-crm`）
- 「staging」= project ref `admjgbfrfoczpxdtxmgy`（Supabase project名 `candidate-crm-staging`）
- 両プロジェクトは同一組織 `yudai.ito Org`（org id `okbmnnblasbllmtiisoh`）に属し、**Freeプラン**です（2026-08-09時点、Dashboard表示で確認）。
  - Freeプランには自動デイリーバックアップが含まれません（Pro以上で過去7日分、Team以上で14日分、Enterpriseで最大30日分）。
  - PITR（Point-in-Time-Recovery）はPro以上向けの**別課金アドオン**であり、Small Compute Add-on以上が別途必要です。WALは既定で2分間隔でアーカイブされ、保持日数に応じて時間課金（7日保持で$0.137/時〜28日保持で$0.55/時、2026-08-09時点の公式情報）。つまり「Proにすれば自動的にPITRが付く」わけではなく、PITRはProの日次バックアップとは別に有効化・別課金が必要な機能です。
  - 参照: <https://supabase.com/docs/guides/platform/backups>
  - 現在Freeプランのため、**「2. 移行前バックアップ」「3. Storageバックアップ」に記載する手動バックアップが、本番の唯一の復旧手段**です。
- CLIは `SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 <command>` の形式で実行してください。CLI 2.112.0には`projects list`のAPIレスポンス解析で失敗するバグを確認しています（本セッションで検証済み）。バージョンは実行時点の最新安定版を都度 `--version` で確認し、問題があれば2.111.0へ固定してください。本Runbook中のコマンドはすべて2.111.0の`--help`出力、または該当コマンドの実行結果で構文を確認済みです（推測で書いたコマンドはありません）。
- Supabase CLIの`db query`・`db push`・`functions deploy`・`storage`等は`supabase link --project-ref <ref>`で「リンク」した状態のディレクトリに対して`--linked`フラグで実行します。**開発用のメインリポジトリを直接productionへリンクしないでください。** 誤操作時に`db push`等が本番へ向いてしまうリスクがあるためです。本番操作は本Runbookの「1. 誤接続防止チェック」の隔離手順に従ってください。
- `supabase storage`のサブコマンド（`ls`/`cp`）は、`--help`のフラグ一覧には明記されていませんが、実行時に`--experimental`フラグを必須で要求します（本セッションでstaging環境に対し実行し、`--experimental`なしでは`LegacyExperimentalRequiredError`になることを確認済み）。本Runbookのstorageコマンドには`--experimental`を含めています。
- **バックアップ用ディレクトリ（productionへlink）と、restore drill用ディレクトリ（productionへは絶対にlinkしない）は、常に別々のディレクトリです。** 本Runbookでは前者を`/tmp/candidate-crm-prod-release`、後者を`$HOME/secure-restore-drills/candidate-crm`として明確に区別します。同一ディレクトリを両方の用途に使い回さないでください。macOSのColima/QEMUではホストの`/tmp`が仮想マシンへ共有されない場合があるため、Docker bind mountを使うローカルdrillを`/tmp`配下に作成しません。
- 本Runbookのコマンド列は`bash`の`set -euo pipefail`を前提としたシェルスクリプトとして記載しています。**シェバンは全て`#!/usr/bin/env bash`を使用してください（`#!/bin/sh`は環境によって`pipefail`オプション自体をサポートしない場合があり、失敗検知が機能しなくなるため使いません）。** 対話的に1行ずつコピー&ペーストするのではなく、まとまったブロックを1つのスクリプトファイルとして保存してから実行してください。
- 各スクリプトは、別プロセス・別ターミナルセッションとして実行される前提です。**シェル変数（`BACKUP_DIR`等）は環境変数として引き継がれません。** 2節で作成した`BACKUP_DIR`は、固定パスのポインタファイル（`/tmp/candidate-crm-prod-release/.backup-dir`）へ保存し、3節・4節・6節はそのポインタファイルを読み込んで使用します（詳細は各節を参照）。

## 1. 誤接続防止チェック（毎回、操作前に必須）

本番操作を行う前に、必ず以下を実施してください。

1. 操作専用の隔離ディレクトリを新規作成する（メインの開発リポジトリを直接productionへリンクしない）。

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   mkdir -p /tmp/candidate-crm-prod-release
   cd /tmp/candidate-crm-prod-release
   SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 init --workdir /tmp/candidate-crm-prod-release
   ```

2. migrationファイルを、承認されたリリース対象コミットのリポジトリから隔離ディレクトリへコピーする。

   ```sh
   cp /path/to/candidate-crm/supabase/migrations/*.sql /tmp/candidate-crm-prod-release/supabase/migrations/
   ```

3. productionへlinkする。

   ```sh
   SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 link --project-ref dsaqarejqslzgcatkxeh --workdir /tmp/candidate-crm-prod-release
   ```

4. linkされたrefがproductionと一致することを必ず目視確認する。

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   PRODUCTION_REF="dsaqarejqslzgcatkxeh"
   LINKED_REF=$(cat /tmp/candidate-crm-prod-release/supabase/.temp/project-ref)
   if [ "$LINKED_REF" != "$PRODUCTION_REF" ]; then
     echo "FATAL: linked ref ($LINKED_REF) does not match production ($PRODUCTION_REF). Aborting." >&2
     exit 1
   fi
   echo "OK: linked to production ($LINKED_REF)"
   ```

5. `supabase projects list`でも対象プロジェクトの名前とrefを再確認する。

   ```sh
   SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 projects list -o json
   # dsaqarejqslzgcatkxeh の name が "candidate-crm"（本番、"candidate-crm-staging" ではない）であることを確認
   ```

6. 実施者・確認者の2名以上で、上記4・5の出力を一緒に確認する（下記チェック欄に記名）。

### 1.1 1名で実施する場合の代替確認（二段階確認）

確認者を同席させられない場合は、以下の二段階確認を必ず行う。

1. コマンド実行前に、対象ref（`dsaqarejqslzgcatkxeh`、`candidate-crm`、本番であること）を声に出して読み上げる、またはメモに書き出す。
2. dry-run結果をファイルへ保存する（6節で実施）。

   ```sh
   SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db push --linked --dry-run \
     --workdir /tmp/candidate-crm-prod-release \
     > /tmp/candidate-crm-prod-release/dry-run-result.txt
   cat /tmp/candidate-crm-prod-release/dry-run-result.txt
   ```

3. 一度その場を離れる、または他の作業を挟んでから戻り、保存した`dry-run-result.txt`とref確認の記録を読み直す。
4. 保存された内容が想定通り（対象2migrationのみ、ref一致）であることを再確認できて初めて、次の操作（バックアップ・適用）へ進む。想定外のmigrationやrefが1件でも含まれていたら中止する。

### チェック欄

| 項目                                                                 | 実施者 | 確認者 | 日時 |
| -------------------------------------------------------------------- | ------ | ------ | ---- |
| 隔離ディレクトリでのlink・ref確認（手順1〜5、または1.1の二段階確認） |        |        |      |

## 2. 移行前バックアップ（データベース: roles / schema / data）

Freeプランのため自動バックアップがありません。**破壊的操作（migration適用等）の直前に、必ず手動でバックアップを取得してください。**

公式の推奨手順（<https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>）に従い、roles・schema・dataを3つの別ファイルへ分割して取得します。公式ドキュメントの例は`--db-url [CONNECTION_STRING]`を使いますが、本Runbookでは**DBパスワードを直接扱わないため、代わりに`--linked`を使用します**（`db dump`は`--linked`と`--db-url`の両方に対応していることを`--help`で確認済み）。

**このスクリプトの成功後、`BACKUP_DIR`の絶対パスを固定のポインタファイルへ書き出します。** 別プロセスとして実行する3節・4節・6節は、このポインタファイルを読み込んで`BACKUP_DIR`を復元します（シェル変数は別プロセスへ引き継がれないため）。

```bash
#!/usr/bin/env bash
set -euo pipefail

umask 077
BACKUP_DIR="$HOME/secure-backups/candidate-crm/$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

BACKUP_DIR_POINTER="/tmp/candidate-crm-prod-release/.backup-dir"
printf '%s' "$BACKUP_DIR" > "$BACKUP_DIR_POINTER"
chmod 600 "$BACKUP_DIR_POINTER"

cd /tmp/candidate-crm-prod-release

# roles.sql（ロール定義）
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db dump \
  --linked --role-only --file "$BACKUP_DIR/roles.sql"

# schema.sql（スキーマ定義）
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db dump \
  --linked --file "$BACKUP_DIR/schema.sql"

# data.sql（データ、COPY形式）
# 公式手順に合わせ、AI/ベクター検索用の内部テーブルを除外する。
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db dump \
  --linked --data-only --use-copy \
  --exclude "storage.buckets_vectors" \
  --exclude "storage.vector_indexes" \
  --file "$BACKUP_DIR/data.sql"

# restore drillで「復元後の権限」を適用後の期待値と比較しないよう、
# バックアップ取得時点（migration適用前）の列権限を基準値として保存する。
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db query --linked \
  --workdir /tmp/candidate-crm-prod-release \
  "select table_name, column_name
   from information_schema.role_column_grants
   where table_schema = 'public'
     and table_name in ('email_threads', 'files')
     and grantee = 'authenticated'
     and privilege_type = 'UPDATE'
   order by table_name, column_name;" \
  > "$BACKUP_DIR/pre-migration-column-grants.json"

# 検証: 3ファイルとも非ゼロサイズであることを確認する。1つでも欠けていれば
# ここで停止し、以降の節（Storageバックアップ・migration適用）へは進めない。
for f in roles.sql schema.sql data.sql pre-migration-column-grants.json; do
  path="$BACKUP_DIR/$f"
  if [ ! -s "$path" ]; then
    echo "FATAL: $f is missing or empty. Backup failed." >&2
    exit 1
  fi
done

chmod 600 "$BACKUP_DIR"/*.sql "$BACKUP_DIR/pre-migration-column-grants.json"
echo "OK: database dumps and pre-migration grant baseline created"

# 後続の節（migration適用）はこのマーカーの存在を必須条件とする。
touch "$BACKUP_DIR/.backup-db-ok"
```

> 備考: `storage.buckets`・`storage.objects`（`crm-files`バケットとファイルの**メタデータ**）はこの`data.sql`に含まれます。ただし**Storageに実際にアップロードされたファイルの中身（バイナリ実体）はデータベースダンプに一切含まれません**。ファイル実体のバックアップは「3. Storageバックアップ」で別途行います。

- `umask 077`により、以後このシェルで作成するファイル・ディレクトリは所有者本人のみ読み書き可能になる。`BACKUP_DIR`自体も`chmod 700`する。
- ポインタファイル（`/tmp/candidate-crm-prod-release/.backup-dir`）は`chmod 600`する。中身は`$BACKUP_DIR`の絶対パスのみで、秘密情報は含まない。
- `$HOME`配下の専用ディレクトリを使い、作業終了後は暗号化ストレージへ移動するか、確実に不要になった時点で削除する。**このディレクトリ名・パスやファイルの中身をチャット・ログ・issue等に貼り付けない。**
- スクリプトが`FATAL`で停止した場合、原因を特定してから最初からやり直す。中途半端なファイルを使い回さない。

**チェック欄**

| 項目                                                              | 実施者 | 確認者 | 日時 |
| ----------------------------------------------------------------- | ------ | ------ | ---- |
| バックアップスクリプトが`OK`まで完走し`.backup-db-ok`が作成された |        |        |      |
| ポインタファイル作成・権限600確認、`BACKUP_DIR`権限700確認        |        |        |      |

## 3. Storageバックアップ（`crm-files`の実ファイル）

「2. 移行前バックアップ」のデータベースダンプには、`crm-files`バケットの**メタデータ**（ファイル名・パス・サイズ等）は含まれますが、**アップロードされたファイルの実体（バイナリ）は含まれません。** ファイル実体は別途Storage APIから取得する必要があります。

Supabase CLI 2.111.0の`storage cp`/`storage ls`サブコマンドを使用します（`--help`および本セッションでのstaging環境への実行で構文・`--experimental`フラグの必要性を確認済み）。

**この節は別プロセスとして実行するため、`BACKUP_DIR`をポインタファイルから読み込みます。** 読み込んだパスが想定のディレクトリ配下でない、またはポインタファイルが存在しない・空・対象ディレクトリが存在しない場合は、いずれもここで停止します。

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR_POINTER="/tmp/candidate-crm-prod-release/.backup-dir"
if [ ! -s "$BACKUP_DIR_POINTER" ]; then
  echo "FATAL: backup dir pointer file missing or empty. Run section 2 first." >&2
  exit 1
fi
BACKUP_DIR=$(cat "$BACKUP_DIR_POINTER")
case "$BACKUP_DIR" in
  "$HOME"/secure-backups/candidate-crm/*) ;;
  *)
    echo "FATAL: backup dir pointer does not resolve under \$HOME/secure-backups/candidate-crm/. Refusing to proceed." >&2
    exit 1
    ;;
esac
if [ ! -d "$BACKUP_DIR" ]; then
  echo "FATAL: backup directory referenced by pointer does not exist." >&2
  exit 1
fi

if [ ! -f "$BACKUP_DIR/.backup-db-ok" ]; then
  echo "FATAL: database backup is not confirmed OK. Run section 2 first." >&2
  exit 1
fi

cd /tmp/candidate-crm-prod-release

# 3.1 対象ファイルの一覧・メタデータ基準値を取得する
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 storage ls ss:///crm-files -r --linked --experimental \
  > "$BACKUP_DIR/crm-files-listing.json"

SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db query --linked \
  --workdir /tmp/candidate-crm-prod-release \
  "select count(*) as object_count, coalesce(sum((metadata->>'size')::bigint), 0) as total_bytes from storage.objects where bucket_id = 'crm-files';" \
  > "$BACKUP_DIR/crm-files-metadata-baseline.json"

LISTED_OBJECT_COUNT=$(python3 - "$BACKUP_DIR/crm-files-listing.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    paths = json.load(source)["paths"]
print(sum(1 for path in paths if not path.endswith("/")))
PY
)

DB_OBJECT_COUNT=$(python3 - "$BACKUP_DIR/crm-files-metadata-baseline.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    payload = json.load(source)
rows = payload.get("rows", payload)
print(rows[0]["object_count"])
PY
)

# 3.2 ダウンロード
mkdir -p "$BACKUP_DIR/crm-files"
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 storage cp -r \
  ss:///crm-files "$BACKUP_DIR/crm-files" \
  --linked --experimental

# 3.3 件数検証
DOWNLOADED_COUNT=$(find "$BACKUP_DIR/crm-files" -type f | wc -l | tr -d ' ')
if [ "$DOWNLOADED_COUNT" != "$LISTED_OBJECT_COUNT" ] || [ "$DOWNLOADED_COUNT" != "$DB_OBJECT_COUNT" ]; then
  echo "FATAL: downloaded, listed-object, and storage.objects counts do not match." >&2
  exit 1
fi

# 3.4 チェックサム作成（相対パスで正規化、後でrestore drill側と比較する）
python3 - "$BACKUP_DIR/crm-files" "$BACKUP_DIR/crm-files.sha256" <<'PY'
import hashlib
from pathlib import Path
import sys

root = Path(sys.argv[1])
output = Path(sys.argv[2])
lines = []
for path in sorted(item for item in root.rglob("*") if item.is_file()):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    lines.append(f"{digest}  {path.relative_to(root).as_posix()}")
output.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
PY

chmod 600 "$BACKUP_DIR"/crm-files.sha256 "$BACKUP_DIR"/crm-files-listing.json "$BACKUP_DIR"/crm-files-metadata-baseline.json
find "$BACKUP_DIR/crm-files" -type f -exec chmod 600 {} \;

echo "OK: $DOWNLOADED_COUNT files downloaded and checksummed"
touch "$BACKUP_DIR/.backup-storage-ok"
```

- `storage ls -r`の`paths`には末尾が`/`のディレクトリprefixが含まれるため、それを実ファイルとして数えない。ダウンロード件数・一覧の実オブジェクト件数・`storage.objects`件数の3者が一致しない場合は停止する。
- `crm-files-listing.json`・`crm-files-metadata-baseline.json`・`crm-files.sha256`は、いずれもファイルパス等を含むため`$BACKUP_DIR`内だけに保存し、**チャット・CIログ・Gitへは出力しない。**

**チェック欄**

| 項目                                                                          | 実施者 | 確認者 | 日時 |
| ----------------------------------------------------------------------------- | ------ | ------ | ---- |
| ポインタファイル読み込み・パス検証が成功した                                  |        |        |      |
| Storageバックアップスクリプトが`OK`まで完走し`.backup-storage-ok`が作成された |        |        |      |
| ダウンロード件数・一覧の実オブジェクト件数・`storage.objects`件数の一致確認   |        |        |      |

## 4. restore drill（Stage 1の必須項目、migration適用前に実施）

**このドリルは「参考」ではなく、Stage 1（セキュリティmigration適用）の必須項目です。** Freeプランには自動バックアップがなく、2節・3節で取得した手動バックアップが唯一の復旧手段であるため、そのバックアップが実際に復元可能であることを、production適用前に検証します。

### 4.1 隔離の原則と共通関数

- **バックアップ取得に使ったディレクトリ（`/tmp/candidate-crm-prod-release`、productionへlink済み）を、このrestore drillに再利用してはいけません。** 新しく別のディレクトリ（`$HOME/secure-restore-drills/candidate-crm`）を使う。macOSのColima/QEMUでは`/tmp`がVMへ共有されず、Supabaseのbind mountが壊れる場合があるため、ローカルdrillを`/tmp`に置かない。
- drill用ディレクトリの接続先は、**production以外**（ローカルSupabase、または使い捨ての検証用Supabaseプロジェクト）だけに限定する。
- DBの復元先とStorageの復元先は、**同一の検証環境**にする（片方だけ別環境にしない）。
- drillのどのコマンドを実行する前にも、対象がproductionでないことを機械的に確認する（fail-closed）。**この確認はSupabase CLIのlink状態だけでなく、`psql`へ渡す接続文字列そのものに対しても行う。** CLIのlink先が検証用プロジェクトでも、接続文字列を誤って本番のものに差し替えてしまえば意味がないため。

以下は関数の定義内容です。**各スクリプトは別プロセスとして独立に実行されるため、関数は「一度定義すれば他のスクリプトからも呼べる」わけではありません。** 4.3節・14.1節など、これらの関数を使うスクリプトは、この定義をそれぞれのスクリプト内に直接含めています（`source`や「先に読み込む」といった、別プロセス間で状態を共有する曖昧な手順には依存していません）。**接続文字列自体（`db_url`引数）はエラーメッセージにも一切出力しない。**

```bash
PRODUCTION_REF="dsaqarejqslzgcatkxeh"

# CLIのlink状態からrefを確認する
assert_not_production() {
  ref_file="$1/supabase/.temp/project-ref"
  if [ ! -f "$ref_file" ]; then
    echo "FATAL: $ref_file not found. Target is not linked. Aborting." >&2
    exit 1
  fi
  ref=$(cat "$ref_file")
  if [ "$ref" = "$PRODUCTION_REF" ]; then
    echo "FATAL: restore drill target ref ($ref) is PRODUCTION. Aborting immediately." >&2
    exit 1
  fi
  echo "OK: drill target ref ($ref) is not production."
}

# 接続文字列(db_url)からproject refを抽出する。
# 対応パターン: db.<ref>.supabase.co（直接接続）/ postgres.<ref>@ または postgres.<ref>:（pooler接続）
extract_ref_from_db_url() {
  db_url="$1"
  ref=$(printf '%s' "$db_url" | grep -oE 'db\.[a-z0-9]{20}\.supabase\.co' | sed -E 's/^db\.([a-z0-9]{20})\.supabase\.co$/\1/' | head -n1)
  if [ -z "$ref" ]; then
    ref=$(printf '%s' "$db_url" | grep -oE 'postgres\.[a-z0-9]{20}[@:]' | sed -E 's/^postgres\.([a-z0-9]{20})[@:]$/\1/' | head -n1)
  fi
  printf '%s' "$ref"
}

# 接続文字列(db_url)のrefがexpected_refと一致することを機械的に確認する。
# 解析不能・不一致のいずれでもFATAL（fail-closed）。db_url自体は出力しない。
assert_db_url_ref_equals() {
  db_url="$1"
  expected_ref="$2"
  label="$3"

  found_ref=$(extract_ref_from_db_url "$db_url")
  if [ -z "$found_ref" ]; then
    echo "FATAL: could not parse a project ref from the $label connection string. Aborting (fail-closed)." >&2
    exit 1
  fi
  if [ "$found_ref" != "$expected_ref" ]; then
    echo "FATAL: $label connection string ref ($found_ref) does not match expected ref ($expected_ref). Aborting." >&2
    exit 1
  fi
  echo "OK: $label connection string ref matches expected project ($expected_ref)."
}
```

### 4.2 方法A: ローカルSupabase（Docker必須、推奨）

`--local`フラグのみを使い、`--linked`は一切使わない。これにより構造的にproductionへ接続する経路がなく、接続文字列もローカルの既定値（production機密ではない）である。

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR_POINTER="/tmp/candidate-crm-prod-release/.backup-dir"
if [ ! -s "$BACKUP_DIR_POINTER" ]; then
  echo "FATAL: backup dir pointer file missing or empty. Run section 2 first." >&2
  exit 1
fi
BACKUP_DIR=$(cat "$BACKUP_DIR_POINTER")
case "$BACKUP_DIR" in
  "$HOME"/secure-backups/candidate-crm/*) ;;
  *)
    echo "FATAL: backup dir pointer does not resolve under \$HOME/secure-backups/candidate-crm/. Refusing to proceed." >&2
    exit 1
    ;;
esac
if [ ! -f "$BACKUP_DIR/.backup-db-ok" ] || [ ! -f "$BACKUP_DIR/.backup-storage-ok" ]; then
  echo "FATAL: backups are not confirmed OK. Run sections 2 and 3 first." >&2
  exit 1
fi
if [ ! -s "$BACKUP_DIR/pre-migration-column-grants.json" ]; then
  echo "FATAL: pre-migration column grant baseline is missing or empty." >&2
  exit 1
fi

DRILL_DIR="$HOME/secure-restore-drills/candidate-crm"
case "$DRILL_DIR" in
  "$HOME"/secure-restore-drills/candidate-crm) ;;
  *) echo "FATAL: unexpected drill directory. Aborting cleanup." >&2; exit 1 ;;
esac
rm -rf "$DRILL_DIR"
mkdir -p "$DRILL_DIR"
chmod 700 "$DRILL_DIR"
cd "$DRILL_DIR"
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 init --workdir "$DRILL_DIR"
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 start --workdir "$DRILL_DIR"

# ローカルDB接続文字列は `supabase status` から取得する（ローカルの既定パスワード・既定ポートであり、production機密ではない）。
LOCAL_DB_URL=$(SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 status --workdir "$DRILL_DIR" -o json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['DB_URL'])")

# production接続文字列を誤って渡せないよう、loopback上のCLI既定URLだけを許可する。
case "$LOCAL_DB_URL" in
  postgresql://postgres:postgres@127.0.0.1:*/*) ;;
  *) echo "FATAL: local DB URL is not the expected loopback URL." >&2; exit 1 ;;
esac

# CLI 2.111.0のローカル環境ではpostgresが非superuserのため、roles.sql内の
# ALTER ROLE/ALTER SYSTEM相当を復元できない。ローカル専用のsupabase_adminへ切り替える。
LOCAL_ADMIN_DB_URL=${LOCAL_DB_URL/postgres:postgres@/supabase_admin:postgres@}
if [ "$(psql "$LOCAL_ADMIN_DB_URL" -X -A -t -c 'select current_user')" != "supabase_admin" ]; then
  echo "FATAL: local restore connection is not supabase_admin." >&2
  exit 1
fi

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$BACKUP_DIR/roles.sql" \
  --file "$BACKUP_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$BACKUP_DIR/data.sql" \
  --dbname "$LOCAL_ADMIN_DB_URL"

# Storageの復元（--local のみ使用、--linked は使わない）
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 storage cp -r \
  "$BACKUP_DIR/crm-files" ss:///crm-files \
  --local --experimental --workdir "$DRILL_DIR"

# 4.4（検証）が使用する方式を記録する
printf 'local' > "$DRILL_DIR/.drill-method"
```

**Colima/QEMUでの既知の注意:** 通常の`supabase start`がStorageのhealth check待ちでタイムアウトした場合だけ、出力がhealth check timeoutであることを確認して`supabase start --ignore-health-check --workdir "$DRILL_DIR"`を再実行できます。これはエラーを無視して即復元する許可ではありません。再実行後に`supabase status`、上記`psql ... select current_user`、Storage CLIの応答を確認し、DBとStorageが利用可能になるまで復元処理へ進まないでください。`pgsodium_root.key: Is a directory`が出た場合は、drillが`/tmp`等のColima非共有パスに残っていないか確認し、環境を削除して本節の`$HOME`配下からやり直します。

### 4.3 方法B: 使い捨ての検証用Supabaseプロジェクト

production・staging以外に新規プロジェクトを作成し、そのrefへ`--linked`で接続する。**破壊的コマンドの直前に、CLIのlink状態（`assert_not_production`）と接続文字列そのもの（`assert_db_url_ref_equals`）の両方を確認する。**

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR_POINTER="/tmp/candidate-crm-prod-release/.backup-dir"
if [ ! -s "$BACKUP_DIR_POINTER" ]; then
  echo "FATAL: backup dir pointer file missing or empty. Run section 2 first." >&2
  exit 1
fi
BACKUP_DIR=$(cat "$BACKUP_DIR_POINTER")
case "$BACKUP_DIR" in
  "$HOME"/secure-backups/candidate-crm/*) ;;
  *)
    echo "FATAL: backup dir pointer does not resolve under \$HOME/secure-backups/candidate-crm/. Refusing to proceed." >&2
    exit 1
    ;;
esac
if [ ! -f "$BACKUP_DIR/.backup-db-ok" ] || [ ! -f "$BACKUP_DIR/.backup-storage-ok" ]; then
  echo "FATAL: backups are not confirmed OK. Run sections 2 and 3 first." >&2
  exit 1
fi

PRODUCTION_REF="dsaqarejqslzgcatkxeh"

# このスクリプトは別プロセスとして独立に実行されるため、4.1の関数をここで直接定義する。
assert_not_production() {
  ref_file="$1/supabase/.temp/project-ref"
  if [ ! -f "$ref_file" ]; then
    echo "FATAL: $ref_file not found. Target is not linked. Aborting." >&2
    exit 1
  fi
  ref=$(cat "$ref_file")
  if [ "$ref" = "$PRODUCTION_REF" ]; then
    echo "FATAL: restore drill target ref ($ref) is PRODUCTION. Aborting immediately." >&2
    exit 1
  fi
  echo "OK: drill target ref ($ref) is not production."
}

extract_ref_from_db_url() {
  db_url="$1"
  ref=$(printf '%s' "$db_url" | grep -oE 'db\.[a-z0-9]{20}\.supabase\.co' | sed -E 's/^db\.([a-z0-9]{20})\.supabase\.co$/\1/' | head -n1)
  if [ -z "$ref" ]; then
    ref=$(printf '%s' "$db_url" | grep -oE 'postgres\.[a-z0-9]{20}[@:]' | sed -E 's/^postgres\.([a-z0-9]{20})[@:]$/\1/' | head -n1)
  fi
  printf '%s' "$ref"
}

assert_db_url_ref_equals() {
  db_url="$1"
  expected_ref="$2"
  label="$3"

  found_ref=$(extract_ref_from_db_url "$db_url")
  if [ -z "$found_ref" ]; then
    echo "FATAL: could not parse a project ref from the $label connection string. Aborting (fail-closed)." >&2
    exit 1
  fi
  if [ "$found_ref" != "$expected_ref" ]; then
    echo "FATAL: $label connection string ref ($found_ref) does not match expected ref ($expected_ref). Aborting." >&2
    exit 1
  fi
  echo "OK: $label connection string ref matches expected project ($expected_ref)."
}

: "${DRILL_PROJECT_REF:?Set DRILL_PROJECT_REF to the verification project's ref}"
: "${DRILL_DB_URL:?Set DRILL_DB_URL to the verification project's connection string}"

DRILL_DIR="$HOME/secure-restore-drills/candidate-crm"
case "$DRILL_DIR" in
  "$HOME"/secure-restore-drills/candidate-crm) ;;
  *) echo "FATAL: unexpected drill directory. Aborting cleanup." >&2; exit 1 ;;
esac
rm -rf "$DRILL_DIR"
mkdir -p "$DRILL_DIR"
chmod 700 "$DRILL_DIR"
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 init --workdir "$DRILL_DIR"
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 link --project-ref "$DRILL_PROJECT_REF" --workdir "$DRILL_DIR"

assert_not_production "$DRILL_DIR"
assert_db_url_ref_equals "$DRILL_DB_URL" "$DRILL_PROJECT_REF" "drill"

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$BACKUP_DIR/roles.sql" \
  --file "$BACKUP_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$BACKUP_DIR/data.sql" \
  --dbname "$DRILL_DB_URL"

assert_not_production "$DRILL_DIR"
assert_db_url_ref_equals "$DRILL_DB_URL" "$DRILL_PROJECT_REF" "drill"

SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 storage cp -r \
  "$BACKUP_DIR/crm-files" ss:///crm-files \
  --linked --experimental --workdir "$DRILL_DIR"

# 4.4（検証）が使用する方式を記録する
printf 'remote' > "$DRILL_DIR/.drill-method"
printf '%s' "$DRILL_PROJECT_REF" > "$DRILL_DIR/.drill-project-ref"
chmod 600 "$DRILL_DIR/.drill-project-ref"
```

作業完了後、この使い捨てプロジェクトは削除する。

### 4.4 検証（データの整合性をチェックサムで確認する）

4.2・4.3が`.drill-method`ファイルへ書き残した方式（`local`または`remote`）を読み込み、それに応じて`--local`/`--linked`を自動的に選択する。**コメントを読んで手作業でフラグを置き換える必要はない。** 未知の値の場合はFATALで停止する。

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR_POINTER="/tmp/candidate-crm-prod-release/.backup-dir"
if [ ! -s "$BACKUP_DIR_POINTER" ]; then
  echo "FATAL: backup dir pointer file missing or empty. Run section 2 first." >&2
  exit 1
fi
BACKUP_DIR=$(cat "$BACKUP_DIR_POINTER")
case "$BACKUP_DIR" in
  "$HOME"/secure-backups/candidate-crm/*) ;;
  *)
    echo "FATAL: backup dir pointer does not resolve under \$HOME/secure-backups/candidate-crm/. Refusing to proceed." >&2
    exit 1
    ;;
esac
if [ ! -d "$BACKUP_DIR" ]; then
  echo "FATAL: backup directory referenced by pointer does not exist." >&2
  exit 1
fi
if [ ! -f "$BACKUP_DIR/.backup-db-ok" ] || [ ! -f "$BACKUP_DIR/.backup-storage-ok" ]; then
  echo "FATAL: backups are not confirmed OK. Run sections 2 and 3 first." >&2
  exit 1
fi
if [ ! -s "$BACKUP_DIR/pre-migration-column-grants.json" ]; then
  echo "FATAL: pre-migration column grant baseline is missing or empty." >&2
  exit 1
fi

DRILL_DIR="$HOME/secure-restore-drills/candidate-crm"

DRILL_METHOD=$(cat "$DRILL_DIR/.drill-method" 2>/dev/null || true)
case "$DRILL_METHOD" in
  local)
    DRILL_TARGET_FLAG="--local"
    ;;
  remote)
    DRILL_TARGET_FLAG="--linked"

    # remoteの場合は、4.3実行後にlink先が変わっていないかを追加で検証する。
    # .drill-project-refが欠落・空・不一致、またはproduction refと一致する場合はFATAL。
    DRILL_PROJECT_REF_FILE="$DRILL_DIR/.drill-project-ref"
    if [ ! -s "$DRILL_PROJECT_REF_FILE" ]; then
      echo "FATAL: .drill-project-ref missing or empty. Cannot safely verify drill target. Aborting." >&2
      exit 1
    fi
    DRILL_PROJECT_REF=$(cat "$DRILL_PROJECT_REF_FILE")

    LINKED_REF_FILE="$DRILL_DIR/supabase/.temp/project-ref"
    if [ ! -f "$LINKED_REF_FILE" ]; then
      echo "FATAL: $LINKED_REF_FILE not found. Drill directory is not linked. Aborting." >&2
      exit 1
    fi
    LINKED_REF=$(cat "$LINKED_REF_FILE")

    if [ "$LINKED_REF" != "$DRILL_PROJECT_REF" ]; then
      echo "FATAL: linked ref ($LINKED_REF) does not match the ref recorded in 4.3 ($DRILL_PROJECT_REF). The link may have changed since then. Aborting." >&2
      exit 1
    fi

    PRODUCTION_REF="dsaqarejqslzgcatkxeh"
    if [ "$LINKED_REF" = "$PRODUCTION_REF" ]; then
      echo "FATAL: linked ref is PRODUCTION. Aborting immediately before any query/copy." >&2
      exit 1
    fi
    echo "OK: drill project ref confirmed consistent and not production ($LINKED_REF)."
    ;;
  *)
    echo "FATAL: unknown or missing drill method ('$DRILL_METHOD'). Expected 'local' or 'remote'. Run 4.2 or 4.3 first." >&2
    exit 1
    ;;
esac

# 列権限の検証。restore drillはmigration適用前バックアップの検証なので、
# 6.3節の「適用後期待値」ではなく2節で保存した適用前基準値と比較する。
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db query --workdir "$DRILL_DIR" "$DRILL_TARGET_FLAG" "
select table_name, column_name
from information_schema.role_column_grants
where table_schema = 'public' and table_name in ('email_threads', 'files')
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by table_name, column_name;
" > "$DRILL_DIR/restored-column-grants.json"

if ! diff "$BACKUP_DIR/pre-migration-column-grants.json" "$DRILL_DIR/restored-column-grants.json" > /dev/null; then
  echo "FATAL: restored column grants do not match the pre-migration backup baseline." >&2
  exit 1
fi

# Storage実体の整合性をチェックサムで確認する
mkdir -p "$DRILL_DIR/restored-crm-files"
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 storage cp -r \
  ss:///crm-files "$DRILL_DIR/restored-crm-files" \
  "$DRILL_TARGET_FLAG" --experimental --workdir "$DRILL_DIR"

python3 - "$DRILL_DIR/restored-crm-files" "$DRILL_DIR/restored-crm-files.sha256" <<'PY'
import hashlib
from pathlib import Path
import sys

root = Path(sys.argv[1])
output = Path(sys.argv[2])
lines = []
for path in sorted(item for item in root.rglob("*") if item.is_file()):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    lines.append(f"{digest}  {path.relative_to(root).as_posix()}")
output.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
PY

if ! diff "$BACKUP_DIR/crm-files.sha256" "$DRILL_DIR/restored-crm-files.sha256" > /dev/null; then
  echo "FATAL: checksum mismatch between backup and restored files." >&2
  exit 1
fi

# storage.objects メタデータ（件数・合計サイズ）の整合性確認
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db query --workdir "$DRILL_DIR" "$DRILL_TARGET_FLAG" \
  "select count(*) as object_count, coalesce(sum((metadata->>'size')::bigint), 0) as total_bytes from storage.objects where bucket_id = 'crm-files';" \
  > "$DRILL_DIR/restored-crm-files-metadata.json"
if ! diff "$BACKUP_DIR/crm-files-metadata-baseline.json" "$DRILL_DIR/restored-crm-files-metadata.json" > /dev/null; then
  echo "FATAL: storage.objects metadata mismatch between backup and restored environment." >&2
  exit 1
fi

echo "OK: pre-migration column grants, file checksums, and storage.objects metadata all match."
touch "$BACKUP_DIR/.restore-drill-ok"
echo "OK: restore drill fully verified. Migration application may proceed."
```

- チェックサム一覧・メタデータJSONは`$BACKUP_DIR`・`$DRILL_DIR`内だけに保存し、**チャット・CIログ・Gitへ出力しない。**
- 検証が終わったら、drill用ディレクトリ・ローカルSupabaseインスタンス（`supabase stop --workdir "$DRILL_DIR"`）・使い捨てプロジェクト（方法Bの場合）を削除する。

**チェック欄**

| 項目                                                                                                                                                                      | 実施者 | 確認者 | 日時 | 結果 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---- | ---- |
| drill用ディレクトリがバックアップ用ディレクトリと別であることを確認した                                                                                                   |        |        |      |      |
| （方法Bの場合）`assert_not_production`と`assert_db_url_ref_equals`が全ての破壊的操作の直前で実行され、CLIのlink先・接続文字列の両方が非production環境であることを確認した |        |        |      |      |
| DB・Storageとも同一検証環境へ復元した                                                                                                                                     |        |        |      |      |
| 4.4で`BACKUP_DIR`のポインタ検証・`.backup-db-ok`/`.backup-storage-ok`確認が成功した                                                                                       |        |        |      |      |
| （方法Bの場合）4.4で`.drill-project-ref`と実際のlink先が一致し、かつproduction refでないことを再確認した                                                                  |        |        |      |      |
| `.drill-method`から方式を自動判定し、復元先の列権限が適用前基準値と一致した                                                                                               |        |        |      |      |
| Storageチェックサム・`storage.objects`メタデータの一致確認、`.restore-drill-ok`作成                                                                                       |        |        |      |      |
| drill環境の後片付け（ローカル停止 or 使い捨てプロジェクト削除）                                                                                                           |        |        |      |      |

## 5. 適用対象migrationの確認

以下2件は2026-08-10にproductionへ適用済みです。**同じmigrationを再適用する手順ではありません。** この一覧はStage 1の実施記録として残します。

```
20260808003737_restrict_email_thread_update_columns.sql
20260808043603_restrict_files_update_columns.sql
```

今後のリリースでは、適用前に必ず未適用対象を動的に再確認する。

```sh
cd /tmp/candidate-crm-prod-release
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 migration list --linked
```

- 2026-08-10のStage 1完了後は、`remote`列に上記2件が含まれていることを確認する。
- 新しいリリースでは、ローカルだけに存在するmigrationを一覧化し、承認済み対象以外が1件でもあれば中止する。

## 6. migration適用（fail-fastゲート → dry-run → 適用）

### 6.1 fail-fastゲート（機械的な前提条件チェック）

**2節・3節・4節のいずれかが未完了・未成功の場合、この先へ進んではいけません。** `BACKUP_DIR`をポインタファイルから読み込み、3つのマーカーが揃っていることを確認する。

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR_POINTER="/tmp/candidate-crm-prod-release/.backup-dir"
if [ ! -s "$BACKUP_DIR_POINTER" ]; then
  echo "FATAL: backup dir pointer file missing or empty. Run section 2 first." >&2
  exit 1
fi
BACKUP_DIR=$(cat "$BACKUP_DIR_POINTER")
case "$BACKUP_DIR" in
  "$HOME"/secure-backups/candidate-crm/*) ;;
  *)
    echo "FATAL: backup dir pointer does not resolve under \$HOME/secure-backups/candidate-crm/. Refusing to proceed." >&2
    exit 1
    ;;
esac
if [ ! -d "$BACKUP_DIR" ]; then
  echo "FATAL: backup directory referenced by pointer does not exist." >&2
  exit 1
fi

for marker in .backup-db-ok .backup-storage-ok .restore-drill-ok; do
  if [ ! -f "$BACKUP_DIR/$marker" ]; then
    echo "FATAL: $marker not found. Backup and/or restore drill are not verified." >&2
    echo "Migration must NOT be applied. Stage 1 is No-Go until this is resolved." >&2
    exit 1
  fi
done
echo "OK: all pre-conditions (backup DB, backup storage, restore drill) are verified."
```

### 6.2 dry-run → 適用

**必ずdry-runを先に実行し、対象ファイル名を目視確認してから適用する。** 1名で実施する場合は「1.1 1名で実施する場合の代替確認」の二段階確認を必ず行う。

```sh
cd /tmp/candidate-crm-prod-release

# 1) dry-run（結果をファイルへ保存する。1.1の二段階確認と合わせて使う）
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db push --linked --dry-run \
  > /tmp/candidate-crm-prod-release/dry-run-result.txt
cat /tmp/candidate-crm-prod-release/dry-run-result.txt
# "Would push these migrations:" に
#   20260808003737_restrict_email_thread_update_columns.sql
#   20260808043603_restrict_files_update_columns.sql
# の2件だけが表示されることを確認する。他のファイル名が出た場合は中止する。

# 2) 適用
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db push --linked
```

適用後、`migration list --linked`を再実行し、`remote`列に2件とも追加されたことを確認する。

### 6.3 適用後の期待結果（技術的検証）

```sh
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db query --linked --workdir /tmp/candidate-crm-prod-release "
select column_name
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'email_threads'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
"
# 期待値: archived_at, status の2列のみ

SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db query --linked --workdir /tmp/candidate-crm-prod-release "
select column_name
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'files'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
"
# 期待値: archived_at の1列のみ
```

これらのSELECT文はスキーマ・権限のメタデータのみを参照し、候補者・企業・求人などの業務データには一切アクセスしない。

**この2件のmigrationは、`GRANT`/`REVOKE UPDATE (列名)`のみを変更するものであり、テーブル定義の変更（列の追加・削除等）や既存データへの`UPDATE`/`DELETE`は一切含みません。** 実行内容は次の4行のみです（`supabase/migrations/20260808003737_...sql`、`supabase/migrations/20260808043603_...sql`）。

```sql
revoke update on table public.email_threads from authenticated;
grant update (status, archived_at) on table public.email_threads to authenticated;

revoke update on table public.files from authenticated;
grant update (archived_at) on table public.files to authenticated;
```

このため、業務データが破損・変化するリスクは構造的にありません。万一適用後に問題が起きた場合も、「16. ロールバック方針」に記載の通り、原則としてforward migrationで対応できます。

**チェック欄**

| 項目                                                       | 実施者 | 確認者 | 日時 |
| ---------------------------------------------------------- | ------ | ------ | ---- |
| fail-fastゲート（6.1）が`OK`を出力した                     |        |        |      |
| dry-run結果が対象2件のみと確認（保存済みファイルで再確認） |        |        |      |
| migration適用                                              |        |        |      |
| 適用後の列権限検証（6.3の2クエリ）                         |        |        |      |

## 7. Edge Functionsの確認・deploy

2026-08-09時点の読み取り調査で、production・staging・Stage 1対象コミットの4関数（`generate-candidate-summary`、`extract-job-posting`、`get-ai-usage`、`invite-user`）は、`index.ts`・`deno.json`の内容が3者間で完全一致していることを確認済みです（`functions download`で取得し`diff`で比較）。したがって**Stage 1でEdge Functionsの再deployは不要でした**。

念のため再確認・再deployする場合の手順は以下の通りです（本Runbook作成時点では実施していません）。

```sh
cd /tmp/candidate-crm-prod-release
# 現在のproduction版をダウンロードして目視差分確認
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 functions download <function-name> \
  --project-ref dsaqarejqslzgcatkxeh --workdir /tmp/candidate-crm-prod-release
diff /tmp/candidate-crm-prod-release/supabase/functions/<function-name>/index.ts \
     /path/to/candidate-crm/supabase/functions/<function-name>/index.ts

# 差分がある場合のみ、対象関数だけを明示してdeployする（`--prune`は使わない。誤って無関係な関数を削除しないため）
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 functions deploy <function-name> \
  --project-ref dsaqarejqslzgcatkxeh --workdir /tmp/candidate-crm-prod-release
```

deploy後は`verify_jwt`が`true`のままであることを、Dashboard（Edge Functions → 対象関数 → Settings）または`functions list`のJSON出力で確認する。

**チェック欄**

| 項目                                                      | 実施者 | 確認者 | 日時 |
| --------------------------------------------------------- | ------ | ------ | ---- |
| 4関数のソース差分確認（差分なしを確認、またはdeploy実施） |        |        |      |

## 8. Secrets設定項目名の確認

`OPENAI_API_KEY`はproductionに既に設定済みであることを確認済みです（2026-08-09、名前のみ確認、値は未参照）。

```sh
SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 secrets list --project-ref dsaqarejqslzgcatkxeh -o json
```

出力の`name`列だけを確認し、`value`（digestハッシュ）は記録・共有しない。確認すべき項目名:

- `OPENAI_API_KEY`（レビュー済みモデルIDはEdge Function内コードに固定。`OPENAI_MODEL` Secretは作らない）
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` 等（Supabaseが自動提供、手動設定不要）

**チェック欄**

| 項目                                   | 実施者 | 確認者 | 日時 |
| -------------------------------------- | ------ | ------ | ---- |
| `OPENAI_API_KEY`の存在確認（名前のみ） |        |        |      |

## 9. Auth・Storage設定の確認

CLIに読み取り専用コマンドが存在しないため（`supabase config`は`push`のみ）、Dashboardで目視確認する。**設定変更はこのRunbookの対象作業者が事前に承認したものだけ行う。**

Dashboard: `https://supabase.com/dashboard/project/dsaqarejqslzgcatkxeh/auth/url-configuration`

確認項目:

- Site URL
- Redirect URLs（`candidate-crm://auth/callback`が含まれているか）
- `enable_signup`（自己登録を許可しない設定になっているか）
- JWT expiry

Storage（`crm-files`バケット）はSQLで読み取り確認済み（`public=false`、10MB上限、許可MIMEタイプはstagingと一致）。Storage Policyも本番稼働開始前にDashboardの Storage → Policies で目視確認することを推奨する。

**チェック欄**

| 項目                                          | 実施者 | 確認者 | 日時 |
| --------------------------------------------- | ------ | ------ | ---- |
| Site URL / Redirect URLs / enable_signup 確認 |        |        |      |

## 10. 管理者bootstrap（該当する場合のみ）

production側に既にadminロールの利用者が存在するかどうかは、本Runbook作成時点では確認していません（productionデータを読み出さない方針のため未実施）。

- production Auth Users画面（`https://supabase.com/dashboard/project/dsaqarejqslzgcatkxeh/auth/users`）で、既存のadminユーザーが存在するか確認する。
- **既にadminが存在する場合、このステップは不要。スキップする。**
- **admin が1人も存在しない場合のみ**、staging作業時と同じ手順で、実在するチームメンバー本人のメールアドレスを使って最初のadminをbootstrapする。架空アドレスは使わない。

  1. Dashboardで対象の実在メールアドレスのユーザーを作成する（またはアプリの通常のサインアップ経路を使う）。
  2. `auth.users`と`public.profiles`をread-onlyでSELECTし、対象が1件だけであることを確認する。

     ```sh
     SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 db query --linked --workdir /tmp/candidate-crm-prod-release "
     select id, email from auth.users where email = '<確認済みメールアドレス>';
     "
     ```

  3. `where id = <確認済みauth.users.id> and role = 'pending'`で対象を限定し、`returning id, email, role`で1件だけ更新されたことを確認しながら`admin`へ変更する。
  4. 以後の追加ユーザーは、アプリの「ユーザー招待」機能（`invite-user` Edge Function経由）を使う。直接SQLでのrole変更は行わない。

**チェック欄**

| 項目                          | 実施者 | 確認者 | 日時 |
| ----------------------------- | ------ | ------ | ---- |
| 既存admin有無の確認           |        |        |      |
| （該当する場合）bootstrap実施 |        |        |      |

### 10.1 利用者を停止する場合

`suspended`へのロール変更はRLSによってCRM業務データを直ちに遮断しますが、Supabase Authのセッションやrefresh token自体を失効させる操作ではありません。退職者・契約終了者など、継続ログインも止める必要がある利用者には次の両方を実施してください。

1. Candidate CRMの管理者画面から対象利用者を`停止済み`へ変更する。ロールは`set_profile_role` RPC経由で変更し、`profiles`を直接UPDATEしない。
2. Supabase DashboardのAuth Usersで対象者を確認し、Auth管理者機能によるbanまたはセッション失効を実施する。対象メールアドレスとユーザーIDを照合し、別利用者を停止しない。

`pending`は初回承認待ち専用です。承認済み利用者を一時停止・再承認待ちに戻す目的では使用せず、停止には`suspended`を使用します。将来、停止操作とAuthセッション失効を一体化する管理機能はBatch 4以降で設計します。

**チェック欄**

| 項目                                            | 実施者 | 確認者 | 日時 |
| ----------------------------------------------- | ------ | ------ | ---- |
| 対象利用者を`停止済み`へ変更                    |        |        |      |
| 対象IDを照合しAuthセッション失効またはbanを実施 |        |        |      |

## 11. アプリのproduction build

production向けには、用途が異なる次の工程を分離する。

- `.github/workflows/production-internal-artifacts.yml`: productionへ接続する**未署名の社内検証用**成果物。一般配布禁止。
- 将来構築する正式リリースworkflow: Developer ID／Windowsコード署名を行う一般配布用成果物。

既存の`.github/workflows/desktop-artifacts.yml`（Desktop QA artifacts）はstaging専用であり、production向けには使用しない。

選択肢は3つある。判断は本番移行の責任者が行う。

### 選択肢A: 内部スモークテスト用のローカルビルド（署名なし、限定配布不可）

**開発用のメインリポジトリ（`.env.local`）は絶対に上書きしないでください。** 代わりに、承認済みリリースコミットだけをチェックアウトした、独立した`git worktree`を作成してビルドします。これによりメイン開発リポジトリの作業状態（staging向け`.env.local`を含む）に一切影響しません。**依存関係は`npm ci`で`package-lock.json`通りに再現可能な状態でインストールします（`npm install`は使いません）。**

```bash
#!/usr/bin/env bash
set -euo pipefail

# メイン開発リポジトリの中で実行
cd /path/to/candidate-crm
git fetch origin
WORKTREE_DIR=/tmp/candidate-crm-rc1-build
RELEASE_COMMIT="${RELEASE_COMMIT:?Set RELEASE_COMMIT to the approved immutable commit hash}"
git cat-file -e "$RELEASE_COMMIT^{commit}"
git worktree add --detach "$WORKTREE_DIR" "$RELEASE_COMMIT"

cd "$WORKTREE_DIR"
# このディレクトリは新規のworktreeなので、ここへ.env.localを作成してもメインリポジトリへは影響しない
cat > .env.local << 'EOF'
VITE_APP_ENV=production
VITE_SUPABASE_URL=https://dsaqarejqslzgcatkxeh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<productionのpublishable key>
EOF

npm ci
npm run tauri build
```

- `VITE_SUPABASE_PUBLISHABLE_KEY`は**publishable key（公開前提のキー）だけ**を使う。Dashboardの API Keys画面から取得できる。**service role keyは絶対に使わない。**
- ビルド後、`dist/`または`src-tauri/target/release/bundle`配下にproduction refのみが含まれ、staging refが混入していないことを確認する（12節参照）。
- **このビルドは一般配布せず、動作確認を行う担当者のマシンだけで使う。**

確認完了後、生成物・秘密情報を含みうるファイルを消してからworktreeを削除する。**削除対象パスは固定・検証してから実行し、`$WORKTREE_DIR`以外の広いディレクトリを消さない。** `node_modules`も削除してから`worktree remove`する（`npm ci`で作られた大量のファイルが残っていると`git worktree remove`が失敗する場合があるため）。

```bash
#!/usr/bin/env bash
set -euo pipefail

WORKTREE_DIR=/tmp/candidate-crm-rc1-build

# 削除対象が想定通りの固定パスであることを確認してから削除する
case "$WORKTREE_DIR" in
  /tmp/candidate-crm-rc1-build) ;;
  *)
    echo "FATAL: unexpected WORKTREE_DIR ($WORKTREE_DIR). Refusing to delete." >&2
    exit 1
    ;;
esac

rm -f "$WORKTREE_DIR/.env.local"
rm -rf "$WORKTREE_DIR/dist"
rm -rf "$WORKTREE_DIR/src-tauri/target"
rm -rf "$WORKTREE_DIR/node_modules"

cd /path/to/candidate-crm
git worktree remove "$WORKTREE_DIR"
```

### 選択肢B: GitHub Actionsによる社内検証用ビルド（署名なし、一般配布禁止）

`.github/workflows/production-internal-artifacts.yml`を手動実行する。このworkflowは次の条件をすべて満たさない限り停止する。

- `release_commit`へ承認済みcommitの40桁SHAを入力する（branch名や短縮SHAは不可）。
- `confirmation`へ`BUILD_PRODUCTION_INTERNAL`を正確に入力する。
- GitHub Environment `production-internal-build`に、次のEnvironment secretsを登録する。
  - `PROD_VITE_SUPABASE_URL`: productionのSupabase URL
  - `PROD_VITE_SUPABASE_PUBLISHABLE_KEY`: productionのpublishable key
- URLのproject refがproduction（`dsaqarejqslzgcatkxeh`）と完全一致し、staging ref（`admjgbfrfoczpxdtxmgy`）を含まない。
- ビルド後の`dist/`にproduction refが存在し、staging refが存在しない。

このworkflowはmacOSとWindowsを別々にビルドし、成果物名に`production-internal`と`unsigned`を含め、保持期間を3日間に限定する。秘密情報の値はログ出力しない。使用するキーは公開前提のpublishable keyだけであり、service role keyは登録しない。

成果物は、productionへ接続する社内検証版である。承認済みの社内利用者だけが使用し、外部顧客へ転送・一般配布しない。WindowsではSmartScreen、macOSではGatekeeperの警告が表示される場合がある。

### 選択肢C: 正式な署名済みリリースパイプラインの新規構築

一般配布可能な成果物を作るには、以下が必要（すべて本Runbookの範囲外、別途承認・予算が必要）。

- macOS: Apple Developer Program登録（年額）、Developer ID証明書、Notarization
- Windows: コード署名証明書（EV推奨）
- 選択肢Bとは別の、署名資格情報を扱う保護された正式リリースworkflow

**チェック欄**

| 項目                                                                                             | 実施者 | 確認者 | 日時 |
| ------------------------------------------------------------------------------------------------ | ------ | ------ | ---- |
| ビルド方式の選択（A/B/C）                                                                        |        |        |      |
| （選択肢Aの場合）`npm ci`でのビルド実施                                                          |        |        |      |
| （選択肢Aの場合）固定パス確認の上で`.env.local`・生成物・`node_modules`を削除し`worktree remove` |        |        |      |
| （選択肢Bの場合）Environment secrets、40桁SHA、確認文字列を設定してworkflowを実行                |        |        |      |
| （選択肢Bの場合）成果物名・manifest・production接続先・staging ref不在を確認                     |        |        |      |

## 12. macOS／Windows成果物の検証

- ビルド成果物（`dist/`、`src-tauri/target/*/bundle`配下）に**production refのみ**含まれ、staging ref（`admjgbfrfoczpxdtxmgy`）が混入していないことを確認する。

  ```sh
  grep -rl "dsaqarejqslzgcatkxeh" dist/ 2>/dev/null   # 出るべき
  grep -rl "admjgbfrfoczpxdtxmgy" dist/ 2>/dev/null   # 出てはいけない
  ```

- macOS: アプリを起動し、ログイン画面が表示されること、既存の実在admin（または手順10でbootstrapしたadmin）でログインできることを確認する。
- Windows実機での確認は別途「13. 本番スモークテスト」と合わせて実施する（Windows実機が必要）。

## 13. 本番スモークテスト

**実在する候補者・企業・求人データは入力しない。** 動作確認は既存データの閲覧、またはテスト後に確実に削除できる最小限の操作に限定する。

- ログイン・ログアウト・アプリ再起動後のセッション復元
- ホーム画面が正常に表示される（エラー画面にならない）
- 求人票AIサマリー機能を1回だけ実行し、Edge Function呼び出しが成功することを確認する（実在しない架空求人票を使う。`docs/fixtures/job-import-sample.txt`を利用可能）
- 監査ログ（adminユーザーでのみ閲覧可能）に、直前の操作が記録されていることを確認する

**チェック欄**

| 項目                       | 実施者 | 確認者 | 日時 | 結果 |
| -------------------------- | ------ | ------ | ---- | ---- |
| ログイン/ログアウト/再起動 |        |        |      |      |
| ホーム画面表示             |        |        |      |      |
| AI機能疎通（架空データ）   |        |        |      |      |
| 監査ログ記録確認           |        |        |      |      |

## 14. リストア手順（緊急時のみ、production対象）

**この手順は、migration適用そのもの（6節、列権限のみの変更）が原因で必要になることは想定していません。** 想定する発動条件は、想定外の重大な障害・データ破損が発生した場合の最終手段としてのみです。日常的な不具合は「16. ロールバック方針」の通りforward migrationで対応してください。

restore drillの手順（4節）と同じ構造ですが、対象がproduction自体になります。**このセクションのコマンドは、実際にproductionが復旧不能な状態にある場合にのみ実行してください。** 14.1のスクリプトは、必要な関数（`extract_ref_from_db_url`・`assert_db_url_ref_equals`）を自身の中に直接含んでいます。

### 14.1 データベースの復元

Vaultや列暗号化を使用していない場合の公式手順（本プロジェクトではVault等の使用は確認していません）。**接続文字列自体がproductionのものであることを、psql実行の直前に機械的に確認してから使う。**

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR_POINTER="/tmp/candidate-crm-prod-release/.backup-dir"
if [ ! -s "$BACKUP_DIR_POINTER" ]; then
  echo "FATAL: backup dir pointer file missing or empty. Run section 2 first." >&2
  exit 1
fi
BACKUP_DIR=$(cat "$BACKUP_DIR_POINTER")
case "$BACKUP_DIR" in
  "$HOME"/secure-backups/candidate-crm/*) ;;
  *)
    echo "FATAL: backup dir pointer does not resolve under \$HOME/secure-backups/candidate-crm/. Refusing to proceed." >&2
    exit 1
    ;;
esac
if [ ! -d "$BACKUP_DIR" ]; then
  echo "FATAL: backup directory referenced by pointer does not exist." >&2
  exit 1
fi
for f in roles.sql schema.sql data.sql; do
  if [ ! -s "$BACKUP_DIR/$f" ]; then
    echo "FATAL: $f is missing or empty in the backup directory. Cannot restore." >&2
    exit 1
  fi
done

PRODUCTION_REF="dsaqarejqslzgcatkxeh"
: "${PRODUCTION_DB_URL:?Set PRODUCTION_DB_URL to the production connection string before running this script}"

# このスクリプトは別プロセスとして独立に実行されるため、必要な関数をここで直接定義する。
extract_ref_from_db_url() {
  db_url="$1"
  ref=$(printf '%s' "$db_url" | grep -oE 'db\.[a-z0-9]{20}\.supabase\.co' | sed -E 's/^db\.([a-z0-9]{20})\.supabase\.co$/\1/' | head -n1)
  if [ -z "$ref" ]; then
    ref=$(printf '%s' "$db_url" | grep -oE 'postgres\.[a-z0-9]{20}[@:]' | sed -E 's/^postgres\.([a-z0-9]{20})[@:]$/\1/' | head -n1)
  fi
  printf '%s' "$ref"
}

assert_db_url_ref_equals() {
  db_url="$1"
  expected_ref="$2"
  label="$3"

  found_ref=$(extract_ref_from_db_url "$db_url")
  if [ -z "$found_ref" ]; then
    echo "FATAL: could not parse a project ref from the $label connection string. Aborting (fail-closed)." >&2
    exit 1
  fi
  if [ "$found_ref" != "$expected_ref" ]; then
    echo "FATAL: $label connection string ref ($found_ref) does not match expected ref ($expected_ref). Aborting." >&2
    exit 1
  fi
  echo "OK: $label connection string ref matches expected project ($expected_ref)."
}

assert_db_url_ref_equals "$PRODUCTION_DB_URL" "$PRODUCTION_REF" "production"

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$BACKUP_DIR/roles.sql" \
  --file "$BACKUP_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$BACKUP_DIR/data.sql" \
  --dbname "$PRODUCTION_DB_URL"
```

- `$PRODUCTION_DB_URL`は、Dashboard（Project Settings → Database → Connection string）から**復元作業を行う担当者本人が直接取得し、この手順書やチャット、ログへ貼り付けない。** `assert_db_url_ref_equals`の出力にも接続文字列そのものは含まれない（refのみ）。
- roles → schema → dataの順で、単一トランザクション（`--single-transaction`）かつ`ON_ERROR_STOP=1`（エラー時即停止）で実行する。
- `SET session_replication_role = replica`により、データ投入中はトリガーを無効化する（重複処理や二重処理を防ぐため）。

### 14.2 Storageの復元

データベース復元後（`storage.buckets`/`storage.objects`のメタデータが復元された後）、ファイル実体を復元する。**Storage復元の直前にも、CLIのlink状態が改めてproductionであることを再確認する。**

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR_POINTER="/tmp/candidate-crm-prod-release/.backup-dir"
if [ ! -s "$BACKUP_DIR_POINTER" ]; then
  echo "FATAL: backup dir pointer file missing or empty. Run section 2 first." >&2
  exit 1
fi
BACKUP_DIR=$(cat "$BACKUP_DIR_POINTER")
case "$BACKUP_DIR" in
  "$HOME"/secure-backups/candidate-crm/*) ;;
  *)
    echo "FATAL: backup dir pointer does not resolve under \$HOME/secure-backups/candidate-crm/. Refusing to proceed." >&2
    exit 1
    ;;
esac
if [ ! -d "$BACKUP_DIR/crm-files" ] || [ ! -s "$BACKUP_DIR/crm-files.sha256" ]; then
  echo "FATAL: crm-files backup directory or checksum manifest is missing. Cannot restore Storage." >&2
  exit 1
fi

PRODUCTION_REF="dsaqarejqslzgcatkxeh"
LINKED_REF=$(cat /tmp/candidate-crm-prod-release/supabase/.temp/project-ref)
if [ "$LINKED_REF" != "$PRODUCTION_REF" ]; then
  echo "FATAL: linked ref ($LINKED_REF) is not production. Aborting before Storage restore." >&2
  exit 1
fi

SUPABASE_TELEMETRY_DISABLED=1 npx -y supabase@2.111.0 storage cp -r \
  "$BACKUP_DIR/crm-files" ss:///crm-files \
  --linked --experimental --workdir /tmp/candidate-crm-prod-release
```

復元後、`storage ls -r`で件数を再確認し、可能であれば4.4と同様にチェックサムでも整合性を確認する。

**チェック欄**

| 項目                                                                                                                | 実施者 | 確認者 | 日時 | 結果 |
| ------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---- | ---- |
| 14.1で`BACKUP_DIR`のポインタ検証、roles.sql/schema.sql/data.sqlの非ゼロサイズを確認した                             |        |        |      |      |
| `assert_db_url_ref_equals`で接続文字列がproductionと一致することを確認してからデータベース復元（roles→schema→data） |        |        |      |      |
| 14.2で`BACKUP_DIR`のポインタ検証、crm-filesディレクトリ・crm-files.sha256の存在を確認した                           |        |        |      |      |
| Storage復元前にCLI link先のproduction再確認、`--workdir`明示、復元後の件数/チェックサム確認                         |        |        |      |      |

## 15. 失敗時の中止条件

以下のいずれかに該当した場合、直ちに作業を中止し、後述のロールバック方針に従う。

- 「1. 誤接続防止チェック」でrefが一致しない、または確認者が同席していない（1名の場合は1.1の二段階確認を完了していない）
- バックアップ（2節・3節）のいずれかのファイルが取得できない、またはサイズが0
- restore drill（4節）が失敗した、`assert_not_production`/`assert_db_url_ref_equals`がFATALで停止した、またはチェックサムが一致しない
- 「6.1 fail-fastゲート」が`FATAL`で停止した
- dry-runの対象migrationファイルが想定と異なる
- migration適用中にエラーが発生した
- 適用後の列権限検証（6.3節）が期待値と異なる
- Edge Functionのソース差分確認で想定外の差分が見つかり、原因が特定できない
- スモークテストでログイン不可、ホーム画面がエラーになる、AI機能が疎通しない等の重大な不具合が発生した
- 予期しないデータ変化（実施していない操作の反映など）に気づいた

## 16. ロールバック方針

- **今回の2migration（`20260808003737`、`20260808043603`）は、`email_threads`・`files`テーブルの列単位UPDATE権限（`GRANT`/`REVOKE`）のみを変更します。テーブル構造や既存の業務データ（候補者・企業・求人・ファイル等）は一切変更しません。** そのため、この2件の適用自体が業務データを破損させることは構造的にありません。
- **通常の不具合対応**: 適用済みmigrationを書き換えず、問題を打ち消す新しいforward migrationを作成し、同じdry-run→適用の手順で対応する。
- **DB全体のリストア（14節）は、データ破損など、forward migrationでは対応できない重大な障害が発生した場合の最終手段としてのみ使用する。** 今回の2migrationの内容そのものが原因でこの手段が必要になることは想定していない。
- **Edge Functions**: 直前のバージョンのソースを`functions download`で取得済みであれば、そのソースで`functions deploy`し直すことで戻せる。取得していなかった場合は、Gitの当該コミット以前のバージョンからdeployし直す。
- **Secrets**: 今回のリリースでSecretsの変更は想定していない（`OPENAI_API_KEY`は設定済み）。変更した場合は変更前の値を安全な方法で退避してから変更する。
- **アプリ配布**: 選択肢A（内部ローカルビルド、worktree）を使った場合、そのビルドは配布していないため配布物のロールバックは不要。選択肢Bで一般配布した場合は、直前の署名済みバージョンへの案内・再配布が必要。

## 17. 完了報告

全チェック欄の記入が完了し、15節の中止条件に該当しなかったことを確認したら、実施者は本Runbookのコピー（チェック欄含む）をリリース記録として保管する。バックアップファイル・restore drillの検証結果ファイルの保管場所・削除予定日もあわせて記録する（ファイル名やパスそのものは、この記録を共有する相手を限定した上で管理する）。

---

作成時点の情報源: `supabase --version`（2.111.0）実行結果、`--help`出力、およびstaging環境での実行結果によるコマンド検証（`storage`系の`--experimental`要件を含む）。Supabase公式ドキュメント（<https://supabase.com/docs/guides/platform/backups>、<https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>、<https://supabase.com/docs/guides/auth/password-security>、<https://supabase.com/docs/guides/auth/auth-mfa>）、および本セッションでの読み取り専用調査結果。曖昧な項目は「要確認」と明記し、断定を避けている。
