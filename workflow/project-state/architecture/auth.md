# Architecture — Authentication and registration

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

Nothing built yet *(planned)*. Firebase ID token verified server-side on every request; the application role comes from `users`, never from a claim. Registration codes (13+ characters, constant-time compare, per-IP limited by an HMAC of the IP) gate sign-up. Owns `users` and `rate_counters`.

## Paths

| Path | Role |
|---|---|
| `packages/api/auth (planned)` | token verification, registration, codes, requireMember, rate_counters hit() |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-03 | 2026-10-29 | Firebase Auth; role read from our database | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-08 | 2026-10-29 | Registration codes per role per environment | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-59 | 2026-10-29 | Limiter is a fixed-window counter table | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-63 | 2026-10-29 | Codes at least 13 characters; demo codes for local and dev | [decision-log](../../../docs/architecture/decision-log.md) |

## Target Link and Drift

Realises [architecture §7, §9.1](../../../docs/architecture/agile-platform-architecture.md); work package A in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: none known (nothing is built).
