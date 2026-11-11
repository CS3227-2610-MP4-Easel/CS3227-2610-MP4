# Branch State — w13-deployment-continuation

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w13-deployment-continuation (from `INT` at `dc3447f`)
- **Base:** dc3447f
- **Owner:** operator / repository owner
- **Status:** Approved
- **Approved:** operator / repository owner, 2026-11-12
- **Last updated:** 2026-11-12 by Codex — Gate 3 approved by operator; branch is ready for integration

**Untouched:** Architecture, Conventions, Known Gaps

---

**Scope.** Continue W13’s merged deployment follow-up from the protected Vercel preview-environment audit, then carry the recovery, production-deployment, and smoke-harness work forward in dependency order.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| *(none)* | — | — | — | — | Branch approved; no active session | Integrate through the normal pull request; do not fold until merged | 2026-11-12 |

**Remaining**

- [x] Q~4: Before original W13 T5, repository owner confirms the active Neon plan and approved restricted rehearsal target. **Confirmed 2026-11-08 and amended:** Neon Free, which provides a six-hour instant-restore history; approved baseline is `agile-platform-dev / w13-recovery-baseline`, with `w13-recovery-past` as the recovered child. The subsequent backup/restore rehearsal may alter only those disposable branches and remains owner-operated.
- [ ] **Handover:** After the amended approvals, record the redacted T4 audit result distinguishing generic PR previews from the protected `development` branch. **Done 2026-11-08:** generic Preview is `APP_TIER=preview`; dev-tier variables are exact-`development` scoped; repository linkage and branch protection pass.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W13 | Environments, seed data and deployment | In review | [follow-up spec](../../specs/2026-11-07-w13-pr18-safety-fixes-design.md); [safety repairs](../../specs/2026-11-12-w13-safety-repairs-design.md) (amended and approved 2026-11-12) | [safety repairs plan](../../plans/2026-11-12-w13-safety-repairs/plan.md) (approved 2026-11-12) | T1-T4 complete; Gate 3 approved | — |

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
| 2026-11-09 | Operator approved amendment C~8: replace the unsafe tokenless Git auto-deploy handoff with a post-validation Vercel Deploy Hook, while keeping C~5's no-token boundary. | W13 | this commit |
| 2026-11-09 | Operator reversed T6 under C~9: removed the protected production workflow, identity script, tests, and Deploy Hook requirement; production migration/deployment is now a manual owner handover. | W13 | this commit |
| 2026-11-09 | Operator corrected the canonical Neon project mapping: development uses `falling-rice-06970921`; production remains `super-sunset-36592949`. | W13 | this commit |
| 2026-11-09 | Applied the corrected Neon mapping to the immutable manifest, runtime target map, and regression fixtures; development requires the confirmed pooled host and `falling-rice-06970921`, while production remains `super-sunset-36592949`. Focused tests, full suite, typecheck, lint, contract, Prisma, workflow, policy, secret-scan, and diff checks pass. | W13 | this commit |
| 2026-11-09 | Owner added the dev and prod Firebase variables in Vercel; Firebase configuration handover is complete, pending redeploy and runtime verification. | W13 | this commit |
| 2026-11-09 | Opened PR #26 from `w13-deployment-continuation` into `development`; branch remains at Gate 3 awaiting owner review and merge. | W13 | this commit |
| 2026-11-08 | Owner added the protected GitHub `production` Environment secret `DIRECT_DATABASE_URL`; Vercel Git integration confirmation remains before T6 can proceed. | W13 | this commit |
| 2026-11-08 | Owner verified Vercel Git integration is connected to `CS3227-2610-MP4-Easel/CS3227-2610-MP4`; Production Branch is `main`, and Vercel reports every commit pushed to `main` creates a Production Deployment. | W13 | this commit |
| 2026-11-08 | T6 close-out passed: 488 tests (462 passed, 26 skipped), typecheck, lint, contract, Prisma validation, workflow validation, agent-policy, secret scan, and diff check; branch is ready for owner review. | W13 | this commit |
| 2026-11-08 | Final review found a sequencing race: Vercel's automatic `main` deployment can start before the protected migration workflow completes; T6 is blocked until tokenless sequencing is chosen. | W13 | this commit |
| 2026-11-12 | Drafted and linted the high-risk safety-repair spec covering exact recovery targeting, AD-32-preserving production CI, workflow-contract validation, and runbook sequencing; Implementer, Tester/QA, Attacker, and Maintainer reviews completed. | W13 | pending Gate 1 approval |
| 2026-11-12 | Operator approved Gate 1 and Gate 2; four-task safety-repair plan is ready for execution. | W13 | 23321e2 + plan commit |
| 2026-11-12 | T1 exact recovery target binding and T2 explicit workflow contract completed; handovers validate. | W13 | f7843a4 + 8c1b32e |
| 2026-11-12 | Wave 1 checks pass after dependency-backed verification: 564 backend tests (536 pass, 28 skipped), 149 frontend tests, typecheck, lint, contract, workflow checker, plan lint, and diff check. | W13 | pending state commit |
| 2026-11-12 | T3 restored the protected push-main production workflow with pinned Actions, least-privilege checkout, migration wrapper, and post-migration Deploy Hook; workflow and repository checks pass. | W13 | 5e4e9c0 |
| 2026-11-12 | Wave 2 verification passes: 538 backend tests with 28 skipped, 149 frontend tests, typecheck, lint, contract, workflow checker, handover lint, and diff check. | W13 | pending state commit |
| 2026-11-12 | T4 completed with the CI-only runbook, migration failure-safety tests, and root `vercel.json` disabling Git deployments for `main`; handover and task checks pass. | W13 | bc5e075 |
| 2026-11-12 | Final hardening redacts CLI failures, rejects local wrapper execution, checks the remote `main` SHA before the Deploy Hook, and asserts `curl --fail`; branch-diff whitespace was normalized. | W13 | 2be871b |
| 2026-11-12 | Final close-out verification passes: 543 backend tests with 28 skipped, 149 frontend tests, typecheck, lint, contract, workflow checker, plan closeout, handover lint, and branch/worktree diff checks. | W13 | pending state commit |
| 2026-11-12 | Owner reports the Vercel `main` Deploy Hook and protected GitHub `production` Environment are configured with `DIRECT_DATABASE_URL` and `VERCEL_DEPLOY_HOOK_URL`; secret values are not recorded. | W13 | owner report |
| 2026-11-12 | Neon production console shows the non-pooled direct host `ep-summer-heart-b3767eul.c-4.ap-southeast-1.aws.neon.tech`; repository validation still expects the pooled `-pooler` host. | W13 | operator confirmation required |
| 2026-11-12 | Operator confirmed production runtime must remain pooled while `DIRECT_DATABASE_URL` uses the verified non-pooled host; the W13 spec and T3 task were amended accordingly. | W13 | 541dbe8 |
| 2026-11-12 | T3 target correction completed: runtime validation remains pooled, migration validation requires the verified direct host, and all close-out checks pass. | W13 | ca06561 |
| 2026-11-12 | Owner reports the Vercel Deploy Hook and protected GitHub production Environment with both secrets are configured; values remain unrecorded. | W13 | owner report |
| 2026-11-12 | Gate 3 review identified that the pre-hook SHA check used unauthenticated `git ls-remote`; the repair replaced it with an authenticated read-only GitHub API check using `github.token`. | W13 | resolved by 1c22eb9 |
| 2026-11-12 | Replaced the unauthenticated `git ls-remote` release-SHA guard with a `contents: read` GitHub refs API check using `github.token`, `pipefail`, and a fail-closed JSON SHA comparison; focused and full close-out checks pass. | W13 | 1c22eb9 |
| 2026-11-12 | Operator approved Gate 3 after the authenticated SHA-guard repair and close-out verification; branch is ready for normal integration. | W13 | owner approval |

### D~8 — Deploy Hook cannot carry an exact commit SHA

- **Found:** 2026-11-12 during final Attacker review.
- **What:** Vercel Deploy Hooks are branch-bound and accept no commit payload; the workflow therefore cannot cryptographically bind the hook request to `${{ github.sha }}` without introducing a Vercel API credential or a writable deployment branch.
- **Consequence:** A new push to `main` in the narrow interval after the remote-SHA check and before the hook request could theoretically make the hook deploy a newer commit than the migrated one.
- **Action:** Added the strongest tokenless mitigation in scope: immediately before the hook, CI compares `refs/heads/main` with `${{ github.sha }}` and fails closed if they differ; concurrency remains serialized and the next queued run migrates the newer commit. Exact SHA binding remains a post-merge operational limitation of the approved Deploy Hook design.

### D~7 — Full typecheck unavailable during Wave 1

- **Found:** 2026-11-12 during T1/T2 close-out.
- **What:** The repository-wide typecheck could not resolve existing frontend dependencies (`@firebase/*`, `vitest`, and `@testing-library/*`) in the current checkout; DB and workflow-specific checks passed.
- **Consequence:** Initially blocked Wave 1 verification.
- **Action:** Resolved 2026-11-12 by installing locked dependencies and regenerating Prisma Client; the full Wave 1 checks now pass.

### Handover — post-merge production execution

- **Owner:** repository owner.
- **When:** after this branch is approved and merged to `development`, then promoted to `main` through the normal release PR.
- **Steps:** confirm the protected GitHub production Environment approval, observe the tokenless migration/build workflow, and record the resulting production deployment/migration evidence. No Vercel token is used.

### D~5 — Tokenless production sequencing race

- **Found:** 2026-11-08 during final T6 review.
- **What:** Vercel is configured to auto-deploy every commit pushed to `main`, while the GitHub workflow runs the production migration concurrently.
- **Consequence:** A production deployment could become live before its migration completes; Gate 3 is paused until sequencing is fixed or explicitly accepted by the owner.

### C~8 — Sequence production through a Deploy Hook

- **Date:** 2026-11-09
- **Who asked:** operator.
- **Decision:** Disable Vercel production Git auto-deploy and invoke an owner-created production Deploy Hook only after the protected migration/build workflow succeeds. Store only the hook URL in the protected GitHub Environment; no Vercel token is used.

### C~9 — Retire protected production migration/deployment

- **Date:** 2026-11-09
- **Who asked:** operator.
- **Decision:** Remove T6's protected production workflow and Deploy Hook requirement. Production migration/deployment is an owner-operated manual handover documented in the runbook.

### C~10 — Correct Neon project identity by tier

- **Date:** 2026-11-09
- **Who asked:** operator.
- **Decision:** `APP_TIER=dev` must use Neon project `falling-rice-06970921`; `APP_TIER=prod` must use Neon project `super-sunset-36592949`.
- **Why:** The development and production databases are separate Neon projects; the immutable target map must reject cross-tier project observations.

### C~11 — Require the confirmed development Neon host

- **Date:** 2026-11-09
- **Who asked:** operator.
- **Decision:** `APP_TIER=dev` requires host `ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech` together with project `falling-rice-06970921`; production retains its existing host and project `super-sunset-36592949`.
- **Why:** The development project identity changed, but the confirmed pooled endpoint remains the active dev database host; both fields must be validated together to prevent cross-tier substitutions.

### C~12 — Keep AD-32 and restore protected production CI

- **Date:** 2026-11-12
- **Who asked:** operator.
- **Decision:** Keep AD-32. Production migrations and deployments must run from protected CI; reverse W13 C~9's owner-operated manual handover. Restore a protected production workflow, run the checked-in migration wrapper there, and trigger production deployment only after migration succeeds.
- **Why:** The manual runbook and Vercel auto-deploy race can expose new application code to an old schema; CI provides the required ordering and review boundary.
- **Rejected:** Manual owner execution of the migration wrapper or direct Prisma commands, and retaining Vercel's unrestricted automatic production deployment.

### C~13 — Bind recovery to the confirmed direct host

- **Date:** 2026-11-12
- **Who asked:** operator, by supplying the recovery connection host.
- **Decision:** Amend C~3 so the W13 recovery exception accepts only project `falling-rice-06970921`, branch `w13-recovery-baseline`, database `neondb`, and direct host `ep-purple-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech`. The URL host and supplied observations must equal this code-owned entry; pooled hosts are not accepted for recovery seed/migration operations.
- **Why:** Labels beside an arbitrary URL are not proof of Neon branch identity; the owner-confirmed direct host gives the recovery operation one exact target.
- **Rejected:** C~3's former acceptance of any non-production host with matching operator-supplied labels, and using the synthetic test host as production configuration.

### C~14 — Disable Vercel Git deployment for `main` in the repository

- **Date:** 2026-11-12
- **Who asked:** operator.
- **Decision:** Add the root `vercel.json` configuration with `git.deploymentEnabled.main = false`; production deployments are initiated only by the protected post-migration Deploy Hook.
- **Why:** The Vercel dashboard exposes the `main` branch tracking but no separate automatic-production-deployment switch; repository configuration provides an auditable, reviewable gate that preserves preview deployments.
- **Rejected:** Disabling custom-domain assignment, disconnecting the Git repository, or retaining automatic production deployment.

### C~15 — Separate production runtime and migration endpoints

- **Date:** 2026-11-12
- **Who asked:** operator, after confirming the Neon production connection details.
- **Decision:** Keep `ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech` for application runtime and use `ep-summer-heart-b3767eul.c-4.ap-southeast-1.aws.neon.tech` for `DIRECT_DATABASE_URL` migrations.
- **Why:** Runtime traffic benefits from pooling, while Prisma migrations require the stable direct endpoint; the Neon console confirms the non-pooled host.
- **Rejected:** Using the pooled host for `DIRECT_DATABASE_URL` or using the recovery host for production.

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
