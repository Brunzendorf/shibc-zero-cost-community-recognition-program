# CLAUDE.md

## Overview

**Zero-Cost Community Recognition Program** — Non-monetary recognition program (OG Holder / Diamond Paws / Top Contributor / Governance Voice badges) per loop-16 scoping comment on #6. Phase 1: manual curation + Telegram custom titles + monthly Wall of Fame pinned post + X recap. No project existed for this issue, which is why the loop-16 create_project_task silently had nowhere to attach.

> Scaffolded from `project-template` by AITO (#1268). This repo is **dormant**
> until its per-project Vault path + AppRole are provisioned out-of-band; until
> then `secrets:pull` has nothing to pull and the MCP servers stay unconnected.

## MCP servers

This repo ships a **least-privilege** `.mcp.json` (github + woodpecker + playwright for web). Additional MCP servers (directus, imagen, …) are added
deliberately and human-gated — never auto-expanded by an agent.

## Quality gates

Woodpecker CI (`.woodpecker/ci.yml`) runs typecheck + lint + tests.
