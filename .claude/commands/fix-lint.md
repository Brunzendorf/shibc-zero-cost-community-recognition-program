---
description: Fix all lint errors in the changed files.
---

Fix all lint errors in the changed files.

1. `git diff --name-only --diff-filter=ACMR HEAD` — find changed files.
2. Keep only the source files the linter covers (e.g. `*.{ts,tsx,js,jsx}`); skip generated files and tests unless they lint too.
3. Run the project's lint-fix command on them — check `package.json` scripts for `lint:fix` or `lint`, otherwise `npx eslint --fix`.
4. Run the type checker (`npm run typecheck` / `npx tsc --noEmit`) to confirm it still compiles.
5. Fix the remaining errors manually.
6. Stage the fixed files with `git add`.

End with a summary: which files were fixed, which errors remain.
