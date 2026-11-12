# Edge Cases

| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1 | `GET /api/tasks/{id}` supplies a task ID to a valid member. | Resolve the task's project, call membership with that project ID, then authorize. | Prevents false 404s for resource routes. | unit |
| E2 | F1 | Read resource is missing, deleted, archived, or belongs to another project. | Return `NOT_FOUND` 404 and do not invoke the handler. | Prevents existence leaks and cross-project access. | unit |
| E2a | F1 | Write targets a recognized archived project/resource. | Return `CONFLICT_STATE` 409 from the write guard and perform no write. | Preserves the normative archived-project rule. | service |
| E3 | F1 | MEMBER_OR_ASSIGNEE checks a task's assignee after project membership. | Only a project member or the assigned developer passes; all others receive `NOT_FOUND`. | Protects object-level ownership. | unit |
| E4 | F2 | Root project includes tasks, epics, or counts containing deleted rows. | Nested result and count omit deleted rows. | Closes the review's nested-read leak. | unit |
| E5 | F2 | Nested relation belongs to an archived project. | The nested row is omitted even if the root query is otherwise valid. | Enforces archive read boundary consistently. | unit |
| E6 | F2 | Caller supplies an OR predicate that could bypass visibility. | Existing predicate is retained, but visibility remains mandatory. | Prevents boolean-filter escape. | unit |
| E7 | F3 | `ProjectMember.findUnique({ where: { projectId_userId: {...} } })`. | Selector is translated to a valid unique-read shape; hidden result is `null`. | Prevents runtime Prisma failures. | unit |
| E8 | F3 | Scalar unique read for a deleted task. | Return `null`; `findUniqueOrThrow` raises the not-found sentinel. | Keeps scalar and compound semantics aligned. | unit |
| E9 | F4 | Every policy operation references request/response schemas. | Each ref resolves in `components.schemas`; unresolved refs fail generation or parity test. | Makes generated OpenAPI usable by consumers. | unit |
| E10 | F5 | Endpoint 6 list row. | Response schema is `ProjectDetail`, including progress. | Aligns W1 with PR #6 handover. | unit |
| E11 | F5 | PM requests project facts as a member. | Endpoint 42 path and policy allow PM and return `Facts`. | Aligns role behavior with the UI handover. | unit |
| E12 | F5 | PM resumes an in-progress plan through endpoint 36. | Endpoint remains in the Tier 1 contract and is not removed or demoted. | Prevents a UI continuation break. | unit |
| E13 | F5 | Standup date is Friday, Saturday, Sunday, Monday-Thursday, or later. | Friday accepts Friday/Monday; Saturday accepts Saturday/Monday; Sunday accepts Sunday/Monday; Monday-Thursday accept that day/next day; all other dates return 422. | Defines the time boundary exactly. | unit |
| E14 | N1 | Full regression suite and typecheck. | Named tests cover F1-F5 and E1-E25; `npm test` and `npm run typecheck` exit 0. | Evidence before review. | integration |
| E15 | F1 | SELF route for another developer's standup/item/session. | Return `NOT_FOUND` and do not query or return the other user's content. | Prevents ownership bypass. | unit |
| E16 | F1 | ADDER route targets a role the caller cannot add. | Return `NOT_FOUND` or existing forbidden predicate result without mutation. | Preserves role hierarchy. | unit |
| E17 | F1 | Resource ID and caller-supplied project ID disagree. | Resolve from the resource; reject with `NOT_FOUND`. | Prevents caller-controlled tenancy. | unit |
| E18 | F2 | Nested `select`, to-one relation, `_count`, aggregate, and groupBy contain hidden rows. | Every result includes only visible rows; omitted visibility fields do not disable filtering. | Closes recursive bypasses. | unit |
| E19 | F3 | Compound selector is missing a member, has an unknown key, null, wrong type, or prototype-like key. | Fail closed with `NOT_FOUND` at the request boundary; no malformed Prisma query is sent. | Prevents invalid or confused-deputy queries. | unit |
| E20 | F3 | Compound unique result has an archived project or `findUniqueOrThrow` is used. | Return `null` or raise the existing `NOT_FOUND` sentinel; never return the row. | Aligns unique and list visibility. | unit |
| E21 | F4 | Same schema name is registered twice identically or differently. | Identical registration succeeds idempotently; differing registration throws `OPENAPI_SCHEMA_CONFLICT` during generation. | Prevents contract drift. | unit |
| E22 | F4 | Internal reference is missing from the registry. | Generation throws `OPENAPI_UNRESOLVED_REF` and emits no document. | Makes failure deterministic. | unit |
| E23 | F5 | Endpoint 42 old path is requested. | Route is absent and returns 404; new path accepts PM and Dev Lead members only. | Proves the permission/path migration. | service |
| E24 | F5 | Standup date is Saturday/Sunday, Singapore midnight, malformed, impossible, previous, or more than one working day ahead. | Only today and the next working day pass; all other values return `VALIDATION_FAILED` 422. | Defines all date boundaries. | unit |
| E25 | N1 | Concurrent archive, membership removal, deletion, reassignment, or version update races a mutation. | The locked transaction re-checks state; the losing operation returns the operation-specific 409 (`CONFLICT_STATE` for archive/delete, `CONFLICT_VERSION` for version, `NOT_FOUND` for membership removal) and leaves no partial write. | Prevents check-then-use leaks and corruption. | integration |

## What could corrupt data

- A malformed compound selector could read or mutate the wrong membership row; T2 must normalize selectors without dropping key fields, and E7 proves the exact field mapping.
- A route-aware resolver could associate a resource with the wrong project; T1 must verify the resource's stored project ownership before membership checks, and E1-E3 cover missing, archived, and cross-project cases.
- A contract mismatch could cause a consumer to write data using the wrong endpoint or shape; T4 must keep endpoint IDs stable except for the explicitly approved endpoint-42 path change, and E10-E13 verify the resulting public contract.
- A concurrent authorization/use race could allow a write after membership or ownership changes; the mutation transaction re-checks project state, membership, ownership, and version, with E25 proving rollback/no partial write.
- A resolver implementation could omit a route; the table-driven 57-policy test must assert every policy has a resolver or an explicit `NONE` predicate, with all resource kinds covered by the matrix.
