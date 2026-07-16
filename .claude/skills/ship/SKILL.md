---
name: ship
description: Push the current branch, open a PR against the resolved base branch, wait for CI, run /pr-review, and optionally auto-merge. Detects worktree context and offers cleanup after merge.
user-invocable: true
allowed-tools: Bash(git *) Bash(gh *) Read Skill
argument-hint: "[base-branch] [--cleanup-worktree | --keep-worktree]"
---

# Ship — PR Flow

Ship the current branch by opening a PR against its base branch.

## Configuration

Read `.claude/project.json` → `workflow`. If the file is missing, use these defaults:

| Key | Default | Meaning |
|-----|---------|---------|
| `mainBranch` | `main` | Release / production branch |
| `integrationBranch` | `null` | If set (e.g. `develop`), short-lived branches target it instead of main |
| `useEpicBranches` | `false` | If true, `feature/*` branches target their parent `epic/*` |
| `autoMerge` | `false` | If true, merge automatically once all gates are green |
| `mergeStrategy` | `squash` | `squash` \| `merge` \| `rebase` |

## Resolve the base branch

1. If `$ARGUMENTS` begins with an explicit branch name, use that.
2. Otherwise resolve from the current branch name:
   - `release/*` → `mainBranch`
   - `feature/*` **and** `useEpicBranches` → parent `epic/*` (find via `git merge-base` against each `epic/*`; if ambiguous, ASK)
   - `feature/*` \| `fix/*` \| `chore/*` \| `docs/*` \| `refactor/*` **and** `integrationBranch` set → `integrationBranch`
   - otherwise → `mainBranch`

Report the resolved base before proceeding.

## Hard rules
- **Never** run on `mainBranch` or `integrationBranch` directly — abort with a message.
- **Never** skip `/pr-review`.
- Auto-merge gates (ALL must hold): CI green **and** `/pr-review` returns PASS (0 blockers, 0 warnings).
- If `autoMerge` is `false`, stop after review and hand the merge command to the user.
- No `--admin` bypass unless the user explicitly asks.

## Steps

### 0. Detect worktree context
Run:

    git rev-parse --is-inside-work-tree
    git rev-parse --show-toplevel
    git rev-parse --git-common-dir

If `show-toplevel` ≠ parent of `git-common-dir`, the current checkout is a **worktree**. Remember `IS_WORKTREE=true` and `WORKTREE_PATH`. Parse `--cleanup-worktree` / `--keep-worktree` from `$ARGUMENTS`; if neither is set, ASK at step 9b.

### 1. Verify the current branch
`git branch --show-current`. If it is `mainBranch` or `integrationBranch` → STOP.

### 2. Resolve the base branch
Apply the rules above.

### 3. Push
`git status --short` — if dirty, STOP and ask the user to commit. Then `git push -u origin <current-branch>`.

### 4. Extract the issue number
From the branch name (`feature/363-...` → #363). `gh issue view <nr> --json title,body`. Use the title for the PR title; add `Closes #<nr>` to the body.

### 5. Open the PR
    gh pr create --base <base> --head <branch> --title "#<nr>: <title>" --body "<body>"

Body must include `Closes #<nr>`, a short summary, and a `## Review Summary` placeholder.

### 6. Wait for CI
`gh pr checks <pr-nr>`. RED → STOP and report the failing job. GREEN or no checks → continue.

### 7. Run /pr-review (MANDATORY)
Invoke `/pr-review <base>` via the Skill tool. Fill `## Review Summary` in the PR body.
- PASS → continue
- WARN → STOP, report warnings; the user fixes + pushes, then re-run
- FAIL → STOP, report blockers

### 8. Decide on Info findings
For each Info finding: tracked elsewhere → note `Info (tracked by #N)`; trivial → note `Info (trivial — reason)`; genuine untracked debt → `gh issue create --label follow-up` and note `Info (→ #NEW)`. List newly created issues under `## Follow-up Issues`.

### 9. Merge

**If `autoMerge` is true and all gates are green:**

    gh pr merge <pr-nr> --<mergeStrategy> --delete-branch

**If `autoMerge` is false:** report the PR URL and hand over the exact merge command. Stop.

### 9b. Worktree cleanup (only if `IS_WORKTREE=true`)
`--cleanup-worktree` → remove; `--keep-worktree` → skip; neither → ASK.
To remove (do NOT `cd` out of the worktree first):

    MAIN_CLONE="$(dirname "$(git rev-parse --git-common-dir)")"
    git -C "$MAIN_CLONE" worktree remove "<WORKTREE_PATH>"
    git -C "$MAIN_CLONE" branch -D <branch>

### 9c. Close the issue
Remove the `in-progress` label. If the PR did not target the default branch, GitHub auto-close will not fire — close manually with `gh issue close <nr> -c "Merged via #<pr-nr>"`. If the issue has open sub-task checkboxes, post a progress comment instead of closing.

### 10. Report
PR URL, merge commit SHA (if merged), follow-up issues, worktree status.
