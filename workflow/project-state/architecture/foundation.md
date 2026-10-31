# Architecture — Foundation (contracts, db, api)

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

Nothing built yet *(planned)*. One repository, one deployable per tier. `packages/contracts` is the single source of truth: zod schemas, one error envelope, and the policy map (allowed roles plus ownership predicate per operation) that every route is gated by. `packages/db` owns the schema with composite foreign keys that keep references inside one project. Route handlers hold no domain logic and never check roles themselves. Frozen first (A-18): contracts with the policy map, `LlmGateway.run`, `AiContext.assemble`, `Sessions`.

## Paths

| Path | Role |
|---|---|
| `packages/contracts` | zod schemas, error codes, OpenAPI generation, the policy map, upload and proposal payload schemas |
| `packages/db` | Prisma schema and migrations; client extension excluding soft-deleted rows and archived projects |
| `packages/api` | Hono app: request id, token check, user lookup, policy-map gate, error mapping |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-01a | 2026-10-29 | Monorepo, one Vercel project per tier, single Hono API | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-01c | 2026-10-29 | REST; zod in packages/contracts is the single source | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-33 | 2026-10-29 | One error envelope with stable code and request id | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-54 | 2026-10-29 | Composite FKs keep every reference inside one project | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-55 | 2026-10-29 | Policy map is the one authorisation mechanism | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-65 | 2026-10-29 | Prisma extension excludes soft-deleted rows; one assertWritable | [decision-log](../../../docs/architecture/decision-log.md) |

## Target Link and Drift

Realises [architecture §4, §5, §6, §8](../../../docs/architecture/agile-platform-architecture.md); work package E in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known (nothing is built).
