# Architecture — Developer role module

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

Nothing built yet *(planned)*. Input is an uploaded JSON file of commit and PR items (max 1 MB, 100 items, no diffs). Items belong to the uploader. Summaries are batched (up to 10 per call) and cached per item; a standup is one developer, one project, one day, with a code-built degraded fallback.

## Paths

| Path | Role |
|---|---|
| `packages/dev (planned)` | upload routes, activity_items, item_summaries, standups, prompts |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-20 | 2026-10-29 | Developer input is an uploaded structured JSON file, no diffs | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-27 | 2026-10-29 | A standup is one developer, one project, one day | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-38 | 2026-10-29 | Uploads at most 1 MB and 100 items; batches of 10; cached per item | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-60 | 2026-10-29 | Uploaded item has no author field; belongs to the uploader | [decision-log](../../../docs/architecture/decision-log.md) |

## Target Link and Drift

Realises [architecture §9.4](../../../docs/architecture/agile-platform-architecture.md); work package I in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known (nothing is built).
