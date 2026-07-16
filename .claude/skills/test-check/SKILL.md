---
name: test-check
description: Check whether changed files have corresponding tests and suggest what is missing.
user-invocable: true
allowed-tools: Read Grep Glob Bash(git diff *) Bash(git status *)
---

# Test Coverage Check

Analyze recently changed files and verify they have adequate test coverage.

## Steps

### 1. Find the changed files
    git diff --name-only HEAD~1
If there is no recent commit, use working-tree changes:

    git diff --name-only
    git diff --name-only --cached

### 2. For each changed source file, locate its test
Search for a matching test using the project's conventions. Common patterns:
- Co-located: `foo.ts` → `foo.test.ts` / `foo.spec.ts` next to it
- A `__tests__/` folder next to the source
- A top-level `tests/` or `test/` directory mirroring the source tree
- E2E specs under `e2e/` or `tests/e2e/`

Classify each file:
- **OK** — a test exists and plausibly covers the change
- **MISSING** — no test found
- **INCOMPLETE** — a test exists but does not cover the changed behaviour

Skip files that do not need unit tests (config, type-only modules, generated files, i18n JSON — for those, just note locale parity).

### 3. Output

| File | Test file | Status | Missing |
|------|-----------|--------|---------|
| `path/to/changed.ts` | `path/to/test` | OK / MISSING / INCOMPLETE | what to add |

### 4. Suggest test code
For each MISSING entry, suggest a test skeleton that follows the patterns already used in the project (same runner, same helpers, same factories).
