# Implementation Order

| Task | Outcome | Delivers | Satisfies |
|---|---|---|---|
| T1 | Authorization resource-resolution contract and tests | `packages/contracts/src/authorization.ts`, `packages/api/src/middleware/auth.ts`, `packages/api/test/authorization-matrix.test.ts`, `authorization-project-scope.test.ts`; owner adapters are injected interfaces only, and tests freeze `ResolvedResource`, `AuthorizationScope`, the 57-policy table, and transaction propagation | F1, E1-E3, E15-E17, E2a |
| T2 | Recursive DB visibility and unique-read normalization | `packages/db/src/client.ts`, `packages/db/src/visibility.ts`, `packages/db/test/filtered-client.test.ts`, `packages/api/test/authorization-project-scope.test.ts`; implement `VISIBILITY_POLICY`, exact relation chains, all five compound-key normalizers, request-boundary 404 mapping, and the deterministic repeatable-read/row-lock race test | F2, F3, E4-E8, E18-E20, E25 |
| T3 | OpenAPI schema registry and parity tests | `packages/contracts/src/openapi.ts`, `packages/contracts/src/openapi-schemas.ts`, `packages/contracts/test/openapi.test.ts`, `packages/api/test/openapi-parity.test.ts`; define every operation-ref mapping, recursively dereference every request/response ref, assert all components, and assert atomic conflict/unresolved failures | F4, E9, E21-E22 |
| T4 | PR #6 contract reconciliation | `packages/contracts/src/policy.ts`, `packages/contracts/src/schemas.ts`, `packages/contracts/test/policy.test.ts`, `packages/api/test/authorization-matrix.test.ts`, `docs/architecture/contracts.md` §3.2/§3.4/§3.5/§3.6, `docs/architecture/agile-platform-architecture.md` §4/§7/§13, and date helper/tests; endpoint 42 replacement, operation-ID rename, endpoint 6 `PageProjectDetail`, old-route 404, and date truth table are normative and doc-parity tested | F5, E10-E13, E23-E24 |
| T5 | Full verification and close-out | `workflow/specs/...` traceability, `npm test`, `npm run typecheck`, spec/plan lint, review diff, and branch-state handoff; close-out must name E1-E25 and all changed normative files | N1, E14, E25 |

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 | — | T2, T3 | 1 |
| T2 | — | T1, T3 | 1 |
| T3 | — | T1, T2 | 1 |
| T4 | T1, T3 | — | 2 |
| T5 | T2, T4 | — | 3 |
