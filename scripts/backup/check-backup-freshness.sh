#!/usr/bin/env bash

set -Eeuo pipefail

CONFIG_POINTER_DEFAULT="$HOME/.config/candidate-crm/backup-config-path"
CONFIG_POINTER=${CANDIDATE_CRM_BACKUP_CONFIG_POINTER:-$CONFIG_POINTER_DEFAULT}
FRESHNESS_MAX_AGE_SECONDS=${CANDIDATE_CRM_BACKUP_MAX_AGE_SECONDS:-172800}
BACKUP_ROOT=""
LOG_FILE=""

notify_failure() {
  local message=$1
  if [[ -n $LOG_FILE ]]; then
    printf '%s FRESHNESS_ERROR %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$message" >>"$LOG_FILE" 2>/dev/null || true
  else
    printf 'Candidate CRM backup freshness check failed: %s\n' "$message" >&2
  fi
  if [[ ${CANDIDATE_CRM_BACKUP_DISABLE_NOTIFICATIONS:-0} != 1 ]] && command -v osascript >/dev/null 2>&1; then
    osascript -e 'display notification "48時間以内の完了バックアップがありません" with title "Candidate CRMバックアップ要確認"' >/dev/null 2>&1 || true
  fi
}

fail() {
  notify_failure "$1"
  return 1
}

[[ $FRESHNESS_MAX_AGE_SECONDS =~ ^[0-9]+$ ]] || fail "freshness threshold has an invalid format"
[[ -f $CONFIG_POINTER ]] || fail "backup config pointer is missing"
pointer_owner=$(stat -f '%u' "$CONFIG_POINTER" 2>/dev/null || stat -c '%u' "$CONFIG_POINTER")
pointer_mode=$(stat -f '%Lp' "$CONFIG_POINTER" 2>/dev/null || stat -c '%a' "$CONFIG_POINTER")
[[ $pointer_owner == "$(id -u)" ]] || fail "backup config pointer must be owned by the current user"
(((8#$pointer_mode & 8#077) == 0)) || fail "backup config pointer must not be accessible by group or others"
CONFIG_FILE=$(<"$CONFIG_POINTER")
[[ -n $CONFIG_FILE && $CONFIG_FILE == /* && -f $CONFIG_FILE ]] || fail "backup config path is invalid"

config_owner=$(stat -f '%u' "$CONFIG_FILE" 2>/dev/null || stat -c '%u' "$CONFIG_FILE")
config_mode=$(stat -f '%Lp' "$CONFIG_FILE" 2>/dev/null || stat -c '%a' "$CONFIG_FILE")
[[ $config_owner == "$(id -u)" ]] || fail "backup config must be owned by the current user"
(((8#$config_mode & 8#077) == 0)) || fail "backup config must not be accessible by group or others"

# The owner-controlled, mode-600 config supplies only the backup root needed
# here. This checker never uses or logs DATABASE_URL.
# shellcheck source=/dev/null
source "$CONFIG_FILE"
: "${BACKUP_ROOT:?BACKUP_ROOT is required}"
[[ $BACKUP_ROOT == /* && -d $BACKUP_ROOT ]] || fail "BACKUP_ROOT must be an existing absolute directory"
BACKUP_ROOT=$(cd "$BACKUP_ROOT" && pwd -P)
case "$BACKUP_ROOT" in
  / | /tmp | /private/tmp | "$HOME") fail "BACKUP_ROOT is too broad" ;;
esac

LOG_FILE="$BACKUP_ROOT/backup.log"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"
SNAPSHOT_ROOT="$BACKUP_ROOT/snapshots"

marker_mtime() {
  stat -f '%m' "$1" 2>/dev/null || stat -c '%Y' "$1"
}

latest_mtime=0
if [[ -d $SNAPSHOT_ROOT ]]; then
  while IFS= read -r marker; do
    snapshot_name=$(basename "$(dirname "$marker")")
    [[ $snapshot_name =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || continue
    current_mtime=$(marker_mtime "$marker")
    if ((current_mtime > latest_mtime)); then
      latest_mtime=$current_mtime
    fi
  done < <(find "$SNAPSHOT_ROOT" -mindepth 2 -maxdepth 2 -type f -name .backup-complete -print)
fi

((latest_mtime > 0)) || fail "no completed backup snapshot was found"
now_epoch=$(date +%s)
age_seconds=$((now_epoch - latest_mtime))
((age_seconds >= 0)) || fail "latest backup timestamp is in the future"
((age_seconds <= FRESHNESS_MAX_AGE_SECONDS)) || fail "latest completed backup is older than the allowed threshold"

printf '%s FRESHNESS_OK age_seconds=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$age_seconds" >>"$LOG_FILE"
