---
name: security-review
description: OWASP-focused security review of a route, service, or module file.
user-invocable: true
allowed-tools: Read Grep Glob
argument-hint: "<file-path>"
---

# Security Review

Perform a security audit on `$ARGUMENTS` following the OWASP Top 10. Read the project's `CLAUDE.md` for any project-specific security conventions and treat them as additional checks.

## Checklist

### A01 — Broken Access Control
- [ ] Every route has authentication (auth hook / middleware / guard)
- [ ] Resource operations verify ownership / tenant scope
- [ ] Internal-only methods are not exposed via public routes
- [ ] No IDOR — a user cannot reach another user's data by guessing IDs

### A02 — Cryptographic Failures
- [ ] Sensitive data (passwords, tokens) never appears in logs or error messages
- [ ] Data exports use one-time tokens, not a direct response payload
- [ ] No secrets hardcoded in source

### A03 — Injection
- [ ] All inputs validated with schemas (Zod or equivalent) — not manual type assertions
- [ ] Database queries are parameterized — no raw SQL built by string concatenation
- [ ] No `eval()`, `Function()`, or dynamic code execution on user input

### A04 — Insecure Design
- [ ] Rate limiting on all endpoints
- [ ] Business-logic limits enforced (daily caps, cooldowns)
- [ ] Race conditions mitigated (TOCTOU checks, locks where needed)

### A05 — Security Misconfiguration
- [ ] Error responses do not leak stack traces or internal detail
- [ ] CORS configured deliberately, not wide open
- [ ] No debug endpoints reachable in production

### A07 — Cross-Site Scripting (client side)
- [ ] No `dangerouslySetInnerHTML` / `v-html` / `innerHTML` without sanitization
- [ ] User-generated content escaped before rendering
- [ ] No URL or DOM construction from unvalidated user input

### A08 — Data Integrity
- [ ] Schemas enforce type, range, and format constraints
- [ ] ID parameters validated for format (e.g. UUID)
- [ ] Enum values validated against the allowed set, not just `string`

## Output

| # | OWASP | Severity | Location | Finding | Recommendation |
|---|-------|----------|----------|---------|----------------|

End with **PASS / FAIL** and a one-line summary of the findings.
