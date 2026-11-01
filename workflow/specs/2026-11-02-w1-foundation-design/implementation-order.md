# W1 Implementation Order

The plan will turn these contract tasks into exact file-level work. The dependency table defines the required order and prevents later slices from depending on unfinished seams.

| Task | Deliverable | Depends on | Wave | Done when |
|---|---|---|---:|---|
| T1 | Workspace scaffold and package boundaries | — | 1 | npm workspace install and package-level typecheck commands resolve. |
| T2 | Shared contract schemas, error codes, pagination, enums, and frozen interface implementations | T1 | 2 | Contract package matches `docs/architecture/contracts.md` and rejects unknown/server-managed input. |
| T3 | Policy map and route registration contract | T2 | 3 | The policy map matches all 57 entries in `contracts.md` and completeness verification detects a missing or duplicate operation. |
| T4 | Prisma schema, enums, constraints, indexes, and filtered client seam | T1 | 2 | Schema validates, Prisma client generates, and DMMF/migration parity covers architecture §5. |
| T5 | Initial migration and migration documentation | T4 | 3 | Local migration applies to a clean database and the forward-only rule is documented. |
| T6 | API boundary, request id, error mapping, and health route | T2, T3 | 4 | Health contract passes without auth or DB; malformed input and common errors have the specified envelope. |
| T7 | Cross-boundary, policy, OpenAPI, authorization, and import-rule verification seams | T2, T3, T4, T6 | 4 | Tests compare all normative contract data with the route table/OpenAPI; detect web-to-db imports, route collisions, unregistered routes, denial ordering, project-boundary failures, filtered-client bypass, and policy omissions. |
| T8 | Frozen-first handoff | T2, T3, T4, T6 | 5 | W2, W4, W5, and W6 can consume the documented types without changing their public shapes. |

## Parallel waves

| Wave | Tasks | Shared-file rule |
|---|---|---|
| 1 | T1 | Root workspace files only. |
| 2 | T2, T4 | T2 owns contracts; T4 owns db; neither edits the other's package. |
| 3 | T3, T5 | T3 owns policy registration; T5 owns migrations and schema validation. |
| 4 | T6, T7 | T6 owns API boundary; T7 owns verification tests. |
| 5 | T8 | Handoff documentation and branch-state update. |

