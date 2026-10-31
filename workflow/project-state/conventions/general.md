# Conventions — General

Rules every change must honour. Breaking one is a bug even if the tests pass.

- Never import `packages/db` or Prisma from `apps/web`; a module reaches another only through its exported functions, never its tables (AD-01b, A-03).
- Route handlers never check roles; the policy map in `packages/contracts` is the gate, and CI fails on a route missing from it (AD-55).
- No model call inside a database transaction. The LLM never computes progress, velocity or forecast (AD-12, AD-22).
- Never log or store prompt text, response text, tokens, registration codes or credentials (AD-25, AD-33).
- Instants are UTC; calendar days use `Asia/Singapore` (AD-37). Mutable entities carry `version`; a stale version is 409 (AD-35).
- AI and uploaded text is rendered as plain text; `url` fields are `https:` only (A-15, AD-60).
- Tests use the mock gateway; CI never calls the live SoCLaaS service (AD-26).

## ID Namespaces

State: `W` = workstream, `C` = project decision, `D` = deviation, `Q` = needs a human, `L` = lesson. No hyphen; numbers are never reused and are allocated only by `sync-project-state`. A branch state uses provisional `~` IDs (`C~1`).

Architecture (`docs/architecture`): `AD-nn` = architecture decision, `A-nn` = delegated assumption, `G-nn` = gap, `C-nn` = review item in concerns.md, `R<n>` = requirement. Hyphenated and kept in the architecture files; do not confuse `C-01` (a review item) with `C1` (a project decision).
