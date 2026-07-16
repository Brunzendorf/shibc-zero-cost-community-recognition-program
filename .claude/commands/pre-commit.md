---
description: Run the full pre-commit check manually.
---

Run the full pre-commit check manually.

1. Lint the staged files with zero tolerance for warnings (the project's lint command, plus `--max-warnings=0` or equivalent).
2. Type check (`npm run typecheck` / `npx tsc --noEmit`).
3. Run the test suite fail-fast (the project's test command, plus `--bail`; allow "no tests").
4. `git diff --cached --stat` — summary of the staged changes.

Auto-fix where possible, report the rest. End with: **ready to commit — yes / no**, with reasoning.
