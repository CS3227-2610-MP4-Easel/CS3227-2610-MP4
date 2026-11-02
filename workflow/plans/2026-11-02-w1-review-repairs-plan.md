# W1 Review Repairs and Contract Reconciliation Plan

> **For agents:** tick each checklist item as it is completed. Spec: [review-repairs design](../specs/2026-11-02-w1-review-repairs-design.md).

- **Status:** Approved (Dev Lead, 2026-11-02)
- **Goal:** Resolve PR #5's authorization, visibility, unique-read, and OpenAPI defects while adopting PR #6's approved endpoint behavior.
- **In scope:** typed authorization resource resolution; recursive request-facing visibility; scalar and compound unique reads; OpenAPI components and parity; endpoint 6/42/date contract reconciliation; regression evidence.
- **Non-goals:** new role runtime features, migrations, GitHub integration, maintenance-client bypass.
- **Risk tier:** High; authorization, tenancy, and public API permissions change.

## Scope

This plan implements the approved review-repairs design for the existing W1 seams. It changes
authorization resource resolution, request-facing read visibility, compound unique reads, OpenAPI
schema emission, and the endpoint/date contracts explicitly adopted from PR #6. It does not add
new roles, migrations, external integrations, or maintenance-client bypasses.

## Task order

| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 | — | T2, T3 | 1 | Done |
| T2 | — | T1, T3 | 1 | Done |
| T3 | — | T1, T2 | 1 | Done |
| T4 | T1, T3 | — | 2 | Done |
| T5 | T2, T4 | — | 3 | Not started |

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | table-driven authorization matrix; E1-E3, E15-E17, E2a |
| F2 | T2 | visibility policy matrix; E4-E6, E18, E25 |
| F3 | T2 | compound selector and HTTP-boundary tests; E7-E8, E19-E20 |
| F4 | T3 | OpenAPI registry/parity tests; E9, E21-E22 |
| F5 | T4 | policy/doc/date parity tests; E10-E13, E23-E24 |
| N1 | T5 | named E1-E25 suite, `npm test`, `npm run typecheck` |
| E5 | T2 | nested relation-chain and root-project visibility fixtures |
| E11 | T4 | endpoint 42 policy/path/role parity tests |
| E12 | T4 | endpoint 6 response-shape and pagination tests |
| E14 | T1 | resolved-resource mismatch and project-scope tests |
| E16 | T1 | owner/assignee/predicate-specific authorization tests |

## Verification gates

- Every task: targeted tests, then `npm run typecheck` when TypeScript changes.
- Wave 1: full `npm test` after T1-T3.
- Close-out: `npm test`, `npm run typecheck`, approved spec/plan lint, and branch diff review.

### T1: Typed authorization resource resolution

**Delivers:** Resource ownership and predicate data flow through a typed contract owned by `packages/contracts`, with API middleware composing owner adapters and transaction scope.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/contracts/src/authorization.ts` | `ResolvedResource`, `ResourceResolverRegistry`, `AuthorizationScope`, and predicate handoff types. |
| Modify | `packages/contracts/src/index.ts` | Export authorization types. |
| Modify | `packages/api/src/middleware/auth.ts` | Resolve by operation ID, distinguish hidden reads from archived writes, pass resolved data to predicates, and return authorization scope. |
| Modify | `packages/api/test/authorization-matrix.test.ts` | Table-driven coverage for all 57 policy records and predicate-specific resolved data. |
| Modify | `packages/api/test/authorization-project-scope.test.ts` | Resource/project mismatch, archived write, owner, assignee, and transaction-scope cases. |

**Checklist**

- [x] Write failing tests for E1-E3, E15-E17, E2a and the 57-policy resolver matrix.
- [x] Add the typed contract and exports.
- [x] Implement middleware resolution and predicate handoff without table imports.
- [x] Verify missing/deleted reads are 404, archived writes are 409, and handlers are suppressed.
- [x] Run targeted API tests and `npm run typecheck`.
- [x] Update branch state and commit `fix: resolve resource ownership before authorization (W1)`.

**Notes for next task:** Authorization now returns a scope for registered requests; callers must consume `scope.principal`.
Resource lookups are injected and receive the transaction handle before predicate evaluation.

### T2: Recursive visibility and unique-read normalization

**Delivers:** The request-facing DB client filters every registered relation path and safely normalizes all compound unique keys.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/db/src/visibility.ts` | Immutable model/relation policy registry, recursive args transformer, selector validator, and visibility helpers. |
| Modify | `packages/db/src/client.ts` | Apply the registry to root/nested reads, counts, aggregates, groupings, unique reads, and transaction clients. |
| Modify | `packages/db/test/filtered-client.test.ts` | Model/relation matrix, nullable project, OR/AND, selector, hidden-row, and race regressions. |
| Modify | `packages/db/src/transactions.ts` | Provide repeatable-read mutation transaction and row-lock/recheck seam. |
| Modify | `packages/db/test/concurrency.test.ts` | Verify lock, recheck, and mutation ordering. |
| Modify | `packages/api/test/authorization-project-scope.test.ts` | Request-boundary 404 and no-query behavior for malformed selectors. |

**Checklist**

- [x] Write failing tests for E4-E8, E18-E20 and E25.
- [x] Implement `VISIBILITY_POLICY` for all 15 allowlisted models and listed relation chains.
- [x] Normalize all five compound selector names and reject malformed shapes before Prisma.
- [x] Apply filters to nested `select`/`include`, `_count`, `aggregate`, and `groupBy` without mutating writes.
- [x] Implement repeatable-read/row-lock mutation re-check seam and deterministic race oracle.
- [x] Run DB/API targeted tests and `npm run typecheck`.
- [x] Update branch state and commit `fix: enforce recursive request visibility (W1)`.

**Notes for next task:** The Prisma read extension applies registry filters recursively; unique reads are normalized to filtered `findFirst` calls.
Mutation isolation is exposed as an injected lock/recheck seam because the request client has no raw-query bypass.

### T3: OpenAPI schema registry and parity

**Delivers:** Every policy-generated request/response reference resolves to `components.schemas`, with deterministic conflict and unresolved-reference failures.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `packages/contracts/src/openapi-schemas.ts` | Canonical operation-ref registry and schema conflict/unresolved errors. |
| Modify | `packages/contracts/src/openapi.ts` | Emit components, validate refs, and fail atomically. |
| Modify | `packages/contracts/test/openapi.test.ts` | Registry mapping, duplicate, conflict, unresolved, and recursive dereference tests. |
| Modify | `packages/api/test/openapi-parity.test.ts` | Walk all 57 operations and request/response refs. |

**Checklist**

- [x] Write failing tests for E9 and E21-E22.
- [x] Register every generated operation ref, using canonical domain schemas and explicit envelope adapters.
- [x] Emit `components.schemas` and validate every internal reference before returning a document.
- [x] Run contract/API targeted tests and `npm run typecheck`.
- [x] Update branch state and commit `fix: make generated OpenAPI references resolvable (W1)`.

**Notes for next task:** OpenAPI generation defaults to the canonical registry but accepts an explicit registry for isolated tests.
References are validated recursively before the document is returned; duplicate identical registrations are harmless.

### T4: PR #6 normative contract reconciliation

**Delivers:** Endpoint 6, endpoint 42, endpoint 36, and standup-date behavior match PR #6 and all normative sources.

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `packages/contracts/src/policy.ts` | Rename endpoint 42 to `PROJECT_FACTS_READ`, move its path, and allow PM/Dev Lead. |
| Modify | `packages/contracts/src/schemas.ts` | Add the endpoint 6 page-of-`ProjectDetail` response and endpoint 42 mapping. |
| Modify | `packages/contracts/test/policy.test.ts` | Assert exact path, operation ID, policy key, roles, endpoint 6 response, and endpoint 36 retention. |
| Modify | `packages/api/test/authorization-matrix.test.ts` | Assert new route permissions and old-route absence/404. |
| Modify | `docs/architecture/contracts.md` | Update §3.2, §3.4, §3.5, and §3.6. |
| Modify | `docs/architecture/agile-platform-architecture.md` | Update §4, §7, and §13 to match the new endpoint contract and date rule. |
| Create | `packages/contracts/src/date-rules.ts` | Singapore working-day truth table and injected-clock validation helper. |
| Create | `packages/contracts/test/date-rules.test.ts` | Friday/Monday, Saturday/Monday, Sunday/Monday, midnight, malformed, and future-date tests. |

**Checklist**

- [x] Write failing tests for E10-E13 and E23-E24.
- [x] Change policy/schema definitions and update both normative architecture files.
- [x] Implement the exact standup date truth table and preserve AD-44's current-time activity window.
- [x] Verify old endpoint 42 is absent and the new route is PM/Dev Lead member-scoped.
- [x] Run contract/API/date targeted tests and `npm run typecheck`.
- [x] Update branch state and commit `fix: reconcile W1 contracts with UI handover (W1)`.

**Notes for next task:** Endpoint 42 is now the pre-release `/api/projects/{id}/facts` route for PM and Dev Lead members.
Standup validation is pure and clock-injected; future Monday requests retain the current instant as the window end.

### T5: Full verification and close-out

**Delivers:** Evidence for all requirements and a review-ready branch.

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `workflow/project-state/branch-states/w1.md` | Record verification evidence, completed tasks, and the Gate 3 handoff. |
| Modify | `workflow/plans/2026-11-02-w1-review-repairs-plan.md` | Tick completed checklist items and mark the plan complete. |

**Checklist**

**Checklist**

- [ ] Run named tests for E1-E25 and confirm every F/N traceability row.
- [ ] Run `npm test` and `npm run typecheck` from the repository root.
- [ ] Run spec lint and plan lint with approved status.
- [ ] Review the complete branch diff for import boundaries, unresolved refs, and accidental generated files.
- [ ] Update branch state to W1 In review, record all Changes and any Deviations, and remove completed session rows.
- [ ] GATE: Ask the operator for Gate 3 branch-review approval; do not push, open a PR, or merge before approval.
