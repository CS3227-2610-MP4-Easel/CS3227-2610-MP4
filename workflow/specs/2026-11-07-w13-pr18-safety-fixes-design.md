# W13 PR #18 Safety Fixes

- **Status:** Approved (operator, 2026-11-08)
- **Format:** v2
- **Risk tier:** High — deployment identity, database tenancy, credentials, and production configuration
- **Workstream:** W13
- **Plan:** to be written after Gate 1 approval
- **Constraints consulted:** AD-32, AD-53, C~7 on `w13-deployment`, the W13 deployment target contract, and the existing SoCLaaS gateway setting

**Amended 2026-11-08:** see branch state C~1. This amendment preserves AD-53's protected `development` exception and narrows the provisioning requirement to untrusted PR previews.

## 1. Problem

PR #18 introduces a canonical deployment target map, but its SoCLaaS values disagree with the
gateway's pinned endpoint, its application Prisma runtimes do not validate `DATABASE_URL` against
the selected tier, and preview credential denial exists only as an unused test helper. The PR also
contains placeholder production Neon values and three whitespace errors in a new specification.

The desired result is one consistent target contract, fail-closed runtime database construction,
credential-free previews, and production configuration matching the operator-confirmed targets.

## 2. Goals

- **F1 — Canonical targets.** The dev and prod target entries use the shared endpoint. Accept: a parity test and target fixtures expose exactly the confirmed endpoint and production values.
  `https://soclaas-api.comp.nus.edu.sg/v1`; prod uses Firebase project `agile-platform-prod`,
  Neon project `super-sunset-36592949`, Neon host
  `ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech`, and database `neondb`.
  The tier manifest and all affected fixtures agree with the code-owned map.
- **F2 — Runtime database binding.** Before constructing a Prisma client for any non-preview tier, auth and gateway runtimes validate the selected target, including the exact parsed host and database name; `dev`/`prod` also require matching Neon project observations. A local/test tier cannot bypass validation by omitting observations or by claiming a production URL. Accept: cross-tier URL tests fail before the client factory is called, and invalid input exposes no URL.
- **F3 — Untrusted PR preview isolation.** An untrusted PR preview rejects all data and secret credentials before runtime construction, including registration codes, rate secrets, Neon observations, SoCLaaS credentials, and `SOCLAAS_BASE_URL`. The protected `development` branch runs as application tier `dev`, not `preview`, despite Vercel's deployment-type label. Accept: every listed credential is rejected for an untrusted PR preview and its identity-only settings are accepted.
- **F4 — Shared validation.** The preview denylist is one shared function used by auth, gateway, and the deployment verifier. Accept: source and tests import the same validator symbol.
- **F5 — Verification.** Add regression coverage for target values, runtime cross-tier URL mismatch, preview credential rejection, and shared endpoint acceptance. Accept: focused tests pass and `git diff --check` returns zero.
- **F6 — Provisioning boundary.** Untrusted PR previews contain no database, Firebase, Neon, SoCLaaS, registration-code, rate-secret, or deployment-token variables. The protected `development` branch remains the AD-53 dev-tier exception even though Vercel labels its deployments Preview. Accept: the owner verifies every dev-tier variable has Vercel Preview plus exact Git Branch `development` scope only (never generic or wildcard Preview); the project is linked to the expected repository; `development` retains AD-32 protection; and generic or fork PR previews have only `APP_TIER=preview` and allowed non-sensitive Vercel identity fields. Runtime validation remains defense-in-depth.

## 3. Non-goals

- No Prisma schema, migration, seed-record, endpoint, or public API changes.
- No production deployment workflow, Neon recovery rehearsal, or live SoCLaaS smoke test.
- No production secret values in tracked files; only non-secret identifiers and endpoint names are
  recorded.
- No change to local/test behavior when those tiers do not supply deployment resource observations; local/test URL validation is defined explicitly below.

## 4. Design

### 4.1 Approach

Keep `src/be/db/src/tier-targets.ts` as the code-owned target boundary. Reuse its database target
parser and add the preview credential policy there so every runtime and the deployment verifier use
the same rules. Auth and gateway call the existing validator immediately before constructing their
Prisma clients for `dev` and `prod`. The target map's supplied production host is used for both
pooled and direct URL validation; a later operator change to a distinct direct host requires a
separate target-map amendment.

Preview provisioning is a separate trusted boundary. Generic and fork PR previews must omit the
forbidden variables. Vercel labels deployments from the protected `development` branch as Preview,
but AD-53 treats that exact repository branch as application tier `dev` and permits only its
branch-scoped dev settings. Every such setting must use the exact Git Branch `development` scope,
not a wildcard or generic Preview scope; the linked repository and AD-32 branch protection make
that exception auditable.
The shared runtime validator is defense-in-depth for application startup and cannot protect arbitrary
preview code that reads an injected secret before startup or bypasses the validator.

The rejected alternative is separate per-package allowlists: they caused the current SoCLaaS
contradiction and would allow one runtime to accept a target another rejects.

### 4.2 Data model

No persisted data changes. The logical target record remains keyed by application tier and contains
the Vercel identity, Firebase project, Neon host/project/database, and SoCLaaS endpoint.

### 4.3 Interfaces

| Operation | Contract | Failure |
|---|---|---|
| `validateDatabaseTarget(env, tier, url?)` | Existing function; exact host, database path, and Neon observations must match the immutable tier entry. | Throws a fixed target error before a client or Prisma command is created. |
| `validatePreviewEnvironment(env)` | Shared function for untrusted PR previews; `APP_TIER` must be `preview`, and no forbidden variable may be anything other than `undefined` (empty or whitespace values are forbidden). Allowed identity fields are `VERCEL_PROJECT_ID`, `VERCEL_ENV`, and a non-protected `VERCEL_GIT_COMMIT_REF`; development/main refs are rejected. The protected `development` branch runs as tier `dev` and does not invoke this validator. | Throws only the rejected setting name or fixed identity reason. |
| `validateRuntimeDatabaseTarget(env)` | For `dev`/`prod`, `DATABASE_URL` is required and must match the selected target's host, database path, and both `NEON_HOST`/`NEON_PROJECT` observations. For `local`/`test`, the URL must match the local/test target; observations are optional, but if one is supplied the other is required and both must match. `preview` has no database target. | Throws a fixed target error before a client or Prisma command is created. |
| `createAuthRuntime(env)` | For dev/prod, validates `DATABASE_URL` before `new PrismaClient`; preview returns its unavailable runtime without accepting credentials. | No client construction on invalid configuration. |
| `runProductionMigration(env)` | Validates `DIRECT_DATABASE_URL` as the prod target before invoking the migration executor; the child process receives only that direct URL as `DATABASE_URL`. | No migration command or child process on invalid target. |
| Gateway runtime construction | For dev/prod, validates `DATABASE_URL` before its Prisma client; preview rejects credentials before construction. | No client construction on invalid configuration. |

The existing callers remain source-compatible. Local and test tiers retain URL-only behavior when no
resource observations are supplied; if observations are supplied, they must be supplied as a
complete matching pair.

### 4.4 UI

None: this is a runtime and deployment-safety correction.

### 4.5 Conventions

- The shared SoCLaaS endpoint is exactly `https://soclaas-api.comp.nus.edu.sg/v1`.
- `NEON_HOST`, `NEON_PROJECT`, and the database URL are observations of the code-owned target; they
  never redefine it.
- Untrusted PR preview has no data or secret credentials, even when `LLM_MODE=mock`.
- Untrusted PR preview forbids these names when their value is present, including an empty or whitespace value:
  `DATABASE_URL`, `DIRECT_DATABASE_URL`, `FIREBASE_PROJECT_ID`, `REGISTRATION_CODE_PM`,
  `REGISTRATION_CODE_DEV_LEAD`, `REGISTRATION_CODE_DEVELOPER`, `RATE_KEY_SECRET`, `NEON_HOST`,
  `NEON_PROJECT`, `SOCLAAS_BASE_URL`, `SOCLAAS_API_KEY`, `VERCEL_TOKEN`, and `VERCEL_TEAM_ID`.
- Untrusted PR preview may contain `APP_TIER=preview`, `VERCEL_PROJECT_ID`, `VERCEL_ENV`, and a
  non-protected `VERCEL_GIT_COMMIT_REF`; refs named `development` or `main` are rejected. The
  protected `development` branch is the AD-53 dev tier and is audited separately for exact branch scope.
- Errors name settings or fixed reasons, never URLs, tokens, passwords, or response bodies.

### 4.6 Sequencing constraints

The shared preview validator and canonical target values must be available before auth and gateway
runtime changes. Tests and fixtures must be updated with the target map in the same logical change.

## 5. Edge cases

| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1 | Dev uses the shared SoCLaaS endpoint | Auth and gateway settings accept the same endpoint. | unit |
| E2 | F1 | Prod uses the operator-confirmed Neon target | Target map, manifest, and production fixtures agree exactly. | unit |
| E3 | F2 | Dev labels accompany a production database URL | Runtime fails before Prisma construction. | unit |
| E4 | F2 | Prod labels accompany a dev database URL | Runtime fails before Prisma construction. | unit |
| E5 | F2 | Neon host or database path differs from the selected tier | Runtime fails with a fixed target error. | unit |
| E6 | F3 | An untrusted PR preview receives `DATABASE_URL` or `DIRECT_DATABASE_URL` | Startup fails naming that setting. | unit |
| E7 | F3 | An untrusted PR preview receives `SOCLAAS_API_KEY` while mock mode is selected | Startup fails naming `SOCLAAS_API_KEY`. | unit |
| E8 | F3 | An untrusted PR preview has only Vercel project/env/ref identity fields | Startup remains credential-free and accepts the identity fields. | unit |
| E9 | F4 | Deployment verifier validates untrusted PR preview variables | It calls the shared validator rather than a duplicate policy. | unit |
| E10 | F5 | Production fixtures use the confirmed values | Target and migration tests remain deterministic. | unit |
| E11 | F3/F6 | An untrusted PR preview receives any forbidden variable with an empty or whitespace value | Startup and the provisioning policy reject it; `undefined` is the only absence. The owner audit confirms every dev-tier variable has exact Git Branch `development` scope only, never generic/wildcard Preview, and generic/fork PR previews receive none of those names. | unit / owner check |
| E12 | F2 | Local/test supplies only its exact URL, or supplies both matching observations | Runtime accepts; one partial observation or a mismatched observation fails. | unit |
| E13 | F2 | Production migration receives a dev direct URL | Validation fails before the migration executor or child process is invoked. | unit |
| E14 | F2 | A local/test tier claims a production URL while omitting Neon observations | Runtime fails on the exact local/test target before Prisma construction. | unit |

### What could corrupt data

- A dev-labeled runtime connecting to production could mutate production rows; F2 prevents client
  construction before the connection is made.
- An untrusted PR preview retaining a database or AI credential could expose shared resources to
  untrusted code; F3 rejects credentials at startup, while F6 prevents its provisioning from
  supplying them in the first place. The protected `development` exception is constrained to the
  exact linked repository branch and AD-32 protection. Runtime checks cannot protect code that
  executes before or around the validator.
- Divergent target maps could validate migration and application against different resources; F1 and
  F4 keep one source of truth.

## 6. Security

The caller is the application process or protected deployment verifier. Environment values are
untrusted configuration except for the code-owned target map. Validation occurs before database or
provider client construction, and no secret or URL is included in an error or evidence object.
Deployed `dev`/`prod` and preview processes must also satisfy their Vercel project/environment/ref
identity checks; local/test URL-only mode is limited to the local/test target and cannot select a
deployment target by omission.
Production target identifiers are non-secret; database credentials and SoCLaaS keys remain in
protected environment configuration. No authorization or tenancy rule is weakened.

## 7. Open questions

None. The operator confirmed `agile-platform-prod` as the production Firebase project and supplied
the production Neon target. The supplied Neon host is the canonical host for both pooled and direct
URL validation in this change.

## 8. Decisions made here

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Dev and prod share the exact existing SoCLaaS endpoint. | Preserves the gateway's existing allowlist; rejects invented tier-specific `.example` endpoints. | operator, 2026-11-07 |
| SD2 | Production uses Firebase `agile-platform-prod`, Neon project `super-sunset-36592949`, host `ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech`, database `neondb`. | Binds code and fixtures to the operator-confirmed production resource; rejects the PR's placeholder target. | operator, 2026-11-07 |
| SD3 | The supplied production Neon host is used for both pooled and direct URL validation in this change. | No separate direct host was supplied; keeping one exact target avoids silently accepting an unverified host. | operator, 2026-11-07 |
| SD4 | Preview credential denial is centralized in the shared target module and invoked by auth, gateway, and verifier. | Prevents an unused duplicate helper from giving false coverage. | Codex, 2026-11-07 |
| SD5 | Local/test runtime validation is URL-only when no observations are supplied; a supplied observation set must be complete and match the local/test target. | Preserves existing local/test setup while preventing partial or cross-tier observations from silently passing. | Codex, 2026-11-07 |

## 9. Review record

- Lenses: Implementer, Tester/QA, Attacker, Maintainer; amendment review round 1 completed. Resolved: all F3/E6–E9 references now distinguish untrusted PR preview from the protected development dev tier; the owner audit requires exact branch scope with no generic/wildcard Preview scope, expected repository linkage, AD-32 branch protection, and zero dev-tier variable names on generic/fork PR previews.
- Gate 1: approved by operator on 2026-11-07; plan may now be written.
