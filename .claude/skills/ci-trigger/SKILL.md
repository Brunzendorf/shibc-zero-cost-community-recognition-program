---
name: ci-trigger
description: Trigger a CI pipeline manually and poll its status until complete. Supports Woodpecker CI (the NextInno default).
user-invocable: true
allowed-tools: Bash(curl *) Bash(gh *) Read mcp__woodpecker-ci__*
argument-hint: "<branch> [KEY=VALUE ...]"
---

# CI Manual Trigger

Trigger a manual pipeline on the branch named in `$ARGUMENTS` and wait for it to finish.

## Configuration

Read `.claude/project.json` → `ci`:

| Key | Meaning |
|-----|---------|
| `provider` | `woodpecker` \| `github-actions` \| `none` |
| `woodpecker.baseUrl` | e.g. `https://ci.next-inno.de` |
| `woodpecker.repoId` | numeric repo ID in Woodpecker |
| `woodpecker.tokenFile` | path to the gitignored token file, default `.claude/wp-token` |

If `provider` is `none`, tell the user there is no CI configured and stop.

## Parsing arguments
First token = branch name. Remaining `KEY=VALUE` pairs become pipeline variables.

## Woodpecker provider

### 1. Check the token
`test -f <tokenFile>` — if missing, STOP and ask the user to create a Woodpecker user token (Profile → CLI & API on the Woodpecker UI) and save it there.

### 2. Build the request body
```
{"branch":"<branch>","variables":{"KEY":"VALUE", ...}}
```

### 3. POST the trigger
```bash
TOKEN=$(cat <tokenFile>)
curl -s -X POST "<baseUrl>/api/repos/<repoId>/pipelines" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```
The response contains `number` and `status`. If `status == "error"`, report the errors and STOP.

### 4. Poll until done
Use the `woodpecker-ci` MCP server (`get_pipeline`) every 60 s. Stop when `status` is `success`, `failure`, or `error`.

### 5. Report
- `success` → ✅ + pipeline URL (`<baseUrl>/repos/<repoId>/pipeline/<number>`)
- `failure` → ❌ + the failed steps (use `get_step_logs`)
- `error` → ❌ + the config error message

## GitHub Actions provider
If `provider` is `github-actions`: `gh workflow run <workflow> --ref <branch>` with `-f KEY=VALUE` for each variable, then `gh run watch <id>` to poll.

## Notes
- The Woodpecker token is a user JWT. If leaked, regenerate it in the Woodpecker UI.
- Pipeline steps gated by `evaluate:` only run when the matching variable is passed.
