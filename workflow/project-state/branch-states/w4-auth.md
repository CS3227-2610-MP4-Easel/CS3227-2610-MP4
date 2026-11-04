# Branch State — w4-auth

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w4-auth (from `INT` at `0dbbdcb`; spec merged in PR #4; fast-forwarded to `INT` at `7bd6544` after W1 merged)
- **Base:** 7bd6544
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-04 by Claude Opus 5.5 — plan approved; building T0

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** W4 Auth and registration: endpoints 2, 3 and 4, plus the Firebase token check, on top of the W1 foundation. The approved spec is on `INT` (PR #4); this round amends it to the seams W1 actually built, then plans and builds T1 to T6. The PR #4 branch state has not been folded yet (Gate 4, project owner).

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S2 | 2026-11-04 | Claude Opus 5.5 | W4 | Active | Executing plan inline; T0 done | Plan T1 step 1: write failing `src/be/auth/test/settings.test.ts` | 2026-11-04 |

**Remaining**

- [x] Spec amendment for the W1 seams (C~6 to C~10); spec lint passes.
- [x] Interface stubs (ddac104).
- [x] Plan approved at Gate 2.
- [ ] T0 to T6 and close-out, per the plan.
- [ ] Request body schemas: contracts' `UserInputSchema` is looser than the spec (`code` optional, `displayName` length in UTF-16 units, no Cc/Cf check). T4/T5 define stricter W4 schemas; the plan must say where.
- [ ] **T7 follow-up:** write its own spec and PR from `workflow/specs/2026-10-31-w4-auth-design/follow-up-t7.md` once W10's real data layer and a `src/fe` UI test runner exist; target 10 Nov (C~11).
- [ ] Ask the PM whether W10 delivers a working sign-in page or a design only.
- [ ] **Handover:** correct architecture §7, which says a valid token always belongs to a verified, enabled account. Firebase does not guarantee that; see Known Gaps.
- [ ] **Handover:** tell the Dev Lead that W5 now owns `requireMember`, and that endpoint 10 must lowercase emails before lookup.
- [ ] **Handover:** W13 smoke checks on the deployed tiers: a forged `x-vercel-forwarded-for` must not change the limiter bucket, and a token from another Firebase project must get 401. `RATE_KEY_SECRET` must differ between dev and prod.
- [ ] **Handover:** add `REGISTRATION_CODE_*` and `RATE_KEY_SECRET` per tier in W13, and confirm `firebase-admin` verifies with only a project id on Vercel. Firebase's verify-token page says a service account is needed; if the smoke test fails, record a Deviation.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W4 | Auth and registration | Building | [spec](../../specs/2026-10-31-w4-auth-design.md) | [plan](../../plans/2026-11-04-w4-auth.md) | T0/6 done; T1 and T2 next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-04 | T0: `registerRoute` runs `before` ahead of authorization (adds `X-Request-Id` to its response) and gives TOKEN routes `identity`; 104 tests pass | W4 | this commit |
| 2026-11-04 | Plan written, reviewed (Implementer lens: 2 blocking, 8 non-blocking, all fixed) and approved at Gate 2; review moved T4 after T3 in the spec's dependency table | W4 | 4e961c4 |
| 2026-11-04 | T7, F7 and the UI edge cases moved to `follow-up-t7.md` (spec SD18); operator chose the split | W4 | e7fead8 |
| 2026-11-04 | Dev Lead confirmed the five seam decisions (spec SD13 to SD17) | W4 | 0106813 |
| 2026-11-04 | Interface stubs: `@agile/auth` package, `incrementRateCounter` stub in `@agile/db`, optional `before`/`identity` route fields; typecheck green, 99 tests pass | W4 | ddac104 |
| 2026-11-04 | Spec amended to the merged W1 seams: real paths, `resolvePrincipal`/`lookupRegisteredUser`, new T0 for `before`/`identity`, `APP_TIER`, `@agile/auth` package, `hit` statement in `@agile/db`, frontend Firebase settings (SD13 to SD17); operator re-approved it at Gate 1 | W4 | b6ef5d7 |
| 2026-10-31 | W4 auth spec written, reviewed and approved | W4 | e600d0a |

---

## 6. Known Gaps

Changes the guardrails entry **Email verification and disabling users**; AD-57 stays.

- **Unverified email at registration** — Firebase issues tokens to unverified emails unless blocking functions are set up, so someone holding a registration code could register an email they do not own (AD-57).
- **Disabled users keep access until token expiry** — a disabled user's ID token works for up to 1 hour, because revocation is not checked (AD-57).

New entry:

- **`rate_counters` rows are never cleaned up** — one row per key, with no scheduled jobs to remove them; IPv6 /64 grouping limits growth, and rows can be cleared by hand.

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
