# Architecture — Dev Lead role module

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

Nothing built yet *(planned)*. Code computes the facts (progress, velocity, projected completion, checkpoint risk, overload); the model only explains and proposes re-plan changes from a closed set. On AI failure the facts are still returned, marked degraded.

## Paths

| Path | Role |
|---|---|
| `packages/lead (planned)` | pure forecast functions, digest and re-plan prompts, project_digests |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-22 | 2026-10-29 | Code computes the facts; the model explains and proposes | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-34 | 2026-10-29 | AI failures per feature | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-40 | 2026-10-29 | Forecast uses the last 3 closed sprints or fewer | [decision-log](../../../docs/architecture/decision-log.md) |

## Target Link and Drift

Realises [architecture §9.3, §11](../../../docs/architecture/agile-platform-architecture.md); work package H in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known (nothing is built).
