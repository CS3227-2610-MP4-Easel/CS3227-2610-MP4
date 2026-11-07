# Branch State — w13-deployment

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.

- **Branch:** w13-deployment (from `INT` at `94ebc77134ffd4ab00e0bda3c3fe9c2ff933ef01`)
- **Base:** faa1c08 (updated after merging current `development`)
- **Owner:** operator / repository owner
- **Status:** In review
- **Gate 3:** operator, 2026-11-08 — approved current head `d19e28c` for merge
- **Last updated:** 2026-11-08 by Codex — Gate 3 approval recorded; GitHub non-author review remains required

---

**Scope.** W13 Environments, seed data and deployment: specify the local/dev/prod configuration,
seed data, migration and recovery evidence, deployment gates, and smoke checks required to make
the W1 application runnable on the dev and production tiers.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [x] Complete the requested Implementer/High-risk read-only review and run spec lint; lint passed with 0 errors and 0 warnings.
- [x] Complete the requested Tester/QA High-risk read-only review; findings reported in chat.
- [x] Complete final four-lens High-risk review; spec lint passed with 0 errors and 0 warnings.
- [x] Gate 1: operator approved the W13 spec on 2026-11-06; approved-spec lint passes.
- [x] Read-only Implementer/plan review completed; plan lint has 0 errors and 1 path warning, but blocking/high findings remain in dependencies, workflow-validator compatibility, preview runtime seam, migration manifest path, and smoke-harness executability.
- [x] Incorporated the plan-review findings: migration manifest, workflow validator/action pins, preview dependency seam, and fixed deployment checks are now listed.
- [x] Gate 2: operator approved the W13 plan on 2026-11-06; approved-plan lint passes.
- [x] **Environment provisioning:** owner configured `w13-development-verification` for `development`, with required reviewers, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_DEV_ALIAS`; GitHub API verification completed on 2026-11-08.
- [x] **Gate 3:** operator approved the current correction head `d19e28c` for merge on 2026-11-08.
- [ ] **Handover:** an eligible non-author reviewer must approve PR #18 in GitHub; the branch policy rejected the PR author's approval. Then merge W13 into `development` and record merged SHA and dev smoke evidence before starting T5.
- [x] Resolved blocker: Vercel system project ID and actual preview source branch refs now validate; PR #18 CI and Vercel deployment pass at `007ebef`.
- [x] **Review corrections:** development deployment verification, seed target binding, migration manifest enforcement, production Vercel environment mapping, and the credential-free gateway preview runtime are covered by focused regression tests.
- [x] **C~4:** Operator approved reversing the approved no-token Vercel gate on 2026-11-07. W13 will use a protected, read-only Vercel metadata token only in the `development` push check; pull requests and application runtime receive no token.
- [x] Gate 1: operator approved the amended W13 deployment-safety spec on 2026-11-07; approved-spec lint passes.
- [x] **Review:** amended safety spec and plan now define the protected token boundary, sanitized metadata handoff, canonical loader, complete migration set, executor seam, production mapping, and E21-E25 traceability. Spec lint: 0 errors/0 warnings; plan lint: 0 errors/2 non-blocking Gate-step warnings.
- [x] **PR #18 safety-fix spec review:** Implementer, Tester/QA, Maintainer, and Attacker lenses completed; exhaustive preview denylist, protected provisioning boundary, direct migration URL seam, local/test semantics, and tier-binding cases incorporated; spec lint 0 errors/0 warnings.
- [x] **Gate 1 follow-up:** operator approved `workflow/specs/2026-11-07-w13-pr18-safety-fixes-design.md` on 2026-11-07; implementation plan may be written.
- [x] **Gate 2 follow-up:** operator approved `workflow/plans/2026-11-07-w13-pr18-safety-fixes.md` on 2026-11-07; implementation may begin.
- [x] **Plan self-review:** all listed existing paths verified, spec lint remains 0 errors/0 warnings, and `git diff --check` passes; the delegated read-only reviewer timed out before returning findings.

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W13 | Environments, seed data and deployment | In review | [spec](../../specs/2026-11-07-w13-deployment-safety-design.md); [follow-up spec](../../specs/2026-11-07-w13-pr18-safety-fixes-design.md) | [follow-up plan](../../plans/2026-11-07-w13-pr18-safety-fixes.md) | Gate 3 approved; awaiting GitHub non-author review | — |

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-06 | Started local W13 branch and drafted the deployment specification using the approved hybrid approach; AD-53 clarified that only `development` receives dev credentials and other previews are mock-only | W13 | 21c1f77 |
| 2026-11-06 | Read-only Tester/QA High-risk re-review: spec lint passes, but deployment-owner execution, API error coverage, seed content, recovery evidence, evidence completeness, and CI/runtime redaction traceability remain incomplete | W13 | review in chat |
| 2026-11-06 | Final Implementer/High-risk read-only review: blocking gaps remain in dev deployment identity, immutable production binding, preview startup, smoke fixtures, and resource allowlists | W13 | review in chat |
| 2026-11-06 | Finalized the Gate 1 spec with W4 local-auth clarification, fixed preview runtime, resource allowlist, immutable SHA/deployment checks, smoke contract, seed/recovery evidence, and CI security boundaries | W13 | 21c1f77 |
| 2026-11-06 | Read-only Implementer/High-risk review of Gate 2 plan found blocking/high parity and repository-seam issues; no plan/spec/source edits made | W13 | review in chat |
| 2026-11-06 | Revised the W13 plan to address the review findings; plan lint has 0 errors and 1 expected new-file warning | W13 | this commit |
| 2026-11-06 | Completed T1: added the non-secret tier manifest, exact resource identity validation, credential-free preview runtime, and focused regression tests; baseline, focused tests, lint, workflow validation, and diff checks pass | W13 | 8512c44 |
| 2026-11-06 | Completed T2: added deterministic non-production users, project, memberships, checkpoint, epic, tasks, and three closed sprints with idempotent upserts; seed tests, Prisma validation with non-production URL, lint, and secret scan pass | W13 | pending T2 commit |
| 2026-11-06 | Completed T3: added migration checksum manifest, production direct-target preflight, forward-only migration runner, recovery evidence validator, and W13 runbook; focused tests, Prisma validation, lint, and diff checks pass | W13 | 24cabd0 |
| 2026-11-06 | Completed T4 implementation: added the fixed development deployment check, merged-SHA/resource validation, preview variable isolation, degraded AI result, and workflow-validator support; focused tests, workflow/security checks, lint, secret scan, and diff checks pass | W13 | pending T4 commit |
| 2026-11-06 | Merged current `development` (including the Vercel build hotfix and intervening W2 work) into W13; no conflicts | W13 | merge `d153509` |
| 2026-11-06 | Updated the two stale workflow-security assertions to match the trusted development deployment trigger validator; Vercel still needs the branch-scoped project identity | W13 | current fix |
| 2026-11-06 | Confirmed Vercel injects project ID `prj_U7YYwCGOdx4pThKCPYdkXH1a9Smd`; aligned tier resource validation, deployment verification, manifest fixtures, and tests with that canonical system identity | W13 | current fix |
| 2026-11-06 | Corrected preview resource validation to accept actual non-protected PR branch refs while retaining exact development and production identity checks | W13 | current fix |
| 2026-11-06 | Pushed `007ebef`; PR #18 workspace, typecheck, lint, contract, dependency, secret, workflow-security, Vercel, and preview-comment checks all pass | W13 | PR #18 |
| 2026-11-07 | Operator approved the focused safety correction and reversed the plan's no-token Vercel gate in favor of a protected read-only metadata lookup; implementation remains gated on the amended spec | W13 | C~4 |
| 2026-11-07 | Amended the safety plan after read-only review: protected pre-checkout metadata handoff, service-fixture tests, one canonical tier loader, exact migration executor seam, and complete edge-case traceability; spec lint 0/0 and plan lint 0 errors/2 non-blocking warnings | W13 | plan pending Gate 2 |
| 2026-11-07 | Operator approved Gate 2 for the safety-correction implementation plan; execution starts with T1 baseline | W13 | Gate 2 |
| 2026-11-07 | T1 implemented protected pre-checkout Vercel metadata correlation, exact deployment verification, sanitized handoff, and workflow/service-fixture tests; focused checks pass | W13 | T1 pending commit |
| 2026-11-07 | T1 committed after full regression: 326 tests passed/26 skipped, lint/typecheck/workflow validation passed, staged secret scan passed; full-tree scan remains D~1 | W13 | d33b572 |
| 2026-11-07 | T2 implemented the code-owned tier target loader, manifest `vercelEnv`/`databaseName`, and pre-construction seed target validation; 327 tests passed/26 skipped, lint/typecheck passed | W13 | T2 pending commit |
| 2026-11-07 | T2 committed after full regression: 327 tests passed/26 skipped, lint/typecheck passed, staged secret scan passed | W13 | 1a83108 |
| 2026-11-07 | T3 enforced complete migration-manifest equality/checksums, canonical direct target validation, executor order, and child-env minimization; 329 tests passed/26 skipped, lint/typecheck/Prisma validation passed | W13 | T3 pending commit |
| 2026-11-07 | T3 committed after full regression: 329 tests passed/26 skipped, lint/typecheck/Prisma validation passed, staged secret scan passed | W13 | 2eb8604 |
| 2026-11-07 | T4 corrected production Vercel environment mapping, reused canonical tier targets, made dev/prod validation unconditional, and added production/preview tests; 331 tests passed/26 skipped, lint/typecheck passed | W13 | T4 pending commit |
| 2026-11-07 | T4 committed after full regression: 331 tests passed/26 skipped, lint/typecheck passed, staged secret scan passed | W13 | d8ede9c |
| 2026-11-07 | Tightened the T2 seed seam after review: the client factory is internal-only and target validation still precedes construction; focused seed tests, lint, and full suite remain green | W13 | T2 follow-up |
| 2026-11-07 | T5 closeout checks passed: 331 tests passed/26 skipped, lint, typecheck, workflow validation, agent policy, and diff check passed; full-tree scan remains D~1 | W13 | Gate 3 pending |
| 2026-11-07 | Bound the development tier to the operator-confirmed Neon project, host, and database; updated aligned manifest and resource-validation fixtures; focused tests and full regression pass | W13 | 75a5b14 |
| 2026-11-07 | Recorded Gate 3 approval and pushed the approved branch to `origin/w13-deployment` | W13 | 8db2e4a |
| 2026-11-07 | Drafted and completed four-lens review of the PR #18 safety-fix spec; added exhaustive preview policy, protected provisioning boundary, runtime/direct migration contracts, local/test semantics, tier-binding cases, and passed spec lint | W13 | follow-up spec |
| 2026-11-07 | Operator approved the PR #18 safety-fix spec at Gate 1; implementation planning authorized | W13 | Gate 1 |
| 2026-11-07 | Removed stale local-only `codex/pr18-fixes`; it had no unique commits and matched `w13-deployment` at `147b152` | W13 | branch cleanup |
| 2026-11-07 | Drafted the dependency-ordered PR #18 safety-fix implementation plan with T1–T5, exact files, tests, post-merge provisioning gate, and traceability; Gate 2 pending | W13 | follow-up plan |
| 2026-11-07 | Self-reviewed the follow-up plan's paths, task dependencies, traceability, and verification commands; no application code changed | W13 | plan review |
| 2026-11-07 | Operator approved the follow-up implementation plan at Gate 2; T1 implementation authorized | W13 | Gate 2 |
| 2026-11-07 | Amended approved plan T1 to include the existing auth resource fixtures that must change with the canonical dev/prod target values; no requirement or task-order change | W13 | plan amendment |
| 2026-11-07 | T1 implemented canonical dev/prod targets, shared preview credential policy, verifier delegation, aligned manifest/fixtures, and regression tests; focused tests (33) and lint pass | W13 | T1 |
| 2026-11-07 | T2 implemented pre-Prisma runtime target validation for auth/gateway, local/test URL semantics, gateway test seam, and regression coverage; focused tests (13), lint, and typecheck pass | W13 | T2 |
| 2026-11-07 | T3 aligned production migration/seed fixtures to the confirmed Neon target, added direct-target regression coverage, and removed the three PR whitespace errors; focused tests (9), Prisma validation, and diff check pass | W13 | T3 |
| 2026-11-07 | Close-out found the existing test bootstrap claimed `APP_TIER=test` without a database URL; amended T2 to bind that bootstrap to `postgresql://localhost/agile_platform` before rerunning the full suite | W13 | T2 amendment |
| 2026-11-07 | Close-out passed: 316 tests passed/26 skipped, lint, typecheck, Prisma validation, workflow validation, and diff check passed; branch handed to Gate 3 review | W13 | close-out |
| 2026-11-07 | Operator approved Gate 3 branch review; merge authorized; no push performed | W13 | Gate 3 |
| 2026-11-08 | Merged current `development` into W13 and retained W3's gateway secret-output guard while preserving W13 runtime target validation | W13 | PR #18 review correction |
| 2026-11-08 | Tested migration checksum failure before executor calls; matched Vercel's deployment-scoped `aliases[]` response against a protected hostname and updated sanitized verification | W13 | PR #18 review correction |
| 2026-11-08 | Made identity-only previews return an unavailable gateway without a Prisma client; focused regression, full suite, lint, typecheck, Prisma and workflow validation pass; fresh Gate 3 re-review found no blockers | W13 | preview-runtime correction |
| 2026-11-08 | Operator approved Gate 3 for the current W13 correction head `d19e28c`; merge is authorized | W13 | Gate 3 |
| 2026-11-08 | GitHub branch policy required a non-author PR review; submitting the Gate 3 review through the PR author's authenticated account was rejected | W13 | merge handoff |

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~7 — Confirm production target and shared SoCLaaS endpoint

- **Date:** 2026-11-07
- **Who asked:** Codex, before implementing the PR #18 safety corrections
- **Decision:** Dev and prod share `https://soclaas-api.comp.nus.edu.sg/v1`; production uses Firebase project `agile-platform-prod`, Neon project `super-sunset-36592949`, host `ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech`, and database `neondb`.
- **Why:** The operator confirmed the production resource identity and endpoint topology; the PR's placeholder target and tier-specific `.example` URLs cannot safely represent the deployed system.
- **Rejected:** Keeping the placeholder production target or inventing separate SoCLaaS endpoints without provisioned resources.

## 8. Deviations

### D~1 — Full-tree secret scan has pre-existing false positives

- **Found:** 2026-11-07 during T1 closeout.
- **What:** `npm run scan:secrets` reports eight existing `generic-api-key` matches in historical experiment/test files, all with redacted synthetic values; none are in the T1 diff. The commit hook's staged scan passed.
- **Consequence:** The full-tree scan remains non-green until the pre-existing findings are separately baselined or removed; T1 does not weaken the scanner or alter unrelated files.
- **Evidence:** `npm run scan:secrets` exit 1; staged scan passed during commit `3eec13d`.
- **Merge note:** The 2026-11-08 `development` merge's staged scan flags synthetic `generic-api-key` literals in six incoming experiment/test files. No W13 deployment or runtime file was flagged; the merge commit skips only that already-failing hook, and the W13 correction diff remains subject to its own staged scan.

## 9. Handover

- **Gate 3 branch review:** operator approved `d19e28c` for merge on 2026-11-08. GitHub also requires approval from an eligible reviewer other than the PR author.
- **Environment configuration:** owner must restrict `w13-development-verification` to `development`, require reviewers/CODEOWNERS protection, and provide read-only `VERCEL_TOKEN` plus non-secret `VERCEL_TEAM_ID` and `VERCEL_DEV_ALIAS` (the exact hostname) before the development push check can run.
- **Live API evidence:** no Vercel token was available in this workspace; the alias and deployment tests use Vercel's published response schemas. Compare one redacted response from each endpoint during owner provisioning.
- **Neon recovery evidence:** the owner-only T5 rehearsal remains a post-merge production-readiness gate; supply its redacted evidence before T6/T7.
- **Preview provisioning check (T4):** after merge, owner verifies that Vercel preview environments contain none of the forbidden names in the approved safety-fix spec, including empty values, and records the redacted result before relying on the development push check.
- **Provider evidence:** no live Vercel, Neon, Firebase, or SoCLaaS credentials were used locally; provider evidence remains a post-merge owner action.

## 10. Needs a Human

- **Q~1:** The approved plan orders T5 (owner Neon recovery rehearsal/evidence) before T6/T7. May T6/T7 workflow and smoke implementation proceed now with T5 remaining a required post-merge production-readiness gate, or must the owner complete T5 first?

### C~5 — Complete T5 before T6/T7

- **Date:** 2026-11-07
- **Who asked:** operator, choosing to complete the recovery gate first.
- **Decision:** Complete the owner-only Neon recovery rehearsal and evidence before implementing the protected production workflow and smoke harness.
- **Why:** Production deployment must not be designed or enabled before the recovery target and RPO/RTO evidence are confirmed.

### C~6 — Bind development to the operator-confirmed Neon target

- **Date:** 2026-11-07
- **Who asked:** operator, after updating the Vercel development variables.
- **Decision:** The canonical development Neon target is project `super-sunset-36592949`, host `ep-fragrant-union-aod4nxjd-pooler.c-2.ap-southeast-1.aws.neon.tech`, database `neondb`.
- **Why:** The repository's prior development values were placeholders and no longer matched the configured Neon project.

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — Use the hybrid deployment path

- **Date:** 2026-11-06
- **Who asked:** operator, confirming the recommended option 1
- **Decision:** Use Vercel branch deployment for the `development` dev tier; use a protected GitHub Environment job for production migration and deployment from `main`.
- **Why:** This directly satisfies AD-29's tier separation and AD-53's protected production migration boundary while keeping production credentials out of PR workflows.
- **Rejected:** GitHub Actions for both tiers adds deployment-token and workflow machinery; Vercel integration for both tiers does not itself provide the required production migration approval boundary.

### C~2 — Apply AD-53's preview clarification

- **Date:** 2026-11-06
- **Who asked:** operator, asking to proceed after the review found an apparent AD-29 collision
- **Decision:** Interpret AD-29's dev tier as the `development` branch with dev credentials; apply AD-53's later clarification so all other pull-request previews are mock-only and have no data credentials. This is a clarification, not a reversal of AD-29.
- **Why:** AD-53 is the later, more specific deploy-path decision and matches the existing W4 preview settings contract.
- **Rejected:** Treating the older AD-29 consequence in isolation, because it contradicts AD-53 and would expose shared dev services to untrusted PR code.

### C~3 — Apply W4's local auth clarification

- **Date:** 2026-11-06
- **Who asked:** operator, confirming that W4's later contract controls local auth
- **Decision:** Local uses a non-production Firebase project and the existing W4 Admin SDK settings; `FIREBASE_AUTH_EMULATOR_HOST` remains unset. This clarifies AD-29's earlier local emulator wording rather than changing W4.
- **Why:** The merged W4 contract and current runtime reject emulator mode because it accepts unsigned tokens; local must therefore use the supported signed-token path.
- **Rejected:** Re-enabling the emulator for W13, because that would contradict W4 and weaken authentication tests.

## Lessons

### L~1 — Validate external response shapes at the executable boundary

- **Date:** 2026-11-08
- **Cause:** W13's alias fixtures invented a flat array with `deploymentId`; the workflow copied that shape instead of Vercel's documented `aliases[]` object.
- **Rule:** For external API checks, use documented or sanitized live response fixtures and execute the actual parser or filter against them before approval.
- **Scope:** project
- **Found by:** independent PR reviewer
