# Branch State — w13-deployment-continuation

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w13-deployment-continuation (from `INT` at `dc3447f`)
- **Base:** dc3447f
- **Owner:** operator / repository owner
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-08 by Codex — T4 stopped on policy collision

**Untouched:** Architecture, Conventions, Known Gaps, Decisions

---

**Scope.** Continue W13’s merged deployment follow-up from the protected Vercel preview-environment audit, then carry the recovery, production-deployment, and smoke-harness work forward in dependency order.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-08 00:00 | Codex | W13 | Blocked — needs human | T4 protected Vercel preview audit: Q~1 | Confirm whether AD-53's development-scoped dev credentials remain permitted or the safety spec reverses that policy | 2026-11-08 00:00 |

**Remaining**

- [ ] Q~1: Resolve the conflict between AD-53's development exception and the safety spec's all-Preview credential prohibition before completing T4.
- [ ] **Handover:** After Q~1, record a redacted T4 audit result and either retain the development exception or remove its credentials through an approved reversal.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W13 | Environments, seed data and deployment | Blocked — needs human | [follow-up spec](../../specs/2026-11-07-w13-pr18-safety-fixes-design.md) | [follow-up plan](../../plans/2026-11-07-w13-pr18-safety-fixes.md) | T4 stopped: AD-53 and F6 conflict (Q~1) | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Created continuation branch and recorded the invalid-plan blocker before the owner-gated preview audit. | W13 | this commit |
| 2026-11-08 | Corrected the false legacy-linter blocker: the approved spec is Format v2, whose design intentionally has no implementation-order section; resumed T4. | W13 | this commit |
| 2026-11-08 | Redacted Vercel audit found development-scoped Preview variables that F6 forbids but AD-53 permits for the protected development branch; T4 stopped for an owner decision. | W13 | this commit |

## 8. Deviations

> Legend: `D` = Deviation, where reality diverged from a spec or plan. Not to be confused with AD-nn, an Architecture Decision.

### D~1 — F6 overstates the Preview credential prohibition

- **Found:** 2026-11-08 during the T4 owner-gated Vercel audit.
- **What:** The Vercel configuration scopes development-tier variables to the protected `development` branch under Vercel's Preview environment. AD-53 permits that branch to receive dev credentials and permits only other PR previews to remain mock-only. F6 instead prohibits the same variables in every Preview environment.
- **Consequence:** T4 cannot be completed without resolving whether the protected `development` branch remains the AD-53 exception or the safety specification reverses AD-53.
- **Evidence:** Environment-variable names and scopes were inspected without revealing values; generic Preview has only `APP_TIER`, while the protected `development` scope contains dev-tier configuration.

## Lessons

### L~1 — Match validation tools to artifact format

- **Date:** 2026-11-08
- **Cause:** A legacy plan checker was run against a Format v2 specification.
- **Rule:** Check an artifact's declared format before selecting its validation command; do not infer a missing v1 field is a v2 defect.
- **Scope:** role:implementer
- **Found by:** Codex
