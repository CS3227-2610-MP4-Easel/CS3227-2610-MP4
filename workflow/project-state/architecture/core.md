# Architecture — Core domain and proposals

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

Nothing built yet *(planned)*. Owns the domain tables and the pure progress and velocity functions. Transactions start in the owning module; no model call runs inside a transaction. `proposals` never writes domain tables directly, it calls `core.applyPlan` and `applyReplan` with a transaction handle. Approval is one transaction with a row-lock claim.

## Paths

| Path | Role |
|---|---|
| `packages/core (planned)` | projects, members, checkpoints, epics, sprints, tasks, events; progress and velocity; applyPlan, applyReplan |
| `packages/proposals (planned)` | ai_proposals, proposal_epics, claim-and-apply protocol |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-10 | 2026-10-29 | One ai_proposals table; approval applies in one transaction | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-12 | 2026-10-29 | Story points 1,2,3,5,8,13; derived values computed in code | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-35 | 2026-10-29 | version on mutable entities; repeats safe by state | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-36 | 2026-10-29 | Soft delete; archive projects; DONE task cannot be deleted | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-46 | 2026-10-29 | A PLAN is approvable only when every epic is expanded | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-61 | 2026-10-29 | Plan epics are rows in proposal_epics | [decision-log](../../../docs/architecture/decision-log.md) |

## Target Link and Drift

Realises [architecture §4, §5, §9.2, §11](../../../docs/architecture/agile-platform-architecture.md); work package B in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known (nothing is built).
