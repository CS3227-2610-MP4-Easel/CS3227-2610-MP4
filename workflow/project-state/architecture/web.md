# Architecture — Web UI

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

The `src/fe` Next.js prototype is merged and remains free of Prisma/database imports. Its catch-all API adapter forwards requests to the Hono app so `/api/health` and backend routes are reachable; business rules and authorization remain server-side. The remaining screens use the contracts client and are handed from mock data to live backend flows by their owning workstreams.

## Paths

| Path | Role |
|---|---|
| `src/fe` | Next.js App Router pages, components, contracts client, role-based navigation |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-01b | 2026-10-29 | Next.js UI with Hono mounted under /api; src/fe never imports Prisma | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-71 | 2026-10-29 | One person designs the entire UI as mockups; others link flows | [decision-log](../../../docs/architecture/decision-log.md) |
| C24 | 2026-11-02 | Remove the obsolete frontend scaffold | [C24](../decisions/C24.md) |
| C26 | 2026-11-03 | Permit the minimal health-route adapter | [C26](../decisions/C26.md) |

## Target Link and Drift

Realises [architecture §13](../../../docs/architecture/agile-platform-architecture.md); work package UI (mockups and shell), per role owner for flows in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: the current prototype still uses mock data for feature flows while W4–W9 connect the live backend.
