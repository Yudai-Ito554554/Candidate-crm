#!/usr/bin/env bash

# This script never calls `supabase projects api-keys`. Credentials must come
# only from the owner-managed config file outside the repository.
set -Eeuo pipefail

# Increment this value whenever backup output semantics or metadata change.
SCRIPT_VERSION=2
CONFIG_POINTER_DEFAULT="$HOME/.config/candidate-crm/backup-config-path"
CONFIG_POINTER=${CANDIDATE_CRM_BACKUP_CONFIG_POINTER:-$CONFIG_POINTER_DEFAULT}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
BACKUP_ROOT=""
LOG_FILE=""
LOCK_DIR=""
LOCK_ACQUIRED=false

notify_failure() {
  local message=$1
  if [[ -n $LOG_FILE ]]; then
    printf '%s ERROR %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$message" >>"$LOG_FILE" 2>/dev/null || true
  else
    printf 'Candidate CRM backup failed: %s\n' "$message" >&2
  fi
  if [[ ${CANDIDATE_CRM_BACKUP_DISABLE_NOTIFICATIONS:-0} != 1 ]] && command -v osascript >/dev/null 2>&1; then
    osascript -e 'display notification "ログを確認してください" with title "Candidate CRMバックアップ失敗"' >/dev/null 2>&1 || true
  fi
}

on_error() {
  local status=$?
  local line=${BASH_LINENO[0]:-unknown}
  trap - ERR
  notify_failure "line=$line status=$status"
  exit "$status"
}
trap on_error ERR

cleanup() {
  if [[ $LOCK_ACQUIRED == true && -n $LOCK_DIR && -d $LOCK_DIR ]]; then
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT

fail() {
  printf 'FATAL: %s\n' "$1" >&2
  return 1
}

[[ -f "$CONFIG_POINTER" ]] || fail "backup config pointer is missing"
pointer_owner=$(stat -f '%u' "$CONFIG_POINTER" 2>/dev/null || stat -c '%u' "$CONFIG_POINTER")
pointer_mode=$(stat -f '%Lp' "$CONFIG_POINTER" 2>/dev/null || stat -c '%a' "$CONFIG_POINTER")
[[ $pointer_owner == "$(id -u)" ]] || fail "backup config pointer must be owned by the current user"
(((8#$pointer_mode & 8#077) == 0)) || fail "backup config pointer must not be accessible by group or others"
CONFIG_FILE=$(<"$CONFIG_POINTER")
[[ -n $CONFIG_FILE && $CONFIG_FILE == /* && -f $CONFIG_FILE ]] || fail "backup config path is invalid"

config_mode=$(stat -f '%Lp' "$CONFIG_FILE" 2>/dev/null || stat -c '%a' "$CONFIG_FILE")
config_owner=$(stat -f '%u' "$CONFIG_FILE" 2>/dev/null || stat -c '%u' "$CONFIG_FILE")
[[ $config_owner == "$(id -u)" ]] || fail "backup config must be owned by the current user"
(((8#$config_mode & 8#077) == 0)) || fail "backup config must not be accessible by group or others"

# The config is owner-controlled, mode 600, and stored outside the repository.
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${BACKUP_MODE:?BACKUP_MODE is required}"
: "${EXPECTED_PROJECT_REF:?EXPECTED_PROJECT_REF is required}"
: "${BACKUP_ROOT:?BACKUP_ROOT is required}"
: "${SUPABASE_WORKDIR:?SUPABASE_WORKDIR is required}"
: "${SUPABASE_CLI:?SUPABASE_CLI is required}"

[[ $BACKUP_MODE == local || $BACKUP_MODE == remote ]] || fail "BACKUP_MODE must be local or remote"
[[ $EXPECTED_PROJECT_REF =~ ^[a-z0-9_-]+$ ]] || fail "EXPECTED_PROJECT_REF has an invalid format"
[[ $BACKUP_ROOT == /* && -d $BACKUP_ROOT ]] || fail "BACKUP_ROOT must be an existing absolute directory"
BACKUP_ROOT=$(cd "$BACKUP_ROOT" && pwd -P)
SUPABASE_WORKDIR=$(cd "$SUPABASE_WORKDIR" && pwd -P)
REPOSITORY_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd -P)
case "$BACKUP_ROOT" in
  / | /tmp | /private/tmp | "$HOME") fail "BACKUP_ROOT is too broad" ;;
esac
[[ -d $SUPABASE_WORKDIR && -f $SUPABASE_WORKDIR/supabase/config.toml ]] || fail "SUPABASE_WORKDIR is not an isolated Supabase workdir"
[[ $SUPABASE_CLI == /* && -x $SUPABASE_CLI ]] || fail "SUPABASE_CLI must be an absolute executable path"
if [[ $BACKUP_MODE == remote && $SUPABASE_WORKDIR == "$REPOSITORY_ROOT" ]]; then
  fail "remote mode must not use the development repository as its Supabase workdir"
fi

chmod 700 "$BACKUP_ROOT"
LOG_FILE="$BACKUP_ROOT/backup.log"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"
LOCK_DIR="$BACKUP_ROOT/.backup-lock"
mkdir "$LOCK_DIR" || fail "another backup is already running"
LOCK_ACQUIRED=true

extract_ref_from_db_url() {
  local value=$1
  if [[ $value =~ ^postgres(ql)?://[^@]*@db\.([a-z0-9]+)\.supabase\.co([:/].*)?$ ]]; then
    printf '%s' "${BASH_REMATCH[2]}"
  elif [[ $value =~ ^postgres(ql)?://postgres\.([a-z0-9]+):[^@]+@[^/]+(/.*)?$ ]]; then
    printf '%s' "${BASH_REMATCH[2]}"
  else
    return 1
  fi
}

if [[ $BACKUP_MODE == local ]]; then
  [[ $EXPECTED_PROJECT_REF == local ]] || fail "local mode requires EXPECTED_PROJECT_REF=local"
  DB_TARGET=(--local)
  STORAGE_TARGET=(--local)
else
  : "${DATABASE_URL:?DATABASE_URL is required in remote mode}"
  actual_ref=$(extract_ref_from_db_url "$DATABASE_URL") || fail "database URL project ref cannot be verified"
  [[ $actual_ref == "$EXPECTED_PROJECT_REF" ]] || fail "database URL project ref does not match the expected ref"
  [[ -s $SUPABASE_WORKDIR/supabase/.temp/project-ref ]] || fail "isolated workdir is not linked"
  linked_ref=$(<"$SUPABASE_WORKDIR/supabase/.temp/project-ref")
  [[ $linked_ref == "$EXPECTED_PROJECT_REF" ]] || fail "isolated workdir project ref does not match the expected ref"
  DB_TARGET=(--db-url "$DATABASE_URL")
  STORAGE_TARGET=(--linked)
fi

timestamp=${BACKUP_TIMESTAMP_UTC:-$(date -u +%Y%m%dT%H%M%SZ)}
[[ $timestamp =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || fail "backup timestamp has an invalid format"
iso_week=${BACKUP_ISO_WEEK:-$(date -u +%G-W%V)}
[[ $iso_week =~ ^[0-9]{4}-W[0-9]{2}$ ]] || fail "backup ISO week has an invalid format"

SNAPSHOT_ROOT="$BACKUP_ROOT/snapshots"
FINAL_DIR="$SNAPSHOT_ROOT/$timestamp"
INCOMPLETE_DIR="$SNAPSHOT_ROOT/.incomplete-$timestamp-$$"
[[ ! -e $FINAL_DIR ]] || fail "a backup with this timestamp already exists"
mkdir -p "$INCOMPLETE_DIR/db" "$INCOMPLETE_DIR/storage"
chmod 700 "$INCOMPLETE_DIR"

run_supabase() {
  "$SUPABASE_CLI" --workdir "$SUPABASE_WORKDIR" --experimental "$@"
}

run_supabase db dump "${DB_TARGET[@]}" --role-only --file "$INCOMPLETE_DIR/db/roles.sql"
run_supabase db dump "${DB_TARGET[@]}" --file "$INCOMPLETE_DIR/db/schema.sql"
# Supabase's official backup/restore guidance excludes these vector-index
# internals; their contents are regenerated instead of restored as table data.
run_supabase db dump "${DB_TARGET[@]}" --data-only --use-copy \
  --exclude storage.buckets_vectors --exclude storage.vector_indexes \
  --file "$INCOMPLETE_DIR/db/data.sql"

for dump_file in roles.sql schema.sql data.sql; do
  [[ -s "$INCOMPLETE_DIR/db/$dump_file" ]] || fail "$dump_file is empty"
done

mkdir -p "$INCOMPLETE_DIR/storage/crm-files"
run_supabase storage cp --recursive "${STORAGE_TARGET[@]}" \
  ss:///crm-files "$INCOMPLETE_DIR/storage"

file_size() {
  stat -f '%z' "$1" 2>/dev/null || stat -c '%s' "$1"
}

storage_files=$(find "$INCOMPLETE_DIR/storage/crm-files" -type f | wc -l | tr -d ' ')
storage_bytes=$(find "$INCOMPLETE_DIR/storage/crm-files" -type f -exec sh -c '
  total=0
  for file do
    size=$(stat -f "%z" "$file" 2>/dev/null || stat -c "%s" "$file")
    total=$((total + size))
  done
  printf "%s" "$total"
' sh {} +)
storage_bytes=${storage_bytes:-0}

(
  cd "$INCOMPLETE_DIR"
  find db storage -type f -print0 | sort -z | xargs -0 shasum -a 256 >checksums.sha256
)

cat >"$INCOMPLETE_DIR/metadata.json" <<EOF
{
  "createdAt": "${timestamp}",
  "projectRef": "${EXPECTED_PROJECT_REF}",
  "scriptVersion": ${SCRIPT_VERSION},
  "database": {
    "rolesBytes": $(file_size "$INCOMPLETE_DIR/db/roles.sql"),
    "schemaBytes": $(file_size "$INCOMPLETE_DIR/db/schema.sql"),
    "dataBytes": $(file_size "$INCOMPLETE_DIR/db/data.sql")
  },
  "storage": {
    "bucket": "crm-files",
    "fileCount": ${storage_files},
    "bytes": ${storage_bytes}
  }
}
EOF
printf '%s\n' "$iso_week" >"$INCOMPLETE_DIR/.iso-week"
touch "$INCOMPLETE_DIR/.backup-complete"
chmod -R go-rwx "$INCOMPLETE_DIR"
mv "$INCOMPLETE_DIR" "$FINAL_DIR"

"$SCRIPT_DIR/rotate-backups.sh" "$BACKUP_ROOT"
printf '%s SUCCESS project_ref=%s snapshot=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$EXPECTED_PROJECT_REF" "$timestamp" >>"$LOG_FILE"
