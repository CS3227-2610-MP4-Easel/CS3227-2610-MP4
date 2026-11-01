# Implementation Order

All tasks need W1 merged: the monorepo, tables and the seams in [conventions.md](conventions.md).

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T1 | Auth settings and startup assertions | validated settings for later tasks | N4 |
| T2 | `hit` limiter and IP key helper | the fixed `hit` signature W2 relies on | F3, N3 |
| T3 | `TokenVerifier`, `authenticate`, `loadUser` | identity and role on every request | F1, F2, N5, N6, N7 |
| T4 | Endpoint 2 `check-code` | code check with constant-path comparison | F4, N1, N2 |
| T5 | Endpoint 3 `register` | user creation | F5, N1 |
| T6 | Endpoint 4 `me` | the caller's profile | F6 |
| T7 | Wire the sign-in and register screen | the end-to-end path | F7 |

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Settings | - | T2 | 1 |
| T2 Limiter | - | T1 | 1 |
| T3 Token and user middleware | T1 | T4 | 2 |
| T4 check-code | T1, T2 | T3 | 2 |
| T5 register | T3, T4 | T6 | 3 |
| T6 me | T3 | T5 | 3 |
| T7 Screen | T4, T5, T6 | - | 4 |

Shared-file hazards: T4, T5 and T6 each add a line to the route registration file from W1, so merge those edits one at a time. T7 also waits for the W10 mockup.
