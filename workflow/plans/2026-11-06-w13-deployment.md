# W13 Environments, seed data and deployment — Implementation Plan

- **Status:** Approved (operator, 2026-11-06)

> Amended 2026-11-08 under branch-state C~5, then reversed by the operator: the removed automated development-check workflow/verifier remain retired. T4 is an owner-operated Vercel metadata plus health/auth/tier smoke gate; the W9 standup/AI probe is not required for T4.

> Amended 2026-11-07 under branch-state C~4: T4 now uses a protected, read-only Vercel metadata token for authoritative deployment verification; the former no-token external-gate wording is superseded for this check. The implementation keeps the token in the pre-checkout lookup step only.

> **For agents:** tick each checklist item as it is completed. Keep the branch-state Progress cell current. Spec: [W13 design](../specs/2026-11-06-w13-deployment-design.md).

## Scope

**Goal:** Make local, dev, preview, and production configuration, seed data, migrations, recovery evidence, and deployment checks runnable and tier-safe.

**In scope:** tier settings and resource manifest; DB-free mock previews; deterministic dev seed; forward migration checks; recovery runbook/evidence; owner-controlled dev deployment; protected production workflow; fixed post-deploy smoke harness.

**Non-goals:** new product endpoints or schema changes; hosted databases/auth/AI; automated restore tooling; scheduled workers; live SoCLaaS calls from CI tests.

**Risk tier:** High — secrets, authentication, tier boundaries, migrations, recovery, and production promotion require negative tests and operator evidence.

## Task order

| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 | — | T2 | 1 | Done |
| T2 | — | T1 | 1 | Done |
| T3 | T1 | — | 2 | Done |
| T4 | T1, T3 | — | 3 | Ready for owner gate |
| T5 | T3, T4 | — | 4 | Post-merge |
| T6 | T1, T3, T5 | T4 | 5 | Not started |
| T7 | T1, T4, T6 | — | 6 | Not started |

## Traceability

| Requirement / edge case | Task(s) | Verified by |
|---|---|---|
| F1, F2, F3, N1 | T1, T4 | tier-settings and workflow tests |
| F4, F5, N2 | T3, T5, T6 | migration/recovery checks and protected-job tests |
| F6 | T2 | seed integration tests |
| F7, N3 | T6, T7 | workflow and fixed smoke-harness tests |
| F8 | T3, T5 | recovery evidence validator and operator rehearsal |
| E1-E6 | T1, T3 | settings/migration tests |
| E7-E8, E20-E21, E28, E32, E37 | T2 | seed idempotency, content, secret, and target-binding tests |
| E9-E11, E14-E15, E17-E19, E24-E25, E31, E34-E35, E38-E39, E41-E44 | T6, T7 | smoke, SHA, resource, auth, header, and redaction tests |
| E12-E13, E16, E22-E23, E29, E33, E40 | T3, T5 | recovery preflight, runbook evidence, and manual rehearsal |
| E26-E27, E36 | T3, T4 | dev deployment and Prisma validation tests |

| E2 | T4 | preview variable-isolation workflow test |
| E3 | T1 | tier manifest mismatch test |
| E4 | T6 | protected production trigger test |
| E5 | T3, T6 | migration checksum test |
| E10 | T7 | forwarded-header variation test |
| E18 | T7 | pooled/direct connection evidence test |
| E30 | T6 | production-marker scan |
| E42 | T7 | degraded dev AI smoke test |
| E43 | T7 | Vercel header trust-boundary test |

## Verification gates

- Per task: run the affected package tests plus `npm run lint`; workflow-only changes also run `npm run check:workflows` and `npm run check:agent-policy`.
- Before close-out: run `npm test`, `npm run typecheck`, `npm run lint`, `npm run contract`, `npm --workspace @agile/db run prisma:validate`, `npm run scan:secrets`, and `git diff --check`.
- `GATE:` production credentials, Vercel/Neon/Firebase account changes, manual recovery, deploy, promotion, push, or PR creation require the repository owner’s explicit action.

---

### T1: Tier configuration, resource manifest, and preview runtime

**Delivers:** exact tier/resource validation and a credential-free preview that does not construct Prisma | **Satisfies:** F1, F2, F3, N1 | **Depends on:** — | **Wave:** 1

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `workflow/deployment/tier-manifest.json` | Versioned non-secret mappings for local/dev/preview/prod/test: branch, Vercel project/alias, Firebase project, Neon identity, SoCLaaS endpoint, and `env`. |
| Create | `workflow/deployment/migrations.manifest` | Deterministic list/hash input for committed Prisma migrations; the production job hashes this before loading secrets. |
| Modify | `src/be/auth/src/settings.ts` | Validate `APP_TIER` and exact manifest/resource identity before auth client construction; preserve W4 emulator rejection. |
| Modify | `src/be/auth/src/runtime.ts` | Return the existing preview `500 INTERNAL` behavior without constructing Prisma or Firebase when preview data settings are absent. |
| Modify | `src/be/db/src/client.ts` | Refuse client construction on credential-free preview and validate the resolved tier before connecting. |
| Modify | `src/be/api/src/deps.ts` | Select the DB-free preview dependency seam so `createApiApp` can serve health/UI-only previews without constructing auth or Prisma dependencies. |
| Modify | `src/be/auth/src/index.ts` | Expose the explicit preview runtime type/constructor contract used by API dependency wiring. |
| Create | `src/be/auth/test/tier-settings.test.ts` | Cover E1, E3, E15, E32, E37, E38 and N1 resource/secret mismatch cases. |
| Modify | `src/be/auth/test/settings.test.ts` | Preserve W4 settings and add C~3 local Firebase behavior coverage. |

**Checklist**

- [x] 1. Write failing settings/runtime tests for exact manifest matching, preview no-DB startup, emulator rejection, and cross-tier mismatch.
- [x] 2. Add the manifest and validation seam; ensure URLs/project IDs are not workflow inputs.
- [x] 3. Implement DB-free preview startup and the documented `500 INTERNAL` auth/data behavior.
- [x] 4. Run `node --import tsx --test src/be/auth/test/tier-settings.test.ts src/be/auth/test/settings.test.ts`; expect PASS.
- [x] 5. Run `npm run lint` and `npm run check:workflows`.
- [ ] 6. Update branch state and commit: `feat: bind runtime settings to deployment tiers`.

### T2: Deterministic non-production seed

**Delivers:** idempotent Tier 1 demo dataset with no secrets | **Satisfies:** F6 | **Depends on:** — | **Wave:** 1

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `src/be/db/prisma/seed.ts` | Seed PM, Dev Lead, Developer, project, memberships, checkpoints, epics, tasks, and three closed sprints with stable points; use non-production Firebase UIDs and deterministic keys. |
| Modify | `src/be/db/package.json` | Add the non-production seed command with explicit tier/host validation. |
| Create | `src/be/db/test/seed.test.ts` | Cover E7, E8, E20, E21, E28, E32, and E37; compare complete logical state after two runs. |
| Modify | `package.json` | Expose a root seed verification command without production defaults. |

**Checklist**

- [x] 1. Write failing seed tests for empty, repeated, invalid-tier, production-target, content, and secret cases.
- [x] 2. Implement deterministic keys and seed data; reject production and unsupported tiers before Prisma construction.
- [x] 3. Assert the full logical dataset is unchanged after a second run.
- [x] 4. Run the seed test and `npm --workspace @agile/db run prisma:validate`; expect PASS.
- [x] 5. Run `npm run scan:secrets`.
- [ ] 6. Update branch state and commit: `feat: add deterministic development seed data`.

### T3: Migration compatibility and recovery evidence

**Delivers:** forward migration preflight plus manual Neon recovery runbook/evidence validator | **Satisfies:** F4, F5, F8, N2 | **Depends on:** T1 | **Wave:** 2

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `scripts/w13/migrate-production.mjs` | Run `prisma validate` then `prisma migrate deploy` with `DATABASE_URL="$DIRECT_DATABASE_URL"` scoped to the process and cleared on failure/success; verify manifest/checksum and expand/contract compatibility. |
| Create | `scripts/w13/recovery-evidence.mjs` | Validate allowlisted evidence fields: backup reference, migration checksum, restore start/end, RPO, RTO, seed result, owner, outcome. |
| Create | `docs/operations/w13-deployment.md` | Operator runbook for backup check, manual Neon restore, corrected forward migration, seed reapplication, and evidence capture; no automated restore. |
| Create | `src/be/db/test/w13-migration.test.ts` | Cover E5, E6, E12-E13, E16, E22-E23, E27, E29, E33, E36, and E40. |

**Checklist**

- [x] 1. Write failing tests for Prisma validation, clean/previous compatibility, checksum, URL cleanup, recovery thresholds, target restrictions, and evidence completeness.
- [x] 2. Implement the migration preflight and exact Prisma commands from the spec.
- [x] 3. Implement evidence validation and write the manual recovery runbook.
- [x] 4. Run focused migration tests, `npm --workspace @agile/db run prisma:validate`, and `npm run lint`.
- [ ] 5. Update branch state and commit: `feat: add W13 migration and recovery controls`.

### T4: Manual development deployment evidence

**Delivers:** owner-merge dev deployment contract and dev-tier configuration | **Satisfies:** F2, F3 | **Depends on:** T1, T3 | **Wave:** 3

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `docs/operations/w13-deployment.md` | Document the owner-operated Vercel metadata inspection, exact alias-bound smoke requests, redacted evidence schema, and T4 completion gate. |
| Modify | `workflow/project-state/branch-states/w13-deployment-continuation.md` | Record the owner’s redacted T4 evidence and deployed SHA. |

**Checklist**

- [x] 1. Retire the removed automated dev-check workflow, verifier, and dedicated tests; preserve historical references only in audit records.
- [x] 2. Amend and approve the manual T4 evidence contract and runbook under C~5.
- [x] 3. Run the repository tests, workflow validator, agent-policy check, and secret scan after cleanup.
- [x] 4. `GATE:` repository owner confirms the merged `development` SHA, canonical project/alias from the tier manifest, `READY` deployment identity, and fixed health/auth/tier smoke results using the manual runbook. **Done 2026-11-08:** owner `teleifo` verified the reduced gate.
- [x] 5. Record the redacted T4 evidence in branch state and mark T4 complete before T6 starts. **Done 2026-11-08.**

### T5: Recovery rehearsal

**Delivers:** operator-owned Neon recovery evidence | **Satisfies:** F8, N2 | **Depends on:** T3, T4 | **Wave:** 4

**Status:** Post-merge

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `docs/operations/w13-deployment.md` | Record the owner’s manual Neon rehearsal result and the redacted evidence location. |
| Test | `scripts/w13/recovery-evidence.mjs` | Validate the submitted evidence fields and RPO/RTO thresholds. |

**Checklist**

- [x] 1. `GATE:` repository owner confirms the active Neon plan and approved restricted rehearsal target.
- [x] 2. `GATE:` repository owner manually performs the Neon backup/restore rehearsal using the W13 runbook.
- [x] 3. `GATE:` repository owner reapplies/verifies the non-production seed and records all required evidence fields.
- [x] 4. Attach the redacted evidence and mark T5 complete only if RPO ≤24 hours and RTO ≤4 hours. **Done 2026-11-08:** owner `teleifo` verified the recovered `w13-recovery-past` state; measured RPO/RTO are 20 seconds each (0.0056 hours), seed result passed, outcome passed.

### T6: Protected production migration and deployment

**Delivers:** protected production job that migrates, builds, smokes, and promotes one immutable SHA | **Satisfies:** F4, N1 | **Depends on:** T1, T3, T5 | **Wave:** 5

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `.github/workflows/w13-production.yml` | Protected `main` workflow with least privilege, pinned actions, environment approval, concurrency lock, fixed inputs, no PR-controlled code after secrets, migration, candidate deploy, smoke, and promotion. |
| Create | `scripts/w13/verify-production-identity.mjs` | Verify detached checkout SHA, manifest hash, artifact digest, Vercel candidate metadata, and promotion target. |
| Create | `tests/w13/production-workflow.test.ts` | Cover E4-E6, E16, E25, E27, E34-E35, E38, E40 and no-live-key boundary. |
| Modify | `scripts/check-workflows.mjs` | Extend validation for protected non-PR deployment workflows while preserving the deny rules for PR workflows; require fixed triggers, environments, permissions, and pinned actions. |
| Modify | `workflow/action-pins.json` | Add approved commit-SHA pins for the protected deployment workflows. |

**Checklist**

- [ ] 1. Write failing workflow tests for ref/review/check gates, SHA/artifact drift, concurrency, secret timing, and target identity.
- [ ] 2. Implement the protected workflow and immutable identity checks.
- [ ] 3. Run workflow/security checks and focused W13 tests.
- [ ] 4. `GATE:` repository owner configures the GitHub Environment, Vercel production target, and production secrets.
- [ ] 5. Update branch state and commit: `feat: add protected W13 production deployment`.

### T7: Fixed post-deploy smoke harness

**Delivers:** protected fixed-request smoke evidence for dev/prod and the G-26/G-32 checks | **Satisfies:** F7, N3 | **Depends on:** T1, T4, T6 | **Wave:** 6

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `.github/workflows/w13-smoke.yml` | Run the fixed smoke harness from protected `main`; no branch-controlled scripts or live keys in PR CI. The workflow invokes only the committed fixed harness and uses no PR artifacts. |
| Create | `scripts/w13/smoke.mjs` | Issue the exact health, `/api/me`, foreign-token, limiter-header, and SoCLaaS checks; emit allowlisted evidence only. |
| Create | `tests/w13/smoke.test.ts` | Cover E9-E11, E14-E15, E17-E19, E24, E31, E38-E39, E43-E44 and evidence redaction. |

**Checklist**

- [ ] 1. Write failing tests for each fixed request, expected response, tier identity, token failure, header variation, degraded dev AI, and redaction case.
- [ ] 2. Implement the fixed harness and allowlisted evidence schema.
- [ ] 3. Run focused smoke tests, `npm run check:workflows`, and `npm run scan:secrets`.
- [ ] 4. `GATE:` repository owner provisions isolated per-tier smoke identities and runs the deployed smoke checks.
- [ ] 5. Record pass/degraded/fail evidence; update branch state and commit: `feat: add protected W13 smoke checks`.

### Close-out

- [ ] Every traceability row is verified; all required commands are green.
- [ ] Plan task statuses, spec status, and branch-state Changes/Progress match reality.
- [ ] Branch state sets W13 to `In review`, clears sessions, and lists post-merge handovers.
- [ ] Ask the operator for Gate 3 branch review; do not push, open a PR, deploy, or merge without approval.
