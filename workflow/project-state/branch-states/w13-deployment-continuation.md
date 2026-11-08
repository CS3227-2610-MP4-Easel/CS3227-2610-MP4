# Branch State — w13-deployment-continuation

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w13-deployment-continuation (from `INT` at `dc3447f`)
- **Base:** dc3447f
- **Owner:** operator / repository owner
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-08 by Codex — T4 awaits owner MFA

**Untouched:** Architecture, Conventions, Known Gaps

---

**Scope.** Continue W13’s merged deployment follow-up from the protected Vercel preview-environment audit, then carry the recovery, production-deployment, and smoke-harness work forward in dependency order.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-08 00:00 | Codex | W13 | Blocked — needs human | T4 generic Preview `APP_TIER` check: Q~3 | Owner enters Vercel MFA in the handed-off browser page, then resume the value check | 2026-11-08 00:00 |

**Remaining**

- [ ] Q~3: Vercel demands owner MFA before revealing the allowed, non-secret generic Preview `APP_TIER` value. Owner enters the code in the handed-off browser page; no code is shared in chat or recorded.
- [ ] **Handover:** Complete T4's redacted Vercel/GitHub audit after Q~3; any failed scope or protection condition remains a blocker and requires no provider mutation.
- [ ] **Handover:** After the amended approvals, record the redacted T4 audit result distinguishing generic PR previews from the protected `development` branch.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W13 | Environments, seed data and deployment | Blocked — needs human | [follow-up spec](../../specs/2026-11-07-w13-pr18-safety-fixes-design.md) | [follow-up plan](../../plans/2026-11-07-w13-pr18-safety-fixes.md) | T4 scopes pass; non-secret `APP_TIER` check awaits MFA (Q~3) | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Created continuation branch and recorded the invalid-plan blocker before the owner-gated preview audit. | W13 | this commit |
| 2026-11-08 | Corrected the false legacy-linter blocker: the approved spec is Format v2, whose design intentionally has no implementation-order section; resumed T4. | W13 | this commit |
| 2026-11-08 | Redacted Vercel audit found development-scoped Preview variables that F6 forbids but AD-53 permits for the protected development branch; T4 stopped for an owner decision. | W13 | this commit |
| 2026-11-08 | Operator chose to retain AD-53; amended F6 will apply credential denial to untrusted PR previews, not protected `development`. | W13 | this commit |
| 2026-11-08 | Amended the high-risk safety spec to make the protected development exception auditable; Implementer, Tester/QA, Attacker, and Maintainer reviews found no remaining blocking issues. | W13 | this commit |
| 2026-11-08 | Operator approved the amended W13 safety specification at Gate 1. | W13 | this commit |
| 2026-11-08 | Amended the sole outstanding legacy T4 audit for AD-53's protected development exception; retained the historical plan instead of creating a partial v2 plan that cannot truthfully trace already-merged requirements. | W13 | this commit |
| 2026-11-08 | Plan review corrected an obsolete completion reference to the removed development verification workflow; the T4 audit now completes on its own redacted evidence. | W13 | this commit |
| 2026-11-08 | Operator approved the amended W13 T4 audit plan at Gate 2. | W13 | this commit |
| 2026-11-08 | T4 read-only audit confirmed exact development scoping, no generic forbidden variable names, expected Vercel repository link, and AD-32 branch protection; the generic `APP_TIER` value remains intentionally unobserved. | W13 | this commit |
| 2026-11-08 | Owner authorized revealing only generic Preview `APP_TIER`; Vercel required owner MFA, so the audit page was handed off without entering or recording a code. | W13 | this commit |

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — Preserve AD-53's protected development exception

- **Date:** 2026-11-08
- **Who asked:** operator, after the T4 Vercel audit found F6's all-Preview wording conflicted with AD-53.
- **Decision:** Keep development-scoped dev-tier configuration on the protected `development` branch. Amend the W13 safety spec and T4 audit to forbid credentials only for untrusted PR previews; generic Preview receives only `APP_TIER=preview` and allowed non-sensitive Vercel identity fields.
- **Why:** The protected development branch is the dev tier and must retain its operational configuration, while untrusted PR code must remain credential-free.
- **Rejected:** Removing development-tier variables under Vercel's Preview deployment type, which would reverse AD-53 and disable the intended dev tier.

## 8. Deviations

> Legend: `D` = Deviation, where reality diverged from a spec or plan. Not to be confused with AD-nn, an Architecture Decision.

### D~1 — F6 overstates the Preview credential prohibition

- **Found:** 2026-11-08 during the T4 owner-gated Vercel audit.
- **What:** The Vercel configuration scopes development-tier variables to the protected `development` branch under Vercel's Preview environment. AD-53 permits that branch to receive dev credentials and permits only other PR previews to remain mock-only. F6 instead prohibits the same variables in every Preview environment.
- **Consequence:** T4 cannot be completed without resolving whether the protected `development` branch remains the AD-53 exception or the safety specification reverses AD-53.
- **Evidence:** Environment-variable names and scopes were inspected without revealing values; generic Preview has only `APP_TIER`, while the protected `development` scope contains dev-tier configuration.

### D~2 — T4 needs owner MFA to prove `APP_TIER=preview`

- **Found:** 2026-11-08 during the approved read-only T4 audit.
- **What:** Vercel presents the generic Preview `APP_TIER` value as masked. The approved task requires `APP_TIER=preview` but also says not to reveal values.
- **Consequence:** Names, scopes, repository linkage, and branch protections pass, but the exact generic `APP_TIER` value is unverified pending Q~3; Vercel requires owner MFA to reveal it.
- **Evidence:** The Vercel project lists only generic Preview `APP_TIER`; all dev-tier variable names are Preview plus exact `development`; clicking its reveal control opened Vercel's MFA prompt, and no value or code was recorded.

## Lessons

### L~1 — Match validation tools to artifact format

- **Date:** 2026-11-08
- **Cause:** A legacy plan checker was run against a Format v2 specification.
- **Rule:** Check an artifact's declared format before selecting its validation command; do not infer a missing v1 field is a v2 defect.
- **Scope:** role:implementer
- **Found by:** Codex
