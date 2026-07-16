---
name: hotfix
description: Create a fix/* branch from the main branch, then push, run CI, open a PR, run /pr-review, and merge. Supports worktree-based parallel work.
user-invocable: true
allowed-tools: Bash(git *) Bash(gh *) Read Skill
argument-hint: "<short-description> [--worktree]"
---

# Hotfix Flow

Create a hotfix branch for `$ARGUMENTS` targeting the main branch.

## Configuration
Read `.claude/project.json` → `workflow` (defaults as in `/ship`). The hotfix base is always `mainBranch`.

## Hard rules
- **Never** commit directly to `mainBranch`. Always via a PR.
- CI-flow order (cheap checks gate expensive ones): push → CI → PR → `/pr-review` → merge.
- Branch naming: `fix/<kebab-description>`. Lowercase, no spaces.

## Phase 1 — Setup (on invocation)

1. **Parse the argument** — `desc` as kebab-case. Detect `--worktree` anywhere in `$ARGUMENTS`.

2. **Decide: in-place vs. worktree**
   - `git status --porcelain` (ignoring build artefacts: `node_modules/`, `dist/`, `.next/`, `.turbo/`)
   - `git worktree list --porcelain`

   | Tree state | Worktree for `fix/<desc>` exists? | `--worktree`? | Flow |
   |------------|-----------------------------------|---------------|------|
   | clean | no  | no  | in-place (3a) |
   | clean | no  | yes | worktree (3b) |
   | dirty | no  | any | worktree (3b) — tell the user why |
   | any   | yes | any | attach to existing worktree (3c) |

   **3a. In-place:** `git fetch origin` → `git checkout <mainBranch>` → `git pull` → `git checkout -b fix/<desc>`
   **3b. Worktree:** `git worktree add ../<repo>-fix-<desc> -b fix/<desc> origin/<mainBranch>`, then tell the user to `cd` there.
   **3c. Attach:** find the path via `git worktree list`, tell the user to `cd` there.

3. **Mark the issue as in-progress** if `desc` starts with an issue number (`fix/858-...`): `gh issue edit <nr> --add-label "in-progress"`.

4. **Report:** "Branch `fix/<desc>` created (flow: ...). Apply the fix. Tell me when done."

## Phase 2 — Ship (when the user signals "done")

5. **Detect worktree context** — compare `git rev-parse --show-toplevel` with `--git-common-dir`. Remember `WORKTREE_PATH` if they differ.
6. **Verify commits exist** — `git log --oneline <mainBranch>..HEAD`. None → ask the user to commit.
7. **Push** — `git push -u origin fix/<desc>`.
8. **Wait for CI** — `gh pr checks` once the PR exists, or `gh run watch` for push-triggered CI. RED → STOP.
9. **Open the PR** — `gh pr create --base <mainBranch> --title "fix: <desc>" --body "<body>"`.
10. **Run /pr-review (MANDATORY)** — invoke `/pr-review <mainBranch>`. FAIL → STOP. WARN → ask the user.
11. **Update the PR body** with the review summary.
12. **Remove the `in-progress` label** if an issue number was detected.
13. **Report** the PR URL. If `workflow.autoMerge` is true and all gates are green, merge with `gh pr merge <nr> --<mergeStrategy> --delete-branch`; otherwise hand the merge command to the user.
14. **Worktree cleanup** — if a worktree was used, give the user the removal commands (resolve the main clone first, then `git -C <main> worktree remove` + `branch -D`).
