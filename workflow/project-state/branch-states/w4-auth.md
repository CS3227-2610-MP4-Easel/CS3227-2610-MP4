# Branch State — w4-auth

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w4-auth (from `INT` at `0dbbdcb`; spec merged in PR #4; fast-forwarded to `INT` at `7bd6544` after W1 merged)
- **Base:** 7bd6544
- **Owner:** ludannnn (Developer member)
- **Status:** Approved
- **Approved:** ludannnn 2026-11-04
- **Last updated:** 2026-11-04 by Claude Opus 5.5 — approved at Gate 3; push and PR await a separate yes

**Untouched:** Conventions, Lessons

---

**Scope.** W4 Auth and registration: endpoints 2, 3 and 4, plus the Firebase token check, on top of the W1 foundation. The approved spec is on `INT` (PR #4); this round amends it to the seams W1 actually built, then plans and builds T1 to T6. The PR #4 branch state has not been folded yet (Gate 4, project owner).

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [x] Spec amendment for the W1 seams (C~6 to C~10); spec lint passes.
- [x] Interface stubs (ddac104).
- [x] Plan approved at Gate 2.
- [x] T0 to T6 and close-out, per the plan; Attacker and Tester reviews done.
- [x] Gate 3: operator approved the branch (ludannnn, 2026-11-04).
- [x] Pushed and opened PR #10 into `development` (operator yes, 2026-11-04).
- [ ] After merge: project owner folds this branch state (Gate 4).
- [x] Request body schemas: W4's stricter fixed-message schemas live in `src/be/api/src/routes/auth.ts`; contracts' `UserInputSchema` is unchanged and looser.
- [ ] **T7 follow-up:** write its own spec and PR from `workflow/specs/2026-10-31-w4-auth-design/follow-up-t7.md` once W10's real data layer and a `src/fe` UI test runner exist; target 10 Nov (C~11).
- [ ] Ask the PM whether W10 delivers a working sign-in page or a design only.
- [ ] **Handover:** correct architecture §7, which says a valid token always belongs to a verified, enabled account. Firebase does not guarantee that; see Known Gaps.
- [ ] **Handover:** tell the Dev Lead that W5 now owns `requireMember`, and that endpoint 10 must lowercase emails before lookup.
- [ ] **Handover:** `apiApp` validates auth settings when its module loads (from T3), so `next build`, `next dev` and every deployed tier need `APP_TIER` and the auth settings (`FIREBASE_PROJECT_ID`, the three `REGISTRATION_CODE_*`, `RATE_KEY_SECRET`) set; W13 for deployed tiers, `src/fe/.env.local` locally. Mock previews may omit all but `APP_TIER=preview`.
- [ ] **Handover:** W13 smoke checks on the deployed tiers (the limiter trusts `x-vercel-forwarded-for`, so dev and prod must run behind Vercel; on any other host a client can pick its own bucket): a forged `x-vercel-forwarded-for` must not change the limiter bucket, and a token from another Firebase project must get 401. `RATE_KEY_SECRET` must differ between dev and prod.
- [ ] **Handover:** the integration tests (E8, E10, E22, E23, E26, E35, E41) skip when `W1_INTEGRATION_DATABASE_URL` is unset, and the repo has no CI workflow; whoever adds CI should give it a Postgres 16 and fail when the URL is missing.
- [ ] **Handover:** add `REGISTRATION_CODE_*` and `RATE_KEY_SECRET` per tier in W13, and confirm `firebase-admin` verifies with only a project id on Vercel. Firebase's verify-token page says a service account is needed; if the smoke test fails, record a Deviation.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W4 | Auth and registration | In review | [spec](../../specs/2026-10-31-w4-auth-design.md) | [plan](../../plans/2026-11-04-w4-auth.md) | T0–T6 done; PR #10 open | guide out of date: auth |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-04 | Close-out: Attacker and Tester lenses, no blocking findings. Fixed: `identity` set only when the token email is a string; tests for register's own bucket and 60 s/20 window, register 401/400/422/500 paths, error codes on E27/E42, no row on check-code, `X-Request-Id` on `me`, multibyte token length, full SHA-256 digests in E30, and `hit` over real Postgres (`hit-integration.test.ts`); 175 tests, none skipped. Accepted, not changed: demo codes valid on dev and preview (AD-63, E24), slow-body requests bounded only by the platform timeout | W4 | b2d987e |
| 2026-11-04 | T5: register endpoint and `createUser` (P2002 by code to 409); outside the plan: `createApiApp` gains an optional `routes` argument so E25 runs through the real error logging, shared fakes moved to `src/be/api/test/auth-fakes.ts`, and the body-size check no longer awaits `cancel()` on a cloned body (it hung); 170 tests, none skipped | W4 | 8118375 |
| 2026-11-04 | T6: `GET /api/me` returns the stored row mapped to `User`; E31 offline run (network denied by `sandbox-exec`, no database): 151 pass, 4 skipped, 0 fail; with database 155 pass | W4 | a86de44 |
| 2026-11-04 | T4: check-code endpoint with `limitedBefore` (IP limiter, streamed 4 KiB cap), fixed-message body schema, hashed constant-path code check; 152 tests, none skipped | W4 | 7cfedfa |
| 2026-11-04 | T3: Firebase adapter, `resolvePrincipal`, `lookupRegisteredUser`, auth runtime, `createAppDependencies` with fail-closed W5 placeholders, test env setup; key-fetch failure mapped to 500 (D~1); 138 tests, none skipped | W4 | 00ca030 |
| 2026-11-04 | T2: `incrementRateCounter` atomic UTC upsert, `createHit` checks and clamp, `clientIpKey` (/64, mapped IPv4, HMAC); E8/E10/E35 pass on Postgres 16; 126 tests, none skipped | W4 | b000037 |
| 2026-11-04 | T1: `loadAuthSettings` validates `APP_TIER`, the emulator ban, codes, secret and preview nulls; 13 tests (E24, E50) | W4 | ed2d8bf |
| 2026-11-04 | T0: `registerRoute` runs `before` ahead of authorization (adds `X-Request-Id` to its response) and gives TOKEN routes `identity`; 104 tests pass | W4 | 9f59c61 |
| 2026-11-04 | Plan written, reviewed (Implementer lens: 2 blocking, 8 non-blocking, all fixed) and approved at Gate 2; review moved T4 after T3 in the spec's dependency table | W4 | 4e961c4 |
| 2026-11-04 | T7, F7 and the UI edge cases moved to `follow-up-t7.md` (spec SD18); operator chose the split | W4 | e7fead8 |
| 2026-11-04 | Dev Lead confirmed the five seam decisions (spec SD13 to SD17) | W4 | 0106813 |
| 2026-11-04 | Interface stubs: `@agile/auth` package, `incrementRateCounter` stub in `@agile/db`, optional `before`/`identity` route fields; typecheck green, 99 tests pass | W4 | ddac104 |
| 2026-11-04 | Spec amended to the merged W1 seams: real paths, `resolvePrincipal`/`lookupRegisteredUser`, new T0 for `before`/`identity`, `APP_TIER`, `@agile/auth` package, `hit` statement in `@agile/db`, frontend Firebase settings (SD13 to SD17); operator re-approved it at Gate 1 | W4 | b6ef5d7 |
| 2026-10-31 | W4 auth spec written, reviewed and approved | W4 | e600d0a |

---

## 4. Architecture

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### 4.1 Authentication and registration (`architecture/auth.md`)

**Now (proposed):** `auth` is the workspace package `src/be/auth` (`@agile/auth`). `loadAuthSettings` validates `APP_TIER`, the Firebase project id, the three registration codes (13 to 128 characters, distinct, no demo codes on prod) and `RATE_KEY_SECRET` at module load and throws on unsafe values; `FIREBASE_AUTH_EMULATOR_HOST` is refused on every tier; a preview with no data settings starts with them null, and routes needing them return 500. `createFirebaseTokenVerifier` checks ID tokens with `firebase-admin` (no revocation check, AD-57); `createResolvePrincipal` turns a `Bearer` header into `{ firebaseUid, tokenClaims.email }` with the email lowercased, and `createLookupRegisteredUser` reads the role from `users`, never from a claim. `createHit` is the AD-59 fixed-window limiter over `@agile/db`'s `incrementRateCounter`; `clientIpKey` keys it by an HMAC of the purpose and the first `x-vercel-forwarded-for` value (IPv6 grouped to /64, anything invalid to `unknown`). `checkRegistrationCode` compares SHA-256 digests with `timingSafeEqual`; `createUser` maps a unique violation (P2002) to `AlreadyRegistered`; `getUser` returns only the `User` contract fields. `getAuthRuntime()` builds all of this once from `process.env` around one `PrismaClient`. The routes for endpoints 2 (`check-code`), 3 (`register`) and 4 (`me`) live in `src/be/api/src/routes/auth.ts`; 2 and 3 run a `before` hook that counts the attempt per client IP (20 a minute) and caps the body at 4 KiB before authorization or parsing. `requireMember` is not here: W5's `core` owns it (C~5, C~8). The sign-in screen is a follow-up (C~11).

| Path | Role |
|---|---|
| `src/be/auth/src/settings.ts` | settings validation per tier |
| `src/be/auth/src/token-verifier.ts`, `principal.ts` | Firebase token check, principal resolution, registered-user lookup |
| `src/be/auth/src/rate-limit.ts` | `hit()` and client-IP keys |
| `src/be/auth/src/registration.ts` | code check, `createUser`, `getUser` |
| `src/be/auth/src/runtime.ts` | process-wide `AuthRuntime` |
| `src/be/api/src/routes/auth.ts` | endpoints 2 to 4, the rate-limit and body-size hook, fixed-message body schemas |

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~3 | 2026-10-31 | Tokens verified with `firebase-admin` | Vendor key rotation; `jose` rejected | spec |
| C~5 | 2026-10-31 | `requireMember` moves to `core` (W5) | `core` owns `project_members` | spec |
| C~9 | 2026-11-04 | `auth` is the package `src/be/auth` | `src/be/api` may not import `@agile/db` | spec SD16 |
| C~10 | 2026-11-04 | `hit()`'s upsert lives in `@agile/db` | Raw SQL stays in one package | spec SD17 |

Drift: architecture §7 says a valid token belongs to a verified, enabled account; it does not (Known Gaps, Handover above).

### 4.2 Foundation (`architecture/foundation.md`)

**Now (proposed):** The repository has one source-root frontend package at `src/fe` and five backend packages under `src/be/*`. `src/be/contracts` is the single source of truth: zod schemas, one error envelope, OpenAPI schemas, and the policy map that gates every route; `RouteDefinition` has an optional `before` hook and `ApiContext` an optional `identity` for `TOKEN` routes. `src/be/db` owns the Prisma schema, filtered request-facing client, recursive visibility enforcement, transaction seams and the one raw rate-counter upsert (`incrementRateCounter`); it excludes soft-deleted and archived data and protects compound project keys. `src/be/api` provides typed resource-resolution and authorization seams, the shared `ROUTES` registry, request parsing/error mapping, and the health endpoint; `registerRoute` runs a route's `before` hook, then authorization, then input parsing. `createApiApp(deps, routes)` defaults to `createAppDependencies(getAuthRuntime())`, which supplies the token check and user lookup from `src/be/auth`; its project resolvers are fail-closed placeholders (every project route is 404) until W5 supplies them. Because the runtime is built at module load, the app needs `APP_TIER` and the auth settings to start. Route handlers hold no domain logic and never check roles themselves. Frozen first (A-18): contracts with the policy map, `LlmGateway.run`, `AiContext.assemble`, `Sessions`.

| Path | Role |
|---|---|
| `src/be/api/src/deps.ts` | `createAppDependencies`: auth seams plus W5 placeholders |
| `src/be/api/src/routes/register.ts` | `before` hook, authorization, parsing, `identity` |

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | 2026-10-31 | The token check is built by W4 | Was named in both W1 and W4 | spec |
| C~6 | 2026-11-04 | Optional `before` and `identity` route seams | Limiter and register need headers, body and token identity | spec SD13 |

Drift: W5 still has to replace the placeholder resolvers in `deps.ts`.

---

## 6. Known Gaps

Changes the guardrails entry **Email verification and disabling users**; AD-57 stays.

- **Unverified email at registration** — Firebase issues tokens to unverified emails unless blocking functions are set up, so someone holding a registration code could register an email they do not own (AD-57).
- **Disabled users keep access until token expiry** — a disabled user's ID token works for up to 1 hour, because revocation is not checked (AD-57).

New entry:

- **`rate_counters` rows are never cleaned up** — one row per key, with no scheduled jobs to remove them; IPv6 /64 grouping limits growth, and rows can be cleared by hand. An attacker holding many /64 prefixes (a /48 has 65,536) gets 20 attempts per prefix and adds one row per prefix; there is no global ceiling.
- **Slow request bodies** — endpoints 2 and 3 read up to 4 KiB before authorization; a client sending it slowly holds the function until the platform timeout.

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — The token check belongs to W4, not W1

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn, Developer member), who told the team they will take it
- **Supersedes:** the `packages/api` token-check entry in `architecture/foundation.md` Now, for who builds it
- **Why:** the docs named it in both W1 (API skeleton) and W4, so it could be built twice or missed.
- **Rejected:** leaving it in W1.

### C~2 — W4 scope includes user lookup, `hit()` and the sign-in screen wiring

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn), choosing the recommended options
- **Why:** the architecture puts these helpers in `auth`, and no workstream named who wires the screen.
- **Rejected:** leaving user lookup in W1; the PM wiring the screen in W10.

### C~5 — `requireMember` moves from `auth` to `core`, built in W5

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn), after the Maintainer review found the collision; reverses their earlier choice to keep it in W4
- **Supersedes:** the `requireMember` entry in architecture §4's `auth` row and `architecture/auth.md`
- **Why:** `core` owns `project_members`, `conventions/general.md` forbids querying another module's tables, and architecture §4 already says it runs inside `core`.
- **Rejected:** keeping it in `auth` as a recorded exception.

### C~6 — W4 adds two optional seams to W1's route registration

- **Date:** 2026-11-04
- **Who asked:** operator (ludannnn), asking for the most sensible assumptions before contacting the Dev Lead; Dev Lead confirmed all five (C~6 to C~10) on 2026-11-04
- **Supersedes:** the spec's "Seams W1 must provide" for route-level middleware and the token principal
- **Decision:** W4 adds `before?: (c: { requestId; headers }) => Promise<Response | void>` to `RouteDefinition` (run by `registerRoute` before `authorizeRequest`; a returned `Response` ends the request) and `identity?: { firebaseUid; email }` to `ApiContext` (set for `TOKEN` routes; `principal` stays registered-only). Both are optional, so W1's routes and tests are unchanged. The Dev Lead still reviews the T0 commit in the W4 PR.
- **Why:** W1's `registerRoute` authorizes before anything route-specific runs and gives handlers neither headers nor the raw body, so the limiter (client IP), the 4 KiB limit and `Retry-After` cannot live in the handler; and a `TOKEN` route's handler gets no `firebaseUid` or email, so `register` cannot insert. The hook keeps the spec's pipeline and E9 unchanged.
- **Rejected:** `hit()` inside the handler with no `bodySchema` (handlers cannot see the IP or body; would also break E9); path-scoped `app.use` in `createApiApp` (splits a route's behaviour across two files); waiting for the Dev Lead to build it (costs a day on the critical path to W5).

### C~7 — W4 defines the tier setting for now

- **Date:** 2026-11-04
- **Who asked:** operator (ludannnn), same request as C~6; Dev Lead confirmed all five (C~6 to C~10) on 2026-11-04
- **Decision:** T1 reads `APP_TIER` (`local`, `dev`, `preview`, `prod`, `test`) in W4's auth settings module; the Dev Lead or W13 may move it to a shared settings module later.
- **Why:** the spec assumed W1 provides a tier setting; none exists in `src/be` and no architecture file names one, so T1 cannot run without it.
- **Rejected:** blocking T1 until W1 adds it.

### C~8 — W5, not W4, implements the membership resolvers

- **Date:** 2026-11-04
- **Who asked:** operator (ludannnn), same request as C~6; Dev Lead confirmed all five (C~6 to C~10) on 2026-11-04
- **Supersedes:** W1's handover assigning "membership and the member project set" resolvers to W4
- **Why:** they read `project_members`, which `core` owns; same reasoning as C~5. W4 supplies only `resolvePrincipal` and `lookupRegisteredUser`.
- **Rejected:** W4 querying `project_members` from `auth`.

### C~9 — Feature modules are workspace packages; `auth` is `src/be/auth`

- **Date:** 2026-11-04
- **Who asked:** operator (ludannnn), same request as C~6; Dev Lead confirmed all five (C~6 to C~10) on 2026-11-04
- **Decision:** W4 creates `src/be/auth` (`@agile/auth`), which holds the `users` and `rate_counters` access, `hit()`, the token verifier, code checks and settings. `src/be/api` holds only W4's thin route definitions (appended to `ROUTES`) and wires `@agile/auth` into `createApiApp(deps)`.
- **Why:** `src/be/api` may not import `@agile/db` or raw SQL (`src/be/api/test/import-rules.test.ts`), and W1 defines no home for feature modules. A package per module matches the `src/be/*` workspaces (C23) and sets the pattern W5's `core` can follow.
- **Rejected:** putting table access in `src/be/api` (fails the import rule); a shared `src/be/modules` package (one package for every owner's code invites cross-module table access).

### C~10 — `hit()`'s atomic statement lives in `@agile/db`

- **Date:** 2026-11-04
- **Who asked:** operator (ludannnn), same request as C~6; Dev Lead confirmed all five (C~6 to C~10) on 2026-11-04
- **Decision:** `@agile/db` exports one function that runs the AD-59 upsert on `rate_counters` with a parameterised raw statement; `@agile/auth`'s `hit()` validates inputs and calls it.
- **Why:** the window reset needs a conditional `INSERT … ON CONFLICT DO UPDATE … RETURNING`, which Prisma's upsert cannot express, and `FilteredDbClient` deliberately omits raw SQL. Keeping the one raw statement inside `@agile/db` keeps raw SQL in a single package.
- **Rejected:** `@agile/auth` creating its own unfiltered `PrismaClient` (a second raw-SQL holder); a read-then-write in a transaction (two statements, against AD-59).

### C~11 — T7 (sign-in screen) moves to a follow-up spec and PR

- **Date:** 2026-11-04
- **Who asked:** operator (ludannnn), choosing the recommended option when asked how to handle T7 in the plan; this settles the T7 question held since 2026-10-31
- **Supersedes:** the approved spec keeping T7 in W4's first PR (spec SD18 amends it)
- **Why:** `src/fe` is still W10's cookie-based prototype with fixture data and has no UI test runner, so T7 cannot meet F7 now; holding the PR for it would block W5 until 10 Nov.
- **Rejected:** one PR for T0 to T7; merging partway through one plan and continuing T7 on a new branch (the workflow has no mid-plan merge).

### C~3 — Tokens are verified with `firebase-admin`

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn), choosing the recommended option; architecture §7 left the library to this spec
- **Why:** vendor-maintained key rotation and claim checks suit a security boundary.
- **Rejected:** `jose`, because we would own every check.

### C~4 — AD-57 kept despite its Firebase assumption being wrong

- **Date:** 2026-10-31
- **Who asked:** operator (ludannnn), asked keep or reverse under AGENTS.md §4
- **Why:** registration still needs a code, and the deadline is tight. See Known Gaps.
- **Rejected:** reversing it for email only, or for email and revocation.

## 8. Deviations

- **D~1 — A Firebase public-key fetch failure is recognised by its message (T3):** spec E45 mapped every `auth/argument-error` to `InvalidToken`. With outbound HTTPS blocked, `firebase-admin` 13.10 reports the failed key fetch as `auth/argument-error` with the message "Error while making request: …", so a Google outage would have returned 401 and looked like a sign-out, against E29. The adapter now maps that message to `VerifierUnavailable` (500); every other `auth/argument-error` stays `InvalidToken`. E45 gained the case in the spec and the test. Consequence: if a `firebase-admin` upgrade changes that message, outages become 401 again; the E45 test pins the current text, so re-run the blocked-network check (`sandbox-exec` denying TCP 443) after any upgrade.
