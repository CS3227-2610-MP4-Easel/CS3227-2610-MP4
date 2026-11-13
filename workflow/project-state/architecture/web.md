# Architecture — Web UI

> Legend: `C` = project decision. `AD-nn` = architecture decision, recorded in [decision-log.md](../../../docs/architecture/decision-log.md). This area's **Now** is replaced wholesale when a branch changes it; the decisions table only grows.

## Now

The `src/fe` Next.js app is free of Prisma/database imports; its catch-all API adapter forwards `/api/*` to the Hono app, and business rules and authorization stay server-side. `authMode` picks the mode per request: `prototype` (fixtures and the role buttons, mock previews only), `firebase` (live sign-in) or `unconfigured`. In `firebase` mode `AuthRoot` and `SessionProvider` hold the Firebase session (`@firebase/app` and `@firebase/auth` only, loaded in `lib/auth/firebase.ts`), and `AuthGate` gates every page on it. The role comes from `GET /api/me`, never a cookie. Sign-in and register call endpoints 2-4. S20 (Upload and standup) and S18 (Team standups) call endpoints 9, 49-52 and 55 when real sign-in is on (`useAuthMode()`); `lib/api/dev.ts` holds those calls. `apiFetch` (`lib/api/http.ts`) is the only place that calls `fetch`; it attaches the ID token and is confined to same-origin `/api/` paths. `test/source-rules.test.ts` enforces these source rules. The UI tests use Vitest, Testing Library and jsdom and run under the root `npm test`. Screens other than sign-in and register still read fixtures until their workstreams wire them.

## Paths

| Path | Role |
|---|---|
| `src/fe` | Next.js App Router pages, components, contracts client, role-based navigation |
| `src/fe/lib/auth` | auth mode, Firebase client, session, gate |
| `src/fe/lib/api/http.ts` | `apiFetch`, the only `fetch` caller |
| `src/fe/lib/api/dev.ts` | live calls for S20 and S18 |
| `src/fe/components/live/standup-live.tsx`, `team-standups-live.tsx` | live S20 and S18 |

## Decisions

Architecture decisions that shaped this area (`AD-nn`, full reasoning in the decision log). Project decisions (`C<n>`) are added here when they land.

| ID | Date | One-line decision | File |
|---|---|---|---|
| AD-01b | 2026-10-29 | Next.js UI with Hono mounted under /api; src/fe never imports Prisma | [decision-log](../../../docs/architecture/decision-log.md) |
| AD-71 | 2026-10-29 | One person designs the entire UI as mockups; others link flows | [decision-log](../../../docs/architecture/decision-log.md) |
| C24 | 2026-11-02 | Remove the obsolete frontend scaffold | [C24](../decisions/C24.md) |
| C26 | 2026-11-03 | Permit the minimal health-route adapter | [C26](../decisions/C26.md) |
| C64 | 2026-11-08 | `@firebase/app` and `@firebase/auth`, not the `firebase` package | [C64](../decisions/C64.md) |
| C66 | 2026-11-08 | A real auth gate replaces the role cookie; the role comes from `/api/me` | [C66](../decisions/C66.md) |
| C100 | 2026-11-12 | S20/S18 wire the W9 endpoints only | [C100](../decisions/C100.md) |
| C101 | 2026-11-12 | Standup Edit, Use as is and thumbs hidden until W16 | [C101](../decisions/C101.md) |

## Target Link and Drift

Realises [architecture §13](../../../docs/architecture/agile-platform-architecture.md); work package UI (mockups and shell), per role owner for flows in [delivery-plan.md](../../../docs/architecture/delivery-plan.md). Drift: the current prototype still uses mock data for feature flows while W4–W9 connect the live backend.
