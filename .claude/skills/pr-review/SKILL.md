---
name: pr-review
description: AI-driven code review covering project conventions, security, code quality, type safety, tests, architecture, and performance. Runs on the diff between the current branch and its base.
user-invocable: true
allowed-tools: Read Grep Glob Bash(git *) Bash(gh *) Agent Skill
argument-hint: "[base-branch]"
---

# PR Review — Architecture, Security, Quality

Run a comprehensive review of the current branch against its base branch (`$ARGUMENTS` or auto-detected).

## Hard rules
- **Never** skip this review when called from `/ship` or `/hotfix`.
- Flag ALL findings by severity. Do not silently pass questionable code.
- The result is blocking: on FAIL the calling skill must NOT merge without explicit user override.

## Steps

### 1. Determine the base branch
- If `$ARGUMENTS` is a non-empty branch name, use it.
- Otherwise resolve from `.claude/project.json` and the current branch (see the `/ship` skill's resolution rules).
- Report the resolved base before proceeding.

### 2. Collect the diff
    git fetch origin
    git diff origin/<base>...HEAD --stat
    git diff origin/<base>...HEAD --name-only

### 3. Review every changed file
Read each file in its post-change state and apply the dimensions below. Record findings as `BLOCKER | WARN | INFO`. For diffs touching >20 files, use the `Agent` tool (Explore) to parallelize by concern.

### 4. Output a structured report (format below).

### 5. Return control
PASS → caller may proceed. FAIL → caller must stop. WARN → caller asks the user.

## Review dimensions

### 1. Project conventions — `CLAUDE.md` compliance (BLOCKER)
Read `CLAUDE.md`. Verify the diff follows its documented patterns: state/cache handling, data-access layer, naming, folder structure, the project's "don't do this" rules.

### 2. Type safety (BLOCKER)
No new `as any` casts. No `any` annotations without a documented reason. Shared types reused, not duplicated. Input schemas (Zod or equivalent) for all external inputs.

### 3. Security (BLOCKER for missing auth / unsafe SQL)
Authentication on protected routes. Ownership / tenant-scope checks. Parameterized queries — no string-concatenated SQL. Rate limiting where appropriate. No stack traces leaked in error responses. No `dangerouslySetInnerHTML` without sanitization. See the `/security-review` skill for the full OWASP checklist.

### 4. i18n (BLOCKER if the project is multilingual and a user-visible string is hardcoded)
Skip if the project is single-language. Otherwise: every visible string goes through the translation function, and every new key exists in **all** configured locales.

### 5. Code duplication (WARN)
Copy-pasted logic across new files. Shared helpers extracted. Existing utilities reused.

### 6. Architecture
Shared logic in the shared layer. Server-only code not imported by the client. Schema changes paired with their migration. New cross-cutting concepts documented in `CLAUDE.md`.

### 7. Tests (WARN if missing, BLOCKER if regressing)
New pure logic has unit tests. New routes/services have integration tests (happy path + auth). Tests are isolated (state reset between tests). Coverage meets the project's target.

### 8. Performance
No N+1 queries. No unnecessary re-renders. No blocking work in hot paths. Large responses paginated.

### 9. Git hygiene (INFO)
Conventional commit format. No leftover `console.log`. No `TODO`/`FIXME` without an issue reference. No secrets committed.

### 10. Build / Docker
Dependency changes still build. Schema changes handled by the migration path on startup.

## Report format

```
# PR Review — <branch> → <base>

**Files changed:** <count>
**Result:** PASS | WARN | FAIL

## Blockers (must fix before merge)
| # | Dimension | File:Line | Finding | Suggested fix |

## Warnings (should fix)
| # | Dimension | File:Line | Finding | Suggested fix |

## Info / Nice-to-have
| # | Dimension | File:Line | Note |

## Dimension summary
- Project conventions: ✅ / ❌
- Type safety: ✅ / ❌
- Security: ✅ / ❌ / n/a
- i18n: ✅ / ❌ / n/a
- Tests: ✅ / ❌ / n/a
- Architecture: ✅ / ❌
- Performance: ✅ / ❌

## Recommendation
PASS → proceed. FAIL → fix blockers first. WARN → caller asks the user.
```

## Notes
This review is IN ADDITION to CI — CI checks that tests pass; this review checks architecture, patterns, and conventions that CI cannot catch.
