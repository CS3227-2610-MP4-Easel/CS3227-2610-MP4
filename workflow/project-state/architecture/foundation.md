# Architecture — Foundation (contracts, db, api)

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

The repository has one source-root frontend package at `src/fe` and four backend packages under `src/be/*`. `src/be/contracts` is the single source of truth: zod schemas, one error envelope, OpenAPI schemas, and the policy map that gates every route. `src/be/db` owns the Prisma schema, filtered request-facing client, recursive visibility enforcement, and transaction seams; it excludes soft-deleted and archived data and protects compound project keys. `src/be/api` provides typed resource-resolution and authorization seams, the shared `ROUTES` registry, request parsing/error mapping, and the health endpoint. Route handlers hold no domain logic and never check roles themselves. `src/be/db` also exposes `isInTransaction()`, true inside `inCoreTransaction`, `inMutationTransaction` and the filtered client's callback `$transaction`, so the gateway can refuse a model call inside a transaction (W2, spec SD6). Frozen first (A-18): contracts with the policy map, `LlmGateway.run`, `AiContext.assemble`, `Sessions`.

## Paths

| Path | Role |
|---|---|
| `src/be/contracts` | zod schemas, error codes, OpenAPI generation, the policy map, upload and proposal payload schemas |
| `src/be/db` | Prisma schema and migrations; client extension excluding soft-deleted rows and archived projects |
| `src/be/api` | Hono app: request id, token check, user lookup, policy-map gate, error mapping |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-01a | 2026-10-29 | Monorepo, one Vercel project per tier, single Hono API | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-01c | 2026-10-29 | REST; zod in `src/be/contracts` is the single source | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-33 | 2026-10-29 | One error envelope with stable code and request id | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-54 | 2026-10-29 | Composite FKs keep every reference inside one project | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-55 | 2026-10-29 | Policy map is the one authorisation mechanism | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-65 | 2026-10-29 | Prisma extension excludes soft-deleted rows; one assertWritable | [decision-log](../../../docs/architecture/decision-log.md) |
| C20 | 2026-11-02 | Existing architecture contracts remain normative | [C20](../decisions/C20.md) |
| C21 | 2026-11-02 | Shared facts endpoint contract | [C21](../decisions/C21.md) |
| C22 | 2026-11-02 | Source-root monorepo | [C22](../decisions/C22.md) |
| C23 | 2026-11-02 | Backend-only source-root migration | [C23](../decisions/C23.md) |
| C25 | 2026-11-02 | Separate frontend typechecking | [C25](../decisions/C25.md) |
| C24 | 2026-11-02 | Remove the obsolete frontend scaffold | [C24](../decisions/C24.md) |
| C26 | 2026-11-03 | Permit the minimal health-route adapter | [C26](../decisions/C26.md) |

## Target Link and Drift

Realises [architecture §4, §5, §6, §8](../../../docs/architecture/agile-platform-architecture.md); work package E in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: feature modules still need to implement the handed-over resource resolvers and auth dependencies; the filtered client does not authorize nested writes or relation filters by itself (see guardrails).
