#!/usr/bin/env bash

set -Eeuo pipefail

DAILY_RETENTION=14
WEEKLY_RETENTION=8
SNAPSHOT_NAME_PATTERN='^[0-9]{8}T[0-9]{6}Z$'

if [[ $# -ne 1 ]]; then
  echo "usage: rotate-backups.sh BACKUP_ROOT" >&2
  exit 64
fi

BACKUP_ROOT=$1
SNAPSHOT_ROOT="$BACKUP_ROOT/snapshots"

case "$BACKUP_ROOT" in
  / | /tmp | /private/tmp | "$HOME" | "")
    echo "unsafe backup root" >&2
    exit 65
    ;;
esac

[[ -d "$SNAPSHOT_ROOT" ]] || exit 0

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/candidate-crm-rotation.XXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT
ALL_FILE="$TMP_DIR/all"
KEEP_FILE="$TMP_DIR/keep"
WEEKS_FILE="$TMP_DIR/weeks"
: >"$ALL_FILE"
: >"$KEEP_FILE"
: >"$WEEKS_FILE"

while IFS= read -r candidate; do
  name=${candidate##*/}
  if [[ $name =~ $SNAPSHOT_NAME_PATTERN && -f "$candidate/.backup-complete" ]]; then
    printf '%s\n' "$candidate" >>"$ALL_FILE"
  fi
done < <(find "$SNAPSHOT_ROOT" -mindepth 1 -maxdepth 1 -type d -print | sort -r)

daily_count=0
while IFS= read -r snapshot; do
  if ((daily_count < DAILY_RETENTION)); then
    printf '%s\n' "$snapshot" >>"$KEEP_FILE"
    daily_count=$((daily_count + 1))
  fi
done <"$ALL_FILE"

weekly_count=0
while IFS= read -r snapshot; do
  ((weekly_count >= WEEKLY_RETENTION)) && break
  [[ -s "$snapshot/.iso-week" ]] || continue
  iso_week=$(<"$snapshot/.iso-week")
  [[ $iso_week =~ ^[0-9]{4}-W[0-9]{2}$ ]] || continue
  if ! grep -Fxq "$iso_week" "$WEEKS_FILE"; then
    printf '%s\n' "$iso_week" >>"$WEEKS_FILE"
    printf '%s\n' "$snapshot" >>"$KEEP_FILE"
    weekly_count=$((weekly_count + 1))
  fi
done <"$ALL_FILE"

while IFS= read -r snapshot; do
  grep -Fxq "$snapshot" "$KEEP_FILE" && continue
  [[ ${snapshot%/*} == "$SNAPSHOT_ROOT" ]] || {
    echo "refusing to remove a snapshot outside the snapshot root" >&2
    exit 66
  }
  name=${snapshot##*/}
  [[ $name =~ $SNAPSHOT_NAME_PATTERN ]] || {
    echo "refusing to remove an unexpected snapshot path" >&2
    exit 67
  }
  rm -rf "$snapshot"
done <"$ALL_FILE"
