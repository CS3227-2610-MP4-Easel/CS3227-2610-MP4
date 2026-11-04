# Implementation Order

W1 is merged. T0 adds the seams W1 does not provide (C~6, C~9); everything else builds on it. See [conventions.md](conventions.md).

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T0 | Seams: `RouteDefinition.before` and `ApiContext.identity` in W1's `registerRoute`; empty `@agile/auth` package | the hooks and home every later task needs | F1, F5 (enables) |
| T1 | Auth settings, including `APP_TIER` (C~7), and startup assertions | validated settings for later tasks | N4 |
| T2 | `hit` limiter (statement in `@agile/db`, C~10) and IP key helper | the fixed `hit` signature W2 relies on | F3, N3 |
| T3 | `TokenVerifier`, `resolvePrincipal`, `lookupRegisteredUser`, wired into `createApiApp(deps)` | identity and role on every request | F1, F2, N5, N6, N7 |
| T4 | Endpoint 2 `check-code` | code check with constant-path comparison | F4, N1, N2 |
| T5 | Endpoint 3 `register` | user creation | F5, N1 |
| T6 | Endpoint 4 `me` | the caller's profile | F6 |

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T0 Seams | - | - | 1 |
| T1 Settings | T0 | T2 | 2 |
| T2 Limiter | T0 | T1 | 2 |
| T3 Token and user middleware | T1 | T4 | 3 |
| T4 check-code | T1, T2 | T3 | 3 |
| T5 register | T3, T4 | T6 | 4 |
| T6 me | T3 | T5 | 4 |

Shared-file hazards: T4, T5 and T6 each add a route to `src/be/api/src/routes/auth.ts`, so merge those edits one at a time. T0 edits W1's `register.ts` and `contracts/src/routes.ts`; keep it one commit so the Dev Lead can review it alone. T7, the sign-in screen, moved to [follow-up-t7.md](follow-up-t7.md) (SD18).
