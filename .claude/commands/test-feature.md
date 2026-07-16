---
description: Find and run all tests relevant to the current work.
---

Find and run all tests relevant to the current work.

1. `git diff --name-only HEAD` — identify the changed source files.
2. Find their tests — co-located (`*.test.*` / `*.spec.*`), a sibling `__tests__/`, a top-level `tests/`, or `e2e/` specs.
3. Run them with the project's test runner, fail-fast (`--bail`).
4. On failure: analyze the cause, fix it, then re-run.
5. Repeat until green.

End with: which tests ran, the result, and the duration.
