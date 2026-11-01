# W1 Edge Cases and Security Cases

| ID | Case | Required behavior | Test evidence |
|---|---|---|---|
| E1 | F2: unknown JSON key | Reject with 422 `VALIDATION_FAILED` and identify the field. | Contract test with an extra key. |
| E2 | F2: server-managed field in request | Reject with 422; do not strip and continue. | Contract tests for `id`, `projectId`, `version`, timestamps, and AI fields. |
| E3 | F6/N2: malformed JSON, wrong content type, malformed UUID, invalid enum, or invalid pagination | Return 400 `BAD_REQUEST` for malformed JSON/content type; return 422 `VALIDATION_FAILED` with field details for malformed path/query values. | API boundary tests for each input class. |
| E4 | F3: missing policy entry | Refuse route registration or contract verification; never expose the route as authorized. | Route/policy completeness test. |
| E5 | F3/N1: wrong role | Return 403 `FORBIDDEN_ROLE`; do not invoke the handler. | Generated policy test. |
| E6 | F4/N3: missing or cross-project resource | Return 404 `NOT_FOUND` without confirming whether the resource exists. | Composite-FK and authorization tests. |
| E7 | F5/N3: archived project write | Route/service seam returns 409 `CONFLICT_STATE`; no row changes. | `assertWritable` contract test. |
| E8 | F2/N5: stale mutable version | Return 409 `CONFLICT_VERSION`; no row changes. | Version contract test. |
| E9 | F4/N3: cross-project child identifier | Path/resource access returns 404; a body relationship uses the exact 422 or 404 mapping in normative `contracts.md` §3; never create a cross-project relation. | Parity fixture plus per-endpoint API and database constraint tests. |
| E10 | F5: soft-deleted row in ordinary read | Exclude it by default; explicit maintenance opt-out is required. | Filtered-client test. |
| E11 | F6/N4: sensitive log input or spoofed request id | Request logs omit credentials, tokens, codes, prompts, responses, and raw secrets; the response uses a server-generated UUID. | Log-capture and spoofed-header tests. |
| E12 | F8: frozen interface drift | Contract type changes require all three owners' agreement before merge. | Typecheck and interface snapshot review. |
| E13 | F7: health route without auth or DB | Return 200 even when authentication or database services are unavailable. | Isolated health test. |
| E14 | F9/N6: migration incompatible with previous app | Reject the migration plan unless the previous app can continue during the deployment window. | Migration review checklist and compatibility test. |
| E15 | F1: workspace package boundary missing or unresolved | Fail the workspace validation before feature packages can consume the boundary. | Workspace install and package-resolution test. |
| E16 | N1: missing/invalid token, unregistered token, wrong role, or failed membership | Return 401, 403 `USER_NOT_REGISTERED`, 403 `FORBIDDEN_ROLE`, or 404 `NOT_FOUND` in that order; never invoke the handler. | Injected-auth matrix test. |
| E17 | N5: two writers use the same version | Exactly one atomic compare-and-increment succeeds; the other returns 409 and no newer data is lost. | Concurrent update test. |
| E18 | F3: duplicate route, operation, or policy binding | Reject registration before dispatch. | Route collision test. |
| E19 | F5: relation/count/aggregate/raw-query filter bypass | Apply default filters to every request-facing read and reject maintenance capability access. | Filter coverage test. |
| E20 | F9: incompatible migration or unavailable recovery target | Reject deployment evidence until previous-version compatibility and the 24-hour/4-hour recovery target are verified; never run destructive rollback. | Migration compatibility and restore verification test. |

## What could corrupt data

- A client could submit a child id from another project; composite foreign keys and service-level project checks reject the write (E6, E9).
- A stale update could overwrite a newer mutable row; version checks reject it without a write (E8).
- A write could target an archived project; `assertWritable` rejects it before mutation (E7).
- A migration could remove or weaken a constraint during deployment; forward-only compatibility review and schema validation block it (E14).
- A maintenance query could expose or mutate soft-deleted data; the filtered client requires an explicit opt-out (E10).
- Two concurrent writers could overwrite each other; atomic version compare-and-increment prevents lost updates (E17).
- A duplicate route could bind a weaker policy to an existing path; registration rejects collisions before dispatch (E18).

