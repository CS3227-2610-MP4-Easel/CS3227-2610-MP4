# W1 Foundation and API Skeleton Implementation Plan

> **For agents:** tick each checklist item in order and update the branch-state Progress cell in the same commit as the task. Spec: [W1 foundation design](../specs/2026-11-02-w1-foundation-design.md).

- **Status:** Approved (Dev Lead, 2026-11-02)

## Scope

**Goal:** Implement the normative architecture contracts, database foundation, API boundary, health route, and verification seams that unblock W2–W9.

**In scope:** F1–F9 and N1–N6 from the approved W1 spec; endpoint/policy/OpenAPI parity; Prisma schema parity; filtered-client boundary; migration procedure; health route; frozen-interface consumer fixtures.

**Non-goals:** W4 authentication behavior; W2 gateway runtime; W3 guards; W5 core behavior; W6 context implementation; role routes; UI screens; seed data; deployment operations; security corpus; CI process-security enforcement.

**Risk tier:** High — the work defines the shared data, authorization, and API seams, so every task has contract and negative-path verification.

## Task order

| Task | Deliverable | Depends on | Wave | Status |
|---|---|---|---:|---|
| T1 | Workspace scaffold and package boundaries | — | 1 | Not started |
| T2 | Shared contract schemas, error codes, pagination, enums, and frozen interface implementations | T1 | 2 | Not started |
| T3 | Policy map and route registration contract | T2 | 3 | Not started |
| T4 | Prisma schema, enums, constraints, indexes, and filtered client seam | T1 | 2 | Not started |
| T5 | Initial migration and migration documentation | T4 | 3 | Not started |
| T6 | API boundary, request id, error mapping, and health route | T2, T3 | 4 | Not started |
| T7 | Cross-boundary, policy, OpenAPI, authorization, and import-rule verification seams | T2, T3, T4, T6 | 4 | Not started |
| T8 | Frozen-first handoff | T2, T3, T4, T6 | 5 | Not started |

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | `tests/workspace.test.ts` |
| F2 | T2 | `packages/contracts/test/contracts.test.ts` |
| F3 | T3, T7 | `packages/contracts/test/policy.test.ts` |
| F4 | T4, T7 | `packages/db/test/schema-parity.test.ts` |
| F5 | T4, T7 | `packages/db/test/filtered-client.test.ts` |
| F6 | T6, T7 | `packages/api/test/route-registration.test.ts` |
| F7 | T6 | `packages/api/test/health.test.ts` |
| F8 | T2, T7, T8 | `packages/contracts/test/frozen-interfaces.test.ts` |
| F9 | T5 | `packages/db/test/migration-procedure.test.ts` |
| N1 | T6, T7 | `packages/api/test/authorization-matrix.test.ts` |
| N2 | T2, T6 | `packages/api/test/input-validation.test.ts` |
| N3 | T4, T7 | `packages/db/test/project-boundaries.test.ts` |
| N4 | T6, T7 | `packages/api/test/log-redaction.test.ts` |
| N5 | T4, T7 | `packages/db/test/concurrency.test.ts` |
| N6 | T3, T7 | `packages/api/test/openapi-parity.test.ts` |
| E1 | T2 | contract unknown-key rejection test |
| E2 | T2 | server-managed-field rejection test |
| E3 | T6 | malformed input and content-type test |
| E4 | T3, T7 | missing-policy registration test |
| E5 | T3, T7 | wrong-role policy test |
| E6 | T4, T7 | missing/cross-project resource test |
| E7 | T4 | archived-project write test |
| E8 | T4 | stale-version test |
| E9 | T4, T7 | cross-project child-identifier test |
| E10 | T4, T7 | filtered-client test |
| E11 | T6, T7 | log-redaction and request-id test |
| E12 | T2, T8 | frozen-interface drift test |
| E13 | T6 | database-free health test |
| E14 | T5 | migration compatibility test |
| E15 | T1 | workspace boundary test |
| E16 | T6, T7 | authorization denial matrix test |
| E17 | T4 | concurrent version test |
| E18 | T3, T7 | route-collision test |
| E19 | T4, T7 | filtered-client bypass test |
| E20 | T5 | recovery-target verification test |

## Verification gates

- Per task: run the package test command defined in T1 and the touched package's typecheck command.
- Before finishing: run `npm test`, `npm run typecheck`, schema validation, migration parity, OpenAPI parity, and the import-rule scan.
- CI remains mock-only for AI calls; no task invokes live SoCLaaS.

---

### T1: Workspace scaffold and package boundaries

**Delivers:** npm-workspaces TypeScript monorepo with package boundaries and test/typecheck scripts | **Satisfies:** F1, E15 | **Depends on:** - | **Wave:** 1

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `package.json` | Root npm workspace declarations, pinned scripts for test/typecheck/lint, and package-manager metadata. |
| Modify | `package-lock.json` | Locked dependency graph generated from the root manifest. |
| Modify | `tsconfig.json` | Strict shared TypeScript compiler settings and project references. |
| Modify | `apps/web/tsconfig.json` | Next.js application compiler settings and references. |
| Modify | `packages/contracts/tsconfig.json` | Contracts package compiler settings. |
| Modify | `packages/db/tsconfig.json` | Database package compiler settings. |
| Modify | `packages/api/tsconfig.json` | API package compiler settings. |
| Modify | `packages/llm-gateway/tsconfig.json` | Gateway package compiler settings. |
| Modify | `.gitignore` | Required exclusions for environment files, generated Prisma artifacts, and local databases. |
| Modify | `workflow/config.json` | Project test, typecheck, lint, and schema-validation commands used by workflow tooling. |
| Modify | `apps/web/package.json` | Next.js application package boundary. |
| Modify | `packages/contracts/package.json` | Contracts package boundary and exports. |
| Modify | `packages/db/package.json` | Prisma/database package boundary and scripts. |
| Modify | `packages/api/package.json` | Hono API package boundary and exports. |
| Modify | `packages/llm-gateway/package.json` | Gateway package boundary for W2 implementations. |
| Modify | `tests/workspace.test.ts` | Workspace resolution and required package-name assertions. |

**Checklist**

- [x] 1. Write `tests/workspace.test.ts` for all five workspace packages and the root scripts; run `npm test -- tests/workspace.test.ts`; expect failure because the manifests do not exist.
- [x] 2. Create the root and package manifests with strict TypeScript and test scripts; keep `core` and `ai-context` as later domain modules, not new W1 workspaces.
 - [x] 3. Generate the initial lockfile with `npm install --ignore-scripts` only when no lockfile exists; thereafter use `npm ci --ignore-scripts` and verify every workspace resolves.
- [x] 4. Run `npm test -- tests/workspace.test.ts` and the root typecheck; expect green.
- [x] 5. Cover E15: remove or miss one package declaration in a fixture and verify workspace validation fails.
 - [x] 6. Update branch-state Progress and commit with subject `chore: scaffold W1 workspace boundaries (W1)`, plus trailers `Workstream: W1` and `Task: T1`.

**Status:** Done

**Notes for next task:** Node’s native `--import tsx` loader avoids the sandbox IPC restriction of the `tsx` CLI. Workspace and typecheck commands are now recorded in `workflow/config.json`.

### T2: Shared contracts and frozen interface implementations

**Delivers:** Zod schemas, shared enums, error envelope, pagination, and frozen-interface types matching `docs/architecture/contracts.md` | **Satisfies:** F2, F8, N2, E1, E2 | **Depends on:** T1 | **Wave:** 2

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `packages/contracts/src/index.ts` | Public contract exports. |
| Modify | `packages/contracts/src/enums.ts` | Canonical role, feature, state, and error-code enums. |
| Modify | `packages/contracts/src/errors.ts` | Strict error envelope and status-code mapping. |
| Modify | `packages/contracts/src/pagination.ts` | Page/query/result schemas with bounds from `contracts.md`. |
| Modify | `packages/contracts/src/schemas.ts` | Shared request/response Zod schemas from `contracts.md` §§1–2. |
| Modify | `packages/contracts/src/frozen.ts` | `LlmGateway`, `AiContext`, `Sessions`, and `Core` type contracts from `contracts.md` §5. |
| Modify | `packages/contracts/src/openapi.ts` | OpenAPI document generation owned by the contracts package, derived from the same route and schema records. |
| Modify | `packages/contracts/test/contracts.test.ts` | Unknown-key, server-managed-field, error, pagination, and schema tests. |
| Modify | `packages/contracts/test/frozen-interfaces.test.ts` | Compile-time consumer fixtures and runtime error/cap tests. |

**Checklist**

- [x] 1. Write failing tests for E1, E2, N2, and the frozen-interface consumer fixture; run the contracts package test command.
- [x] 2. Implement schemas and enums exactly against the normative contract source; reject unknown keys and all server-managed fields.
- [x] 3. Implement the frozen types and behavioral test fixtures, including gateway transaction prohibition, `NotMember`, session caps/abandonment, and strict Core apply contracts.
- [x] 4. Run contracts tests and package typecheck; expect green.
 - [x] 5. Verify N2 with malformed UUID, enum, and pagination fixtures; defer malformed JSON and content-type handling to T6’s API boundary tests.
 - [x] 6. Update branch-state Progress and commit with subject `feat: implement W1 shared contracts (W1)`, plus trailers `Workstream: W1` and `Task: T2`.

**Status:** Done

**Notes for next task:** Contracts own strict schemas, stable errors, pagination, frozen interfaces, and session-cap constants. API parsing and content-type behavior remain T6 responsibilities.

### T3: Policy map and route registration contract

**Delivers:** Normative 57-entry policy map and collision-safe route registration metadata | **Satisfies:** F3, N6, E4, E5, E18 | **Depends on:** T2 | **Wave:** 3

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/contracts/src/policy.ts` | Policy entry types, canonical operation keys, role aliases, predicates, and endpoint map derived from `contracts.md` §3. |
| Create | `packages/contracts/src/routes.ts` | Route metadata type and registration validation. |
| Create | `packages/contracts/test/policy.test.ts` | 57-entry completeness, role/predicate, missing-policy, and collision tests. |

**Checklist**

- [ ] 1. Write failing policy tests for 57 unique endpoints, E4, E5, and E18.
- [ ] 2. Add one policy entry per normative endpoint, including endpoint 24 role-specific predicates and endpoint 43 member-project scope.
- [ ] 3. Implement route registration checks for missing policy keys, duplicate operation ids, duplicate method/path pairs, and metadata mismatch.
- [ ] 4. Run policy tests and contracts typecheck; expect green.
- [ ] 5. Verify the registered map uses `PM`, `DEV_LEAD`, and `DEVELOPER`, with architecture aliases translated only at the boundary.
 - [ ] 6. Update branch-state Progress and commit with subject `feat: add W1 policy and route contracts (W1)`, plus trailers `Workstream: W1` and `Task: T3`.

### T4: Prisma schema and filtered client

**Delivers:** Prisma implementation of architecture §5, project-boundary constraints, atomic versions, and filtered database client | **Satisfies:** F4, F5, N3, N5, E6, E7, E8, E9, E10, E17, E19 | **Depends on:** T1 | **Wave:** 2

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/db/prisma/schema.prisma` | All models, enums, relations, indexes, composite foreign keys, and lifecycle fields from architecture §5. |
| Create | `packages/db/src/client.ts` | Prisma client construction and `FilteredDbClient` extension. |
| Create | `packages/db/src/transactions.ts` | Opaque Core transaction adapter and atomic version helper. |
| Create | `packages/db/src/maintenance.ts` | Branded maintenance capability and callback boundary; the brand is not exported to request-facing packages. |
| Create | `packages/db/test/schema-parity.test.ts` | DMMF/model/index/relation parity checks. |
| Create | `packages/db/test/filtered-client.test.ts` | Direct, nested, count, aggregate, group-by, and maintenance-boundary tests. |
| Create | `packages/db/test/project-boundaries.test.ts` | Cross-project and archive-state tests. |
| Create | `packages/db/test/concurrency.test.ts` | Atomic version compare-and-increment race test. |

**Checklist**

- [ ] 1. Write failing schema-parity, filter, boundary, and concurrency tests for E6–E10, E17, E19, N3, and N5.
 - [ ] 2. Add `schema.prisma` from architecture §5 with all enums, defaults, relation actions, composite project keys, and the declared partial-index intent; verify Prisma metadata here, with migration-SQL parity deferred to T5 after the migration exists.
 - [ ] 3. Implement the filtered client and branded maintenance capability; block request-facing raw SQL and opt-out imports through source rules.
 - [ ] 4. Implement generic atomic version updates and transaction helpers only; provide the frozen Core transaction seam without implementing Core domain behavior, which belongs to W5.
- [ ] 5. Run Prisma validation, generate the client, run database tests, and verify E7 archived writes return `CONFLICT_STATE`.
 - [ ] 6. Update branch-state Progress and commit with subject `feat: implement W1 database foundation (W1)`, plus trailers `Workstream: W1` and `Task: T4`.

### T5: Initial migration and migration documentation

**Delivers:** Initial forward-only migration, compatibility checks, and recovery procedure | **Satisfies:** F9, E14, E20 | **Depends on:** T4 | **Wave:** 3

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/db/prisma/migrations/00000000000000_init/migration.sql` | Initial schema migration generated from the normative Prisma schema. |
| Create | `packages/db/test/migration-procedure.test.ts` | Clean-database, compatibility, destructive-change, and CI-boundary checks. |
| Create | `docs/operations/database-recovery.md` | Recovery target, Neon verification evidence format, restore rehearsal, and seed reapplication procedure. |

**Checklist**

- [ ] 1. Write failing migration tests for E14 and E20, including destructive-change rejection and missing recovery evidence.
- [ ] 2. Generate the initial migration and document the exact Prisma commands from the spec.
 - [ ] 3. Add the previous-version compatibility check. Document the protected-CI migration guard as a required W12/W13 handoff; do not implement CI policy enforcement in W1.
- [ ] 4. Document the 24-hour recovery-point and 4-hour recovery-time targets and the manual restore/forward-migration path.
- [ ] 5. Verify migration SQL parity for partial indexes and destructive-change rules, then run the clean-database migration test and `npx prisma validate`; expect green.
 - [ ] 6. Update branch-state Progress and commit with subject `docs: record W1 migration and recovery procedure (W1)`, plus trailers `Workstream: W1` and `Task: T5`.

### T6: API boundary, request id, error mapping, and health route

**Delivers:** Hono app, auth/policy dependency seam, strict input pipeline, error mapping, and Next.js health mount | **Satisfies:** F6, F7, N1, N2, N4, E3, E11, E12, E13, E16 | **Depends on:** T2, T3 | **Wave:** 4

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/api/src/app.ts` | Hono app and route registration entry point. |
| Create | `packages/api/src/middleware/request-id.ts` | Server-generated request ids and response/header context. |
| Create | `packages/api/src/middleware/auth.ts` | Injected authentication, user lookup, role, membership, and predicate seams. |
| Create | `packages/api/src/errors.ts` | Stable error-to-HTTP mapping and redacted 500 response. |
| Create | `packages/api/src/routes/health.ts` | Database-free health route. |
| Create | `apps/web/app/api/[[...route]]/route.ts` | Next.js adapter for the Hono app. |
| Create | `packages/api/test/route-registration.test.ts` | Route registration and policy metadata contract tests. |
| Create | `packages/api/test/authorization-matrix.test.ts` | Auth failure ordering and handler non-invocation tests. |
| Create | `packages/api/test/input-validation.test.ts` | Body/path/query validation tests. |
| Create | `packages/api/test/health.test.ts` | Public health response tests. |
| Create | `packages/api/test/log-redaction.test.ts` | Secret and request-id redaction tests. |

**Checklist**

- [ ] 1. Write failing tests for E3, E11, E13, E16, N1, N2, and N4.
- [ ] 2. Implement server request-id generation and the protected/public middleware pipeline from `api.md`.
- [ ] 3. Implement injected auth and policy dependency interfaces without Firebase behavior; map resolver failures to the normative error codes.
- [ ] 4. Implement common error mapping and redacted 500 responses.
- [ ] 5. Add the database-free health route and Next.js adapter.
- [ ] 6. Run API tests and typecheck; verify denied requests never invoke handlers.
 - [ ] 7. Update branch-state Progress and commit with subject `feat: add W1 API boundary and health route (W1)`, plus trailers `Workstream: W1` and `Task: T6`.

### T7: Cross-boundary, policy, OpenAPI, authorization, and import verification

**Delivers:** Executable parity and security-boundary verification across packages | **Satisfies:** N3, N4, N6, E4–E6, E9, E11, E12, E16, E18, E19 | **Depends on:** T2, T3, T4, T6 | **Wave:** 4

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/api/test/openapi-parity.test.ts` | Route-table/OpenAPI comparison for all normative endpoint fields. |
| Create | `packages/api/test/import-rules.test.ts` | Source-scan checks for web/database and module-boundary violations. |
| Create | `packages/api/test/route-collision.test.ts` | Duplicate route, policy mismatch, and dispatch safety tests. |
| Create | `packages/api/test/authorization-project-scope.test.ts` | Cross-project, role, membership, assignee, and member-project tests. |
| Create | `packages/db/test/raw-query-boundary.test.ts` | Maintenance capability and raw-query access checks. |
| Create | `packages/contracts/test/openapi.test.ts` | Generated OpenAPI document shape and source-record parity tests, owned by the verification task after policy records exist. |

**Checklist**

- [ ] 1. Write failing parity and source-scan tests for N6, E4, E5, E6, E9, E12, E16, E18, and E19.
 - [ ] 2. Compare all 57 normative contract records with route metadata and the generated OpenAPI document produced by `packages/contracts/src/openapi.ts`; fail on missing, extra, or field-mismatched records.
- [ ] 3. Run source scans for `apps/web` Prisma imports, route policy omissions, raw SQL access, and maintenance-capability leakage.
- [ ] 4. Run cross-project and role-specific predicate tests, including endpoint 24 and endpoint 43.
- [ ] 5. Run the complete test suite and typecheck; expect green.
 - [ ] 6. Update branch-state Progress and commit with subject `test: verify W1 contract and boundary parity (W1)`, plus trailers `Workstream: W1` and `Task: T7`.

### T8: Frozen-first handoff

**Delivers:** Handoff evidence proving W2, W4, W5, and W6 can consume the frozen contracts | **Satisfies:** F8, E12 | **Depends on:** T2, T3, T4, T6 | **Wave:** 5

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/contracts/test/consumer-fixtures.test.ts` | Consumer fixtures for W2, W4, W5, and W6 imports and signatures. |
| Modify | `workflow/project-state/branch-states/w1.md` | Handoff, Progress, Changes, and Remaining state. |

**Checklist**

- [ ] 1. Add consumer fixtures that compile against the normative frozen-first contracts without implementation-specific imports.
- [ ] 2. Run all package tests, typechecks, schema parity, migration checks, OpenAPI parity, and import scans.
- [ ] 3. Verify E12: changing a frozen public type fails the consumer fixture until the shared-owner agreement is recorded.
- [ ] 4. Update branch-state Workstream to `In review`, clear the active session position, and list any handover items.
 - [ ] 5. Record a handoff note ending with the task log fields `agent`, `model`, `retries`, and `outcome`; update branch-state with the handoff path.
 - [ ] 6. Commit with subject `test: prove W1 frozen interface handoff (W1)`, plus trailers `Workstream: W1` and `Task: T8`.

### Close-out

- [ ] Every Traceability row has a passing test or named manual verification.
- [ ] Run `npm test`, `npm run typecheck`, Prisma validation, migration tests, OpenAPI parity, and source scans.
- [ ] Confirm the spec, task statuses, and branch-state Progress agree with reality.
- [ ] GATE: Ask the operator to review the completed branch at Gate 3; do not push, open a PR, or merge before approval.

