# Architecture — Web UI

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

Nothing built yet *(planned)*. UI only: no database or Prisma import (enforced by a test), no business rules, role checks are a convenience not a control. All screens use live data through the contracts client. One person designs the whole UI as mockups (AD-71) and the others link their flows to the backend. AI text is rendered as plain text.

## Paths

| Path | Role |
|---|---|
| `apps/web` | Next.js App Router pages, components, contracts client, role-based navigation |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-01b | 2026-10-29 | Next.js UI with Hono mounted under /api; apps/web never imports Prisma | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-71 | 2026-10-29 | One person designs the entire UI as mockups; others link flows | [decision-log](../../../docs/architecture/decision-log.md) |

## Target Link and Drift

Realises [architecture §13](../../../docs/architecture/agile-platform-architecture.md); work package UI (mockups and shell), per role owner for flows in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known (nothing is built).
