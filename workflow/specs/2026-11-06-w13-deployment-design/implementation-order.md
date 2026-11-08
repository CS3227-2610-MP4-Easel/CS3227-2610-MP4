# W13 implementation order

| Task | Outcome | Requirements |
|---|---|---|
| T1 | Define tier configuration and secret-name validation | F1, F2, F3, N1 |
| T2 | Add deterministic, idempotent non-production seed data | F6 |
| T3 | Add migration compatibility and recovery procedure | F4, F5, F8, N2 |
| T4 | Configure dev Vercel deployment and tier-scoped variables | F2, F3 |
| T5 | Run recovery rehearsal and record readiness evidence | F8, N2 |
| T6 | Configure protected production GitHub Environment migration/deploy job | F4, N1 |
| T7 | Add deployment smoke checks and redacted evidence | F7, N3 |

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 | — | T2 | 1 |
| T2 | — | T1 | 1 |
| T3 | T1 | — | 2 |
| T4 | T1 | T3 | 3 |
| T5 | T3, T4 | — | 4 |
| T6 | T1, T3, T5 | T4 | 5 |
| T7 | T1, T4, T6 | — | 6 |

T4 and T6 must not share workflow files in the implementation plan; if the existing CI workflow
must be edited by both, serialize those edits. T5 is the production-readiness gate and cannot be
declared complete without the repository owner's Neon evidence. T6 must build and smoke-test an
immutable candidate before promotion; two production jobs cannot overlap.
