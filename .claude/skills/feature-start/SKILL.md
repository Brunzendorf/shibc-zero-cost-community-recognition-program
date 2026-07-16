---
name: feature-start
description: Start work on a GitHub issue. Creates a feature/<nr>-<desc> branch from the resolved base branch. Supports worktree-based parallel work when the tree is dirty or --worktree is passed.
user-invocable: true
allowed-tools: Bash(git *) Bash(gh *) Read
argument-hint: "<issue-nr> [short-description] [base-branch] [--worktree]"
---

# Feature Start

Start work on issue `$ARGUMENTS`. Arguments: `<issue-nr> [short-description] [base-branch] [--worktree]`.

## Configuration
Read `.claude/project.json` → `workflow` (defaults as in the `/ship` skill).

## Hard rules
- **Never** work directly on `mainBranch`. Branch off the integration/epic/main branch as configured.
- Branch naming: `feature/<issue-nr>-<kebab-description>`. Lowercase, no spaces.
- **Never stash or reset** the working tree to force an in-place checkout. Dirty tree → worktree flow.

## Steps

### 1. Parse arguments
Extract `issue_nr`, `desc`, `base_branch` (optional), `worktree_flag`. If `desc` is missing, derive it from the issue title (lowercase, dashes, max ~40 chars).

### 2. Verify the issue exists
    gh issue view <issue_nr> --json title,state,labels
Abort if the issue is closed or missing.

### 3. Determine the base branch
- If `base_branch` was passed, use it.
- Else if `useEpicBranches` and the current branch is `epic/*`, use it.
- Else if `integrationBranch` is set, use it.
- Else use `mainBranch`.
If the choice is ambiguous, ASK — do not guess.

### 4. Decide: in-place checkout vs. worktree
Run:

    git status --porcelain
    git worktree list --porcelain

Decision:

| Tree state | Worktree for this branch exists? | `--worktree` flag? | Flow |
|------------|----------------------------------|--------------------|------|
| clean      | no  | no  | **in-place** (5a) |
| clean      | no  | yes | **worktree** (5b) |
| clean/dirty| yes | any | **attach to existing worktree** (5c) |
| dirty      | no  | any | **worktree** (5b) — tell the user why |

"Dirty" excludes ignorable build artefacts (`node_modules/`, `dist/`, `.next/`, `.turbo/`).

### 5a. In-place flow
    git fetch origin
    git checkout <base>
    git pull origin <base>
    git checkout -b feature/<issue_nr>-<desc> <base>

### 5b. Worktree flow
Resolve repo name: `basename "$(git rev-parse --show-toplevel)"` → `<repo>`.

    git fetch origin
    git worktree add ../<repo>-<issue_nr> -b feature/<issue_nr>-<desc> origin/<base>

Tell the user (do NOT `cd` yourself — shell state does not persist across tool calls):
> Worktree created at `../<repo>-<issue_nr>` on `feature/<issue_nr>-<desc>`.
> Switch to it before working: `cd ../<repo>-<issue_nr>`

### 5c. Attach to an existing worktree
Find the path via `git worktree list` and tell the user to `cd` there. Never create a second worktree for the same branch.

### 6. Mark the issue as in-progress
    gh issue edit <issue_nr> --add-label "in-progress"

### 7. Inform the user
Report: new branch name, issue title, base branch, flow used, the `cd` command (if a worktree), and next step ("implement, then run `/ship`").

## After branch creation
Stop. Do not start implementing unless the user explicitly asks. This skill's job is to set up the branch correctly.

## Note for the executor
The indented command blocks are **templates** — substitute the placeholders with real values before running them. Never pass a literal `<issue_nr>` or `<base>` to the shell.
