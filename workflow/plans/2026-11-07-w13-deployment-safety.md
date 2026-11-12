# W13 Deployment Safety Corrections — Implementation Plan

- **Status:** Approved (operator, 2026-11-07)

> **For agents:** tick each checkbox as it is completed. Keep the W13 branch state current. Spec: [W13 deployment safety design](../specs/2026-11-07-w13-deployment-safety-design.md).

## Scope

**Goal:** Make W13 deployment evidence, seed writes, migrations, and production startup fail closed against wrong-tier or stale configuration.

**In scope:** protected Vercel metadata verification; one code-owned tier target map; seed target validation; complete migration-manifest enforcement; child-process secret minimization; production Vercel environment mapping and unconditional resource validation.

**Non-goals:** product endpoints, Prisma schema changes, Neon restore, live SoCLaaS checks, or production promotion.

**Risk tier:** High — deployment identity, production database writes, migration execution, and secrets are affected.

## Task order

| Task | Outcome | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|---|
| T1 | Verify the current Vercel deployment from protected metadata | — | T2, T3 | 1 | Done |
| T2 | Create the canonical tier target loader and protect seed execution | — | T1, T3 | 1 | Done |
| T3 | Enforce every migration manifest entry and minimize child environments | — | T1, T2 | 1 | Done |
| T4 | Separate Vercel environment names and require dev/prod resources | T2 | T1, T3 | 2 | Done |
| T5 | Integrate, run the full verification suite, and record evidence | T1, T2, T3, T4 | — | 3 | In review |

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1, F5, N4 | T1 | Vercel verifier, service-fixture, and workflow contract tests; E1, E2, E3, E4, E13-E14, E21-E22, E26-E27 |
| F2, N2 | T2 | Seed target tests; E5, E6, E7, E15-E16, E23, E28 |
| F3, F6, N1, N2 | T3 | Migration procedure tests and executor spy; E8-E9, E12, E17-E18, E24-E25, E29 |
| F4, N3 | T4 | Auth settings tests and manifest parity test; E10-E11, E19-E20 |
| N1 | T1, T3, T4 | Redaction assertions in Vercel, migration, and settings tests; E12 and E25 |

## Verification gates

- Per task: focused tests for the touched files, `npm run lint`, and `npm run typecheck` when TypeScript changes.
- Before finishing: `npm test`, `npm run lint`, `npm run typecheck`, `npm run check:workflows` with PR arguments, `npm run check:agent-policy`, `npm run scan:secrets`, and `git diff --check`.
- No live Vercel, Neon, Firebase, or SoCLaaS credentials are used by local tests.

### T1: Verify the current Vercel deployment

**Delivers:** The protected development check validates the deployment selected by the current GitHub Vercel check, not values supplied by the workflow. **Satisfies:** F1, F5, N1, N2, N4. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `.github/workflows/w13-dev-check.yml` | Add the protected `w13-development-verification` environment (required reviewer, development-only restriction, CODEOWNERS protection) and branch-scoped read-only token only to a fixed pre-checkout metadata step; poll GitHub check runs, fetch Vercel deployment/alias metadata, write sanitized JSON to `$RUNNER_TEMP/w13-vercel-metadata.json`, clear the token, then checkout and run the verifier without the token. |
| Modify | `scripts/w13/verify-dev-deployment.mjs` | Preserve the object-shaped API; remove caller-controlled manifest identity and validate immutable project, alias, deployment UID, commit, readiness, and creation-time fields. |
| Modify | `tests/w13/dev-deployment.test.ts` | Add wrong project, wrong commit, non-ready, wrong alias owner, stale same-SHA, sanitized-result, and malformed metadata cases. |
| Create | `tests/w13/dev-workflow.test.ts` | Inspect workflow structure for pre-checkout lookup, exact environment/token scope, no PR trigger, no token in later steps, polling, sanitized handoff, `GITHUB_SHA`, and `github.event.head_commit.timestamp`. |
| Create | `tests/w13/vercel-metadata.test.ts` | Exercise a deterministic HTTP/service fixture for current-commit check lookup, exact deployment UID, readiness polling, alias ownership, malformed/unauthorized responses, timeout, and redacted failures. |

**Checklist**

- [x] 1. Write failing verifier tests for E1-E3, E13, E26 and N1/N2.
- [x] 2. Implement immutable verifier validation while preserving existing callers.
- [x] 3. Write failing workflow contract tests for E4, E14, E21-E22 and E27.
- [x] 4. Implement the fixed pre-checkout lookup with `GITHUB_TOKEN` for the current commit's GitHub check and the protected read-only `VERCEL_TOKEN` for Vercel; poll every 10 seconds for five minutes, write only allowlisted metadata to `$RUNNER_TEMP/w13-vercel-metadata.json`, clear token-bearing variables, and never print response bodies or tokens.
- [x] 5. Run focused W13 tests and workflow validation; expect green.
- [x] 6. Update branch-state Progress and Changes, then commit `fix: verify the current Vercel deployment (W13)` with `Workstream: W13` and `Task: T1`.

**Notes for next task:** The Vercel API response is normalized before checkout; deployment timestamps may be numeric milliseconds or ISO text. The workflow validator now permits an environment only for the trusted development push workflow; PR workflows remain prohibited.

### T2: Canonical tier targets and seed protection

**Delivers:** Seed validation uses one code-owned target map and cannot be bypassed by a supplied client. **Satisfies:** F2, N2. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `src/be/db/src/tier-targets.ts` | Export the validated canonical target map and target parser for local, dev, preview, prod, and test, including host, project, database name, branch, and Vercel environment; this is the only runtime allowlist source. |
| Modify | `src/be/db/src/index.ts` | Export the shared target loader used by auth and seed code. |
| Modify | `src/be/db/prisma/seed.ts` | Remove the production client-injection parameter; validate tier, URL protocol/host/database path, and project observation through `getTierTarget` before constructing Prisma. Keep test injection behind the unexported `runSeedWithFactory(env, createClient)` helper, which is callable only by the test module. |
| Modify | `workflow/deployment/tier-manifest.json` | Add mandatory `vercelEnv` and `databaseName` fields while retaining `env` as the application tier. |
| Modify | `src/be/db/test/seed.test.ts` | Add canonical positive fixtures, every cross-tier mismatch, malformed URL, supplied-client zero-call, and constructor-not-called cases. |

**Checklist**

- [x] 1. Write failing target-loader and seed tests for E5-E7, E15-E16, E23 and E28.
- [x] 2. Implement the canonical target loader and manifest schema fields.
- [x] 3. Implement pre-construction seed validation and the isolated test seam.
- [x] 4. Run focused seed/target tests and Prisma validation; expect green.
- [x] 5. Run `npm run lint` and `npm run typecheck`.
- [x] 6. Update branch-state Progress and Changes, then commit `fix: bind seed writes to canonical tier targets (W13)` with `Workstream: W13` and `Task: T2`.

**Notes for next task:** The shared loader owns the runtime tier allowlist and validates URL host/database path plus `NEON_HOST`/`NEON_PROJECT` observations. The seed entry point no longer accepts an injected client, so mismatches fail before Prisma construction.

### T3: Enforce migration manifest and child-process safety

**Delivers:** Every committed migration is checksum-bound before Prisma runs, and child processes cannot receive the direct URL or unrelated secrets. **Satisfies:** F3, F6, N1, N2. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `scripts/w13/migrate-production.mjs` | Discover all repository migration SQL files, parse and compare exact manifest sets, validate direct URL through the shared canonical target loader, expose `executor(file, args, options) => Promise<{ stdout, stderr }>`, and pass an explicit allowlisted child environment with a derived validated `DATABASE_URL`. |
| Modify | `src/be/db/test/w13-migration.test.ts` | Add missing/extra/duplicate/unsorted/malformed/read/checksum/target failures, zero executor-call assertions, success call order, environment allowlist, and redaction cases. |
| Modify | `workflow/deployment/migrations.manifest` | Keep the sorted raw-byte checksum format valid for the complete migration set. |

**Checklist**

- [x] 1. Write failing tests for E8-E9, E12, E17-E18, E24-E25 and E29.
- [x] 2. Implement exact migration discovery and manifest set equality.
- [x] 3. Implement direct-target validation through `getTierTarget('prod')` and the explicit executor signature `(file, args, options) => Promise<{ stdout: string; stderr: string }>`.
- [x] 4. Implement the allowlisted child environment and derived `DATABASE_URL`.
- [x] 5. Run focused migration tests and Prisma validation; expect green.
- [x] 6. Update branch-state Progress and Changes, then commit `fix: enforce migration evidence before deploy (W13)` with `Workstream: W13` and `Task: T3`.

**Notes for next task:** The runner validates the repository migration-file set and raw-byte checksums before either executor call. The executor receives only a derived `DATABASE_URL` plus a small process allowlist; the production runner is invoked with the repository's TypeScript loader available.

### T4: Correct production environment validation

**Delivers:** Production startup uses Vercel `production`, requires complete resource identity, and keeps preview credential-free. **Satisfies:** F4, N1, N3. **Depends on:** T2. **Wave:** 2.

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `src/be/auth/src/settings.ts` | Import the shared `getTierTarget` loader, add separate `vercelEnv` comparison, and call resource validation unconditionally for dev/prod while enforcing the preview denylist. |
| Modify | `src/be/auth/test/tier-settings.test.ts` | Add complete dev/prod fixtures, one missing/mismatched field per production resource, wrong Vercel env/ref cases, and preview credential isolation. |
| Modify | `src/be/auth/test/settings.test.ts` | Add production startup success and missing-resource rejection coverage. |

**Checklist**

- [x] 1. Write failing tests for E10-E11, E19-E20 and N1/N3.
- [x] 2. Implement shared-map resource validation and production `vercelEnv=production` behavior.
- [x] 3. Verify preview credential denial and error redaction.
- [x] 4. Run focused auth tests, `npm run lint`, and `npm run typecheck`.
- [x] 5. Update branch-state Progress and Changes, then commit `fix: enforce production deployment identity (W13)` with `Workstream: W13` and `Task: T4`.

**Notes for next task:** Auth now imports the same canonical target loader as seed and migration. Dev/prod resource validation is unconditional; production requires Vercel `production` and `main`, while preview remains credential-free.

### T5: Integration and close-out

**Delivers:** All four corrections are integrated, verified, and handed to the owner for Gate 3 review. **Depends on:** T1, T2, T3, T4. **Wave:** 3.

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `workflow/project-state/branch-states/w13-deployment.md` | Serialize task updates, record task completion, verification evidence, handover, and Gate 3 status. |
| Test | `package.json` scripts and CI workflow checks | Run the full project and security checks listed below. |

**Checklist**

- [x] 1. Reconcile all task checklists, branch state, spec status, and this plan.
- [x] 2. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run check:workflows -- --base-sha "$(git rev-parse origin/development)" --base-branch development --pr-number 18 --bootstrap-pr-number 18`, `npm run check:agent-policy`, `npm run scan:secrets`, and `git diff --check`.
- [x] 3. Review the complete branch diff and resolve confirmed findings; do not treat a provider check or local fixture as production approval.
- [x] 4. Set W13 to `In review`, clear the session row, and record all evidence and handover items in branch state.
- [ ] 5. Ask the owner for Gate 3 branch review. Do not push, open, or merge from this task without the owner's review approval.

Task implementation is performed inline on this branch, so branch-state updates and commits serialize the otherwise independent waves. The Vercel metadata request runs before checkout in the protected workflow step; checked-out code receives only sanitized metadata. T2 creates the shared validated tier-manifest loader; auth and migration import that loader, and T4 depends on T2.
