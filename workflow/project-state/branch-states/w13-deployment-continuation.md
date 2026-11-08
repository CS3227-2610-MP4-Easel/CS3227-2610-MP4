# Branch State — w13-deployment-continuation

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w13-deployment-continuation (from `INT` at `dc3447f`)
- **Base:** dc3447f
- **Owner:** operator / repository owner
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-08 by Codex — T4 audit complete; T5 gate pending

**Untouched:** Architecture, Conventions, Known Gaps

---

**Scope.** Continue W13’s merged deployment follow-up from the protected Vercel preview-environment audit, then carry the recovery, production-deployment, and smoke-harness work forward in dependency order.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-08 00:00 | Codex | W13 | In progress — owner action | Original W13 T5 recovery rehearsal on approved restricted target | Owner performs backup/restore rehearsal and records redacted RPO/RTO evidence | 2026-11-08 00:00 |

**Remaining**

- [x] Q~4: Before original W13 T5, repository owner confirms the active Neon plan and approved restricted rehearsal target. **Confirmed 2026-11-08:** Neon Free, which provides a six-hour instant-restore history; approved target is `agile-platform-dev / w13-recovery-rehearsal`. The subsequent backup/restore rehearsal may alter that target and remains owner-operated.
- [ ] **Handover:** After the amended approvals, record the redacted T4 audit result distinguishing generic PR previews from the protected `development` branch. **Done 2026-11-08:** generic Preview is `APP_TIER=preview`; dev-tier variables are exact-`development` scoped; repository linkage and branch protection pass.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W13 | Environments, seed data and deployment | In progress — owner action | [follow-up spec](../../specs/2026-11-07-w13-pr18-safety-fixes-design.md) | [follow-up plan](../../plans/2026-11-07-w13-pr18-safety-fixes.md) | Safety T4 done; owner-operated recovery rehearsal approved and pending evidence | — |

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
| 2026-11-08 | Completed the redacted T4 audit: generic Preview is `APP_TIER=preview`; no forbidden names have generic/fork Preview scope; dev-tier variables are exact-`development` scoped; Vercel repository linkage and GitHub AD-32 protection pass. | W13 | this commit |
| 2026-11-08 | Operator approved `agile-platform-dev / w13-recovery-rehearsal` as the restricted Neon target for original W13 T5; owner-operated backup/restore evidence is now the next action. | W13 | this commit |
| 2026-11-08 | Amended the recovery runbook to permit the approved isolated development target under synthetic-data-only and no-production-wiring constraints; ordinary previews and production targets remain forbidden. | W13 | this commit |

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — Preserve AD-53's protected development exception

- **Date:** 2026-11-08
- **Who asked:** operator, after the T4 Vercel audit found F6's all-Preview wording conflicted with AD-53.
- **Decision:** Keep development-scoped dev-tier configuration on the protected `development` branch. Amend the W13 safety spec and T4 audit to forbid credentials only for untrusted PR previews; generic Preview receives only `APP_TIER=preview` and allowed non-sensitive Vercel identity fields.
- **Why:** The protected development branch is the dev tier and must retain its operational configuration, while untrusted PR code must remain credential-free.
- **Rejected:** Removing development-tier variables under Vercel's Preview deployment type, which would reverse AD-53 and disable the intended dev tier.

### C~2 — Permit the approved isolated development recovery target

- **Date:** 2026-11-08
- **Who asked:** operator, after the W13 recovery runbook prohibited all developer targets.
- **Decision:** Amend the runbook to permit `agile-platform-dev/w13-recovery-rehearsal` as a restricted T5 target because it is a separate project branch approved by the operator, provided it contains synthetic data only and has no production credentials or application wiring.
- **Why:** The owner needs a safe, non-production target for the recovery rehearsal while preserving the prohibition on production projects, ordinary developer environments, generic previews, and production data.
- **Rejected:** Using `agile-platform-prod/production` or an ordinary preview/developer target for recovery testing.

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
- **Consequence:** Resolved 2026-11-08 after owner MFA. The exact generic `APP_TIER` value is `preview`; no secret or MFA code was recorded.
- **Evidence:** The Vercel project lists only generic Preview `APP_TIER`; all dev-tier variable names are Preview plus exact `development`; the owner completed MFA and the permitted non-secret value was observed.

## Lessons

### L~1 — Match validation tools to artifact format

- **Date:** 2026-11-08
- **Cause:** A legacy plan checker was run against a Format v2 specification.
- **Rule:** Check an artifact's declared format before selecting its validation command; do not infer a missing v1 field is a v2 defect.
- **Scope:** role:implementer
- **Found by:** Codex
