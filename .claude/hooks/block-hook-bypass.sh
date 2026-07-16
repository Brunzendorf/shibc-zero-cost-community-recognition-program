#!/bin/bash
# Blocks attempts to bypass git hooks or commit signing.
# PreToolUse hook on Bash. Exit code 2 = block the tool call.
#
# Rationale: hooks (lint, tests, formatting) and signing are quality/security
# gates. Bypassing them hides real failures. Fix the underlying problem instead.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | grep -oP '"command"\s*:\s*"\K[^"]*' 2>/dev/null || \
          echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

if echo "$COMMAND" | grep -qE '(--no-verify|--no-gpg-sign|HUSKY=0|GIT_HOOKS=0)'; then
  echo "" >&2
  echo "BLOCKED: hook / signing bypass detected." >&2
  echo "" >&2
  echo "Found one of: --no-verify, --no-gpg-sign, HUSKY=0, GIT_HOOKS=0" >&2
  echo "Fix the failing check instead of bypassing it." >&2
  echo "" >&2
  exit 2
fi

exit 0
