#!/bin/bash
# Safety hook — blocks destructive docker volume deletion commands.
# PreToolUse hook on Bash. Input: JSON via stdin with tool_input.command.
# Exit code 2 = block the tool call.
#
# Matches three destructive patterns:
#   1. docker [compose|-compose] ... down ... (-v|--volumes)
#   2. docker volume (rm|remove|prune) ...
#   3. docker system prune
#
# Whitespace boundaries avoid false positives on filenames/paths that merely
# contain 'down', '-v', 'volume', etc.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | grep -oP '"command"\s*:\s*"\K[^"]*' 2>/dev/null || \
          echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# Normalize: collapse whitespace, lowercase.
NORM=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]' | tr -s '[:space:]' ' ')

block() {
    local title="$1"
    local detail="$2"
    echo "" >&2
    echo "BLOCKED: $title" >&2
    echo "" >&2
    echo "$detail" >&2
    echo "" >&2
    echo "Docker volumes hold the only durable copy of database / cache / index data." >&2
    echo "Deleting them is unrecoverable. If this is truly intended, run the command" >&2
    echo "yourself outside Claude Code, and take a backup first." >&2
    echo "" >&2
    exit 2
}

# Pattern 1: docker compose ... down ... -v / --volumes
# Accepts both v2 (`docker compose`) and v1 (`docker-compose`).
HAS_COMPOSE=false
if [[ "$NORM" =~ (^|[[:space:]&|\;])docker-compose([[:space:]]|$) ]]; then
    HAS_COMPOSE=true
elif [[ "$NORM" =~ (^|[[:space:]&|\;])docker[[:space:]]+(-?-?[a-z]*[[:space:]]+)*compose([[:space:]]|$) ]]; then
    HAS_COMPOSE=true
fi

if [[ "$HAS_COMPOSE" == "true" ]] && \
   [[ "$NORM" =~ [[:space:]]down([[:space:]]|$) ]] && \
   [[ "$NORM" =~ [[:space:]](-v|--volumes)([[:space:]]|$) ]]; then
    block "docker compose down -v" "This would DELETE ALL DOCKER VOLUMES of the compose project."
fi

# Pattern 2: docker volume rm / remove / prune
if [[ "$NORM" =~ (^|[[:space:]&|\;])docker[[:space:]]+volume[[:space:]]+(rm|remove|prune)([[:space:]]|$) ]]; then
    block "docker volume rm/prune" "Direct volume deletion requires explicit user confirmation."
fi

# Pattern 3: docker system prune (with or without -a / --volumes)
if [[ "$NORM" =~ (^|[[:space:]&|\;])docker[[:space:]]+system[[:space:]]+prune([[:space:]]|$) ]]; then
    block "docker system prune" "System prune can wipe unused volumes alongside images and networks."
fi

exit 0
