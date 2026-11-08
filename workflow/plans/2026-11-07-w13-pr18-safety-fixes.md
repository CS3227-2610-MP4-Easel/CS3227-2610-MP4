# W13 PR #18 Safety Fixes Implementation Plan

- **Status:** Approved (operator, 2026-11-08)

> **For agents:** tick each checkbox as it is completed, in this plan commit. Keep the W13 branch state current. Spec: [W13 PR #18 safety-fix design](../specs/2026-11-07-w13-pr18-safety-fixes-design.md).

**Amended 2026-11-08:** T4 now distinguishes generic/fork PR previews from Vercel's protected `development` branch scope, preserving AD-53. No code task, dependency, or other task boundary changes.

## Scope

**Goal:** Make deployment targets canonical, reject cross-tier database bindings before Prisma construction, and enforce credential-free previews with one shared policy.

**In scope:** F1 canonical targets; F2 runtime database binding; F3 preview isolation; F4 shared validation; F5 regression verification; F6 protected preview provisioning boundary.

**Non-goals:**

- N1: No Prisma schema, migration, seed-record, endpoint, or public API changes.
- N2: No production deployment workflow, Neon recovery rehearsal, or live SoCLaaS smoke test.
- N3: No production secret values in tracked files.
- N4: No change to local/test behavior when their exact URL is used without observations.

**Risk tier:** High — deployment identity, database tenancy, credentials, and production configuration. Verification therefore includes focused unit tests, full tests, typecheck, lint, Prisma validation, workflow checks, diff checks, and a protected-environment owner gate.

## Task order

<!-- Status: Not started / In progress / Done / Blocked / Post-merge (a human step after the merge) -->
| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 Canonical target and shared preview policy | - | - | 1 | Done |
| T2 Runtime database enforcement | T1 | - | 2 | Done |
| T3 Migration boundary, fixtures, and whitespace | T1 | - | 2 | Done |
| T4 Protected preview provisioning check | T1 | - | 2 | Post-merge |
| T5 Close-out | T2, T3 | - | 3 | Done |

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1, T3 | `src/be/db/test/tier-targets.test.ts`; `src/be/db/test/w13-migration.test.ts`; manifest parity assertions |
| F2 | T2, T3 | auth/gateway runtime tests; migration preflight test |
| F3 | T1, T2 | shared preview-policy tests; auth/gateway settings tests |
| F4 | T1 | import/source assertions in `tests/w13/dev-deployment.test.ts` and runtime settings tests |
| F5 | T5 | full test, lint, typecheck, Prisma validation, workflow checks, and diff check |
| F6 | T4 | owner verification of protected Vercel preview environment configuration |
| N1 | T5 | schema/migration/API diff review |
| N2 | T4, T5 | post-merge gate remains manual; no live provider action in code tasks |
| N3 | T1, T3, T5 | tracked-file review and redaction assertions |
| N4 | T2 | local/test URL-only and complete-observation tests |
| E1 | T1 | target/settings parity test |
| E2 | T1, T3 | canonical prod target and manifest fixture tests |
| E3 | T2 | dev runtime with prod URL fails before client factory |
| E4 | T2 | prod runtime with dev URL fails before client factory |
| E5 | T2 | host/database-path mismatch test |
| E6 | T1, T2 | parameterized preview `DATABASE_URL` and `DIRECT_DATABASE_URL` rejection |
| E7 | T1, T2 | preview `SOCLAAS_API_KEY` rejection |
| E8 | T1, T2 | identity-only preview acceptance |
| E9 | T1 | verifier imports and delegates to shared validator |
| E10 | T3 | production fixture and migration target tests |
| E11 | T1, T2, T4 | all forbidden names with empty/whitespace values; protected-config check |
| E12 | T2 | local/test URL-only, complete observations, and partial-observation tests |
| E13 | T3 | cross-tier `DIRECT_DATABASE_URL` fails before executor |
| E14 | T2 | local/test tier with production URL and no observations fails before Prisma |

## Verification gates

- Per T1: `node --import tsx --test src/be/db/test/tier-targets.test.ts tests/w13/dev-deployment.test.ts src/be/auth/test/settings.test.ts src/be/llm-gateway/test/settings.test.ts`; then `npm run lint`.
- Per T2: focused auth and gateway runtime/settings tests; then `npm run lint` and `npm run typecheck`.
- Per T3: `node --import tsx --test src/be/db/test/w13-migration.test.ts src/be/db/test/seed.test.ts`; then `npm --workspace @agile/db run prisma:validate` and `git diff --check`.
- T4 is `Post-merge`: `GATE:` the owner verifies the protected Vercel preview environment contains none of the forbidden names before the development push check is used; record the result in the branch state.
- Before finishing T5: `npm test`, `npm run lint`, `npm run typecheck`, `npm --workspace @agile/db run prisma:validate`, `npm run check:workflows`, and `git diff --check` all pass; the known full-tree secret-scan deviation remains recorded if reproduced.

---

### T1: Canonical target and shared preview policy

**Delivers:** One code-owned target map, exact operator-confirmed dev/prod values, and one shared preview validator consumed by the verifier and runtime settings | **Satisfies:** F1, F3, F4, E1, E2, E6, E7, E8, E9, E11 | **Depends on:** - | **Wave:** 1

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `src/be/db/src/tier-targets.ts` (`TARGETS`, exported validators) | Set dev and prod SoCLaaS URLs to `https://soclaas-api.comp.nus.edu.sg/v1`; set prod Firebase project to `agile-platform-prod`, Neon project to `super-sunset-36592949`, host to `ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech`, and database to `neondb`. Add the exhaustive preview forbidden-name policy, empty/whitespace presence rule, protected identity checks, and the shared runtime target helper contract from spec §§4.3–4.5. |
| Modify | `scripts/w13/verify-dev-deployment.mjs` (`validatePreviewEnvironment`) | Remove the duplicate denylist; import and re-export the shared validator while preserving the verifier's existing object-shaped API and `node --import tsx` workflow entry point. |
| Modify | `src/be/auth/src/settings.ts` (`loadAuthSettings`) | Invoke the shared preview policy before the preview no-data return, so settings-level startup rejects injected preview credentials rather than relying on a later runtime constructor. |
| Modify | `src/be/llm-gateway/src/settings.ts` (`loadGatewaySettings`) | Invoke the same preview policy before provider settings are accepted, including mock-mode previews. |
| Modify | `workflow/deployment/tier-manifest.json` | Align dev/prod endpoint, Firebase, Neon host/project/database, and environment fields with the code-owned target map. |
| Create | `src/be/db/test/tier-targets.test.ts` | Test exact target values, shared SoCLaaS parity, every forbidden preview name, empty/whitespace rejection, allowed identity fields, protected ref rejection, malformed URLs, and redacted fixed errors. |
| Modify | `tests/w13/dev-deployment.test.ts` | Assert the deployment verifier uses the shared validator and parameterize preview-policy coverage across every forbidden name plus identity-only acceptance. |
| Modify | `src/be/auth/test/settings.test.ts` | Align dev/prod resource fixtures with the confirmed endpoint and production Neon target so the existing settings contract tests remain green. |
| Modify | `src/be/auth/test/tier-settings.test.ts` | Align dev/prod resource fixtures with the confirmed endpoint and production Neon target so the existing tier-identity tests remain green. |

**Implementation shape**

```ts
const PREVIEW_FORBIDDEN_NAMES = [
  "DATABASE_URL", "DIRECT_DATABASE_URL", "FIREBASE_PROJECT_ID",
  "REGISTRATION_CODE_PM", "REGISTRATION_CODE_DEV_LEAD", "REGISTRATION_CODE_DEVELOPER",
  "RATE_KEY_SECRET", "NEON_HOST", "NEON_PROJECT", "SOCLAAS_BASE_URL",
  "SOCLAAS_API_KEY", "VERCEL_TOKEN", "VERCEL_TEAM_ID",
] as const;

export function validatePreviewEnvironment(env: Record<string, string | undefined>): true {
  if (env.APP_TIER !== "preview") throw new Error("APP_TIER must be preview");
  const forbidden = PREVIEW_FORBIDDEN_NAMES.find((name) => env[name] !== undefined);
  if (forbidden) throw new Error(`preview must not receive ${forbidden}`);
  if (env.VERCEL_GIT_COMMIT_REF === "development" || env.VERCEL_GIT_COMMIT_REF === "main") {
    throw new Error("preview VERCEL_GIT_COMMIT_REF is protected");
  }
  return true;
}
```

**Checklist**

- [x] 1. Write failing target/policy tests for E1, E2, E6–E9, and E11; run the T1 focused command and confirm failures identify the stale target map or duplicate policy.
- [x] 2. Implement the canonical target values and shared preview validator; keep errors limited to setting names or fixed reasons.
- [x] 3. Replace verifier duplication and call the shared policy from auth and gateway settings.
- [x] 4. Update the deployment manifest and run the focused T1 command; confirm PASS for all T1 cases.
- [x] 5. Run `npm run lint`.
- [x] 6. Update branch state Progress and Changes for T1.
- [x] 7. Commit: `fix: centralize W13 targets and preview policy (W13)`.

### T2: Runtime database enforcement

**Delivers:** Auth and gateway reject invalid or cross-tier database targets before Prisma construction; local/test retain exact URL-only behavior | **Satisfies:** F2, F3, F4, E3–E8, E11, E12, E14 | **Depends on:** T1 | **Wave:** 2

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `src/be/db/src/tier-targets.ts` (`validateRuntimeDatabaseTarget`) | Require `DATABASE_URL` for every non-preview runtime; compare exact host/database path for all non-preview tiers; require both matching Neon observations for dev/prod; allow local/test with no observations, require a complete matching pair when observations are present; reject preview database targets. |
| Modify | `src/be/auth/src/runtime.ts` (`createAuthRuntime`) | Call the runtime target validator after settings validation and before the Prisma client expression or any injected client factory is selected; preserve the credential-free preview runtime. |
| Modify | `src/be/llm-gateway/src/runtime.ts` (`runtime` or extracted testable constructor) | Validate the process environment before creating `PrismaClient`; expose only a narrow test seam for a fake client/provider so invalid configuration can prove zero client construction. |
| Modify | `src/be/auth/test/tier-settings.test.ts` | Add valid dev/prod runtime construction with injected bases, cross-tier URL failures before base use, missing/wrong Neon observations, malformed/missing URL failures, preview credential rejection, and redaction assertions. |
| Create | `src/be/llm-gateway/test/runtime.test.ts` | Exercise valid dev/prod construction through the test seam, cross-tier URL/observation failures before client factory invocation, preview rejection, and local/test URL-only acceptance. |
| Modify | `src/be/llm-gateway/test/settings.test.ts` | Add shared preview-policy and exact canonical endpoint assertions for dev/prod settings. |
| Modify | `tests/setup-auth-env.ts` | Give the process-wide test tier its exact local/test database URL so API module bootstrap satisfies the new pre-Prisma target contract. |

**Implementation shape**

```ts
export function validateRuntimeDatabaseTarget(env: Record<string, string | undefined>): TierTarget | null {
  const tier = getTierTarget(env.APP_TIER);
  if (tier.tier === "preview") {
    validatePreviewEnvironment(env);
    return null;
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const parsed = parseDatabaseTarget(env.DATABASE_URL);
  if (parsed.host !== tier.neonHost || parsed.databaseName !== tier.databaseName) {
    throw new Error("DATABASE_URL does not match APP_TIER target");
  }
  const hasHost = env.NEON_HOST !== undefined;
  const hasProject = env.NEON_PROJECT !== undefined;
  if (tier.tier === "dev" || tier.tier === "prod" || hasHost || hasProject) {
    if (env.NEON_HOST !== tier.neonHost || env.NEON_PROJECT !== tier.neonProject) {
      throw new Error("Neon observations do not match APP_TIER target");
    }
  }
  return tier;
}
```

The implementation must call this before `new PrismaClient(...)`; the test seams must count client-factory calls and assert zero on E3–E5, E12, and E14.

**Checklist**

- [x] 1. Write failing auth and gateway runtime tests for E3–E5, E12, and E14, including valid dev/prod construction and redacted errors; run the focused runtime command.
- [x] 2. Implement `validateRuntimeDatabaseTarget` with exact local/test, dev/prod, and preview semantics.
- [x] 3. Place validation before both Prisma client construction paths and retain the no-database preview runtime.
- [x] 4. Add the gateway test seam without changing the production caller contract; run focused tests and confirm zero factory calls on invalid inputs.
- [x] 5. Run `npm run lint` and `npm run typecheck`.
- [x] 6. Update branch state Progress and Changes for T2.
- [x] 7. Commit: `fix: bind W13 runtimes to tier databases (W13)`.

### T3: Migration boundary, fixtures, and whitespace

**Delivers:** Production direct migration validation uses the confirmed production target, migration/seed fixtures agree with the target map, and the PR's whitespace defect is removed | **Satisfies:** F1, F2, F5, E2, E10, E13, N1, N3 | **Depends on:** T1 | **Wave:** 2

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `scripts/w13/migrate-production.mjs` (`validateMigrationInputs`, `runProductionMigration`) | Keep `DIRECT_DATABASE_URL` as the caller-facing input; validate it as the prod target before manifest reads, Prisma validation, executor invocation, or child-process creation; pass only the validated direct URL as child `DATABASE_URL`. |
| Modify | `src/be/db/test/w13-migration.test.ts` | Replace placeholder prod host/database fixtures; add valid pooled-plus-direct target coverage, cross-tier direct URL failure before executor calls, and direct URL redaction assertions. |
| Modify | `src/be/db/test/seed.test.ts` | Replace stale production target fixture and assert the canonical prod target remains rejected for demo seeding. |
| Modify | `workflow/specs/2026-11-06-w13-deployment-design.md` | Remove the three trailing-whitespace errors identified in PR #18; do not alter the specification's meaning. |

**Checklist**

- [x] 1. Update migration and fixture tests with the operator-confirmed production host/database and write the E10/E13 regression cases; run focused migration/seed tests and confirm stale fixtures fail before the implementation.
- [x] 2. Keep direct validation before `findMigrationFiles`, `prisma validate`, and `migrate deploy`; preserve child-environment minimization.
- [x] 3. Run focused migration/seed tests; confirm valid direct input passes and cross-tier input makes zero executor calls.
- [x] 4. Run `npm --workspace @agile/db run prisma:validate` and `git diff --check`.
- [x] 5. Update branch state Progress and Changes for T3.
- [x] 6. Commit: `fix: align W13 migration targets and fixtures (W13)`.

### T4: Protected preview provisioning check

**Delivers:** Credential-free generic/fork PR provisioning is verified at the trusted Vercel environment boundary, while the AD-53 development exception is proved to be exact-branch scoped; runtime checks remain defense-in-depth | **Satisfies:** F3, F6, E11, N2 | **Depends on:** T1 | **Wave:** 2

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `workflow/project-state/branch-states/w13-deployment-continuation.md` | Record the owner verification result and any deviation; keep the trusted provisioning boundary distinct from runtime detection. |
| Post-merge check | Vercel project environment configuration and GitHub branch protection | `GATE:` owner verifies generic/fork PR previews receive `APP_TIER=preview` and allowed identity fields only, with none of the exact forbidden names from the spec, including empty values; every dev-tier variable is Preview + exact Git Branch `development` only, never wildcard/generic Preview; the Vercel project remains linked to the expected repository; and `development` retains required-review/no-force-push protection. The owner records the date and redacted result; no credentials are copied into the repository. |

**Checklist**

- [ ] 1. `GATE:` After the branch is merged, inspect the Vercel project's variable names and scopes without revealing values.
- [ ] 2. Confirm generic/fork PR Preview has only the spec's allowed identity fields and no forbidden name, including an empty or whitespace value.
- [ ] 3. Confirm every dev-tier variable is restricted to Preview plus exact Git Branch `development`, never wildcard/generic Preview, and that the Vercel project is linked to `CS3227-2610-MP4-Easel/CS3227-2610-MP4`.
- [ ] 4. Confirm GitHub still protects `development` with required review and no force-push; record the redacted owner result in the branch state before T4 is marked complete.

**Amendment review 2026-11-08:** Implementer-plan review found and corrected the obsolete reference to the removed W13 development verification workflow. No remaining blocking findings.

### T5: Close-out

**Delivers:** A reviewable, verified W13 branch with all code requirements mapped to evidence and the T4 owner check handed over | **Satisfies:** F5, N1–N4 | **Depends on:** T2, T3 | **Wave:** 3

**Checklist**

- [x] 1. Confirm every code Traceability row has passing test evidence or the T4 owner check is recorded as post-merge; run the full verification gates.
- [x] 2. Confirm the spec remains approved and this plan's task statuses reflect reality; record amendments in the branch state.
- [x] 3. Set W13 to `In review`, clear the active session when the work is handed to review, and add final Changes/Deviation/Handover entries.
- [x] 4. Ask the operator to review the branch at Gate 3; do not push, open a PR, or merge before approval.
