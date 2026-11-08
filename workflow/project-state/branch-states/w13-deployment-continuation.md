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
| S1 | 2026-11-08 00:00 | Codex | W13 | Blocked — needs human | GitHub `production` Environment now has `DIRECT_DATABASE_URL`; tokenless Vercel Git integration confirmation remains | Owner confirms Vercel Git integration is linked to protected `main` with production auto-deploy enabled | 2026-11-08 00:00 |

**Remaining**

- [x] Q~4: Before original W13 T5, repository owner confirms the active Neon plan and approved restricted rehearsal target. **Confirmed 2026-11-08 and amended:** Neon Free, which provides a six-hour instant-restore history; approved baseline is `agile-platform-dev / w13-recovery-baseline`, with `w13-recovery-past` as the recovered child. The subsequent backup/restore rehearsal may alter only those disposable branches and remains owner-operated.
- [ ] **Handover:** After the amended approvals, record the redacted T4 audit result distinguishing generic PR previews from the protected `development` branch. **Done 2026-11-08:** generic Preview is `APP_TIER=preview`; dev-tier variables are exact-`development` scoped; repository linkage and branch protection pass.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W13 | Environments, seed data and deployment | In progress — owner action | [follow-up spec](../../specs/2026-11-07-w13-pr18-safety-fixes-design.md) | [follow-up plan](../../plans/2026-11-06-w13-deployment.md) | T4 and T5 done; T6 is next | — |

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
| 2026-11-08 | Added a narrowly scoped tier-validator exception for the exact approved W13 rehearsal branch; regression and full-suite tests pass. | W13 | this commit |
| 2026-11-08 | Operator amended the recovery target: seed `w13-recovery-baseline` and create `w13-recovery-past` from its pre-change point; the validator now accepts only the baseline name. | W13 | this commit |
| 2026-11-08 | Owner confirmed `w13-recovery-past` contains the state from before the controlled changes to `w13-recovery-baseline`; restore verification passed, with timing and post-restore seed evidence still pending. | W13 | this commit |
| 2026-11-08 | Owner `teleifo` verified the recovered branch and seed data; redacted T5 evidence records 20-second RPO/RTO (0.0056 hours each) and a passing outcome. | W13 | this commit |
| 2026-11-08 | T6 preflight found the plan's `.github/workflows/w13-dev-check.yml` was removed in `c9ed369`; option 1 cannot run until the owner chooses to recreate that workflow or accept an explicit audit exception. | W13 | this commit |
| 2026-11-08 | Removed the dead dev-check verifier, dedicated test, and runbook section; historical plan/spec/state references remain for audit history. | W13 | this commit |
| 2026-11-08 | Operator approved the amended W13 safety spec at Gate 1; the removed automated dev-check is replaced by owner-recorded Vercel metadata plus fixed development smoke evidence. | W13 | this commit |
| 2026-11-08 | Owner reported partial manual T4 evidence: `GET /api/health` passes, unauthenticated `GET /api/me` returns the expected 401, and no seeded development data exists yet; T4 remains incomplete. | W13 | this commit |
| 2026-11-08 | Route audit found only endpoints 1–4 registered; the required endpoint 51 belongs to W9's unimplemented Developer slice, so W13 T4 is blocked on W9 before owner smoke evidence can pass. | W13 | this commit |
| 2026-11-08 | Operator reversed C~5's standup/AI prerequisite: T4 now requires only deployment metadata plus health/auth/foreign-token/tier evidence; W9 remains separate. | W13 | this commit |
| 2026-11-08 | Operator verified the reduced T4 gate and authorized continuation; remaining work is owner-recorded deployment metadata plus health/auth/tier evidence. | W13 | this commit |
| 2026-11-08 | Owner reported the reduced health, authenticated identity, foreign-token, and dev-tier checks as verified; T4 remains pending only for the redacted deployment metadata fields. | W13 | this commit |
| 2026-11-08 | Owner supplied the Vercel deployment ID and timestamps; reduced T4 evidence is complete with health/auth/foreign-token/tier checks passing and outcome `pass`. | W13 | this commit |
| 2026-11-08 | T6 implementation is complete through validation: protected `main` workflow, detached SHA/artifact identity checks, production migration invocation, and candidate deployment verification are covered; owner production configuration is now the required gate. | W13 | this commit |
| 2026-11-08 | Deviation found before configuration: the T6 draft references `VERCEL_TOKEN`/`VERCEL_TEAM_ID`, conflicting with approved C~5's no-token repository-workflow boundary; no production secrets should be added until resolved. | W13 | this commit |
| 2026-11-08 | Operator kept C~5; removed token-based Vercel link/deploy/inspect steps from T6 and replaced them with a protected, tokenless Vercel Git integration handoff. | W13 | this commit |
| 2026-11-08 | Owner added the protected GitHub `production` Environment secret `DIRECT_DATABASE_URL`; Vercel Git integration confirmation remains before T6 can proceed. | W13 | this commit |

### T4 redacted evidence

```yaml
target: development
commit: 512dc4c0ad0cf487cca2020756cc5d0c82716525
pushTimestamp: 2026-11-08T10:24:21Z
deploymentId: dpl_sPxp8s4zHAokr4fM9c5D8wwZZQUi
project: prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd
alias: development
state: READY
createdAt: 2026-11-08T10:24:25.623Z
checkedAt: 2026-11-08T11:58:15Z
health: pass
auth: pass
foreignAuth: pass
tier: pass
owner: teleifo
outcome: pass
```

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

### C~3 — Allow the approved W13 branch through dev seed validation

- **Date:** 2026-11-08
- **Who asked:** operator, after the seed command was blocked by canonical dev-target validation.
- **Decision:** Permit `APP_TIER=dev` to use a non-canonical Neon host only when `W13_RECOVERY_REHEARSAL=1`, `NEON_BRANCH=w13-recovery-baseline`, the canonical dev Neon project is declared, the database is `neondb`, and the host is not the production host.
- **Why:** The approved disposable recovery branch needs the repository's existing seed command without weakening generic preview or production target checks.
- **Rejected:** Bypassing validation or allowing arbitrary non-canonical dev database hosts.

### C~4 — Supersede C~2 with baseline/past recovery branches

- **Date:** 2026-11-08
- **Who asked:** operator, because Neon exposes the parent `development` as the restore source for the original rehearsal branch.
- **Decision:** Supersede C~2. Use `agile-platform-dev/w13-recovery-baseline` as the seeded known-good branch and `w13-recovery-past` as its disposable recovered child created from the point immediately before the controlled change.
- **Why:** The seeded baseline must remain intact while the recovered state is created from a branch whose parent contains the known-good data.
- **Rejected:** Restoring the seeded branch directly from empty `development`.

### Q~5 — T4 deployment evidence required before T6

- **Date:** 2026-11-08
- **Question:** Has the owner completed T4's deployed-SHA and dev smoke evidence gate, or should the existing T4 read-only configuration audit be explicitly accepted as the gate evidence?
- **Resolution:** Resolved 2026-11-08 by approving C~5 and replacing the removed workflow with the manual evidence gate; C~6 later removed the unimplemented W9 standup/AI probe, while deployed-SHA and health/auth/tier evidence remain required before T6.

### D~3 — T4 workflow removed before continuation

- **Found:** 2026-11-08 during the T6 option-1 procedure audit.
- **What:** The approved W13 plan references `.github/workflows/w13-dev-check.yml`, but commit `c9ed369` removed that workflow. Only the verifier script and tests remain.
- **Consequence:** The planned deployed-SHA and dev-smoke evidence cannot be produced through the approved workflow as written; recreating it changes the implementation scope.
- **Next decision:** Owner must choose workflow recreation (amend the plan/spec first) or explicitly accept the existing read-only audit as a T4 exception.

### C~5 — Replace automated dev-check with manual owner evidence

- **Date:** 2026-11-08
- **Who asked:** operator, after requesting removal of all `w13-dev-check` artifacts.
- **Decision:** Retire the removed automated development-check workflow and verifier. (Superseded by C~6 for the smoke composition.)
- **Why:** Removes obsolete automation while preserving the deployment identity and smoke-evidence safety boundary.
- **Rejected:** Recreating the removed workflow solely to satisfy its stale plan reference; accepting configuration audit alone without deployment and smoke evidence.

### C~6 — Remove the W9 standup/AI probe from the T4 gate

- **Date:** 2026-11-08
- **Who asked:** operator, after the route audit showed endpoint 51 is not implemented.
- **Decision:** T4 requires deployment metadata plus health, authenticated identity, foreign-project rejection, and dev-tier evidence. The Developer standup/AI probe is removed from T4 and remains a separate W9 responsibility.
- **Why:** W13 deployment safety must not be blocked by an unstarted feature workstream.

### D~4 — T6 draft conflicts with C~5 no-token boundary

- **Found:** 2026-11-08 during owner configuration review.
- **What:** The draft T6 workflow asks for `VERCEL_TOKEN` and `VERCEL_TEAM_ID`, while C~5 explicitly retains a no-Vercel-token boundary for repository workflows and application runtime.
- **Consequence:** Production configuration is paused; no token should be restored until the owner chooses whether to preserve C~5 with tokenless Vercel Git deployment or reverse C~5.

### C~7 — Keep C~5 for T6

- **Date:** 2026-11-08
- **Who asked:** operator.
- **Decision:** Keep Vercel deployment tokens out of repository workflows and runtime; T6 validates the protected migration/build and relies on the linked Vercel Git integration for the `main` deployment.

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
