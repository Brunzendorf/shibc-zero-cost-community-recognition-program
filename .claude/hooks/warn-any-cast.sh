#!/bin/bash
# Warns when 'as any' casts are present in an edited TypeScript file.
# PostToolUse hook on Edit|Write. Non-blocking — emits a systemMessage only.
#
# Requires jq. If jq is not installed the hook silently no-ops (it is only
# a warning, never a gate).

command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

ANY_COUNT=$(grep -c 'as any' "$FILE_PATH" 2>/dev/null || echo "0")

if [ "$ANY_COUNT" -gt 0 ]; then
  echo "{\"continue\":true,\"systemMessage\":\"WARNING: file contains ${ANY_COUNT}x 'as any' cast(s). Prefer proper types.\"}"
else
  exit 0
fi
