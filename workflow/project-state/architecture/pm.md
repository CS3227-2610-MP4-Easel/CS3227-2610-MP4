# Architecture — PM role module

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

Nothing built yet *(planned)*. Two-stage plan: a strong model outlines, a cheaper model expands each epic, each stage-2 call its own request. A failed AI call returns an error with a "create manually" path. Similar-item retrieval is titles only, across the PM's member projects, behind a flag.

## Paths

| Path | Role |
|---|---|
| `packages/pm (planned)` | PM routes, plan prompts and sections, similar-item search |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-21 | 2026-10-29 | PM plan in two stages | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-28 | 2026-10-29 | Top 5 similar items by Postgres full-text search, behind a flag | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-56 | 2026-10-29 | Retrieval across the PM's member projects, titles only | [decision-log](../../../docs/architecture/decision-log.md) |

## Target Link and Drift

Realises [architecture §9.2](../../../docs/architecture/agile-platform-architecture.md); work package G in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known (nothing is built).
