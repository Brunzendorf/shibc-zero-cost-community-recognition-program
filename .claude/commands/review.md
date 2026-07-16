---
description: Review all uncommitted changes for security, quality, conventions, and tests.
---

Review all uncommitted changes.

1. `git diff` and `git diff --cached` — show every change.
2. Check for:
   - **Security** — no secrets, no injection, no XSS
   - **Quality** — no duplication, clean types, proper error handling
   - **Conventions** — follows the patterns in `CLAUDE.md` (cache invalidation, soft-delete, scope filters, naming)
   - **Tests** — do the changes need new tests?
3. Produce a short review:
   - **Critical issues** (must fix)
   - **Warnings** (should address)
   - **Suggestions** (optional, nice-to-have)

For a full branch-vs-base review, use the `/pr-review` skill instead — this command only covers uncommitted work.
