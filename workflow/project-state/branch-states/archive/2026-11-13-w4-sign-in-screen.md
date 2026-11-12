# Branch State — w4-sign-in-screen

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w4-sign-in-screen (from `INT` at `512dc4c`)
- **Base:** b95546f
- **Owner:** ludannnn (Developer member)
- **Status:** Folded
- **Approved:** ludannnn 2026-11-08
- **Last updated:** 2026-11-08 by Claude Opus 5.5 — Gate 3 approved by the owner

**Untouched:** Conventions

---

**Scope.** W4 T7 follow-up (C46): wire the sign-in and register screen in `src/fe` to Firebase and endpoints 2-4, per [follow-up-t7.md](../../specs/2026-10-31-w4-auth-design/follow-up-t7.md) and [ui.md](../../specs/2026-10-31-w4-auth-design/ui.md). Settles every open W4 item before W9 resumes (C~1).

---

## 1. How to Resume

**Setup** (operator, outside the repo): Firebase console — enable Email/Password, register a Web app, add `localhost` to Authorized domains; put `APP_TIER`, `FIREBASE_PROJECT_ID`, the three `REGISTRATION_CODE_*`, `RATE_KEY_SECRET` and the four `NEXT_PUBLIC_FIREBASE_*` values in `src/fe/.env.local` (never committed, AD-32).

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|


**Remaining**

- [x] Operator's manual check on 2026-11-08 with `src/fe/.env.local` against `agile-platform-dev`: registered an account, signed out and signed in again; flows worked.
- [ ] **Handover:** to the PM (W10): the canvas screens, including the live sign-in and register screens that reuse their markup, are fixed-size (`.app { min-height: 1000px }` in `src/fe/app/canvas.css`, fixed flex bases such as `1 1 420px`), so they do not adapt to short or very wide windows (seen by the operator on an ultrawide monitor).
- [x] Gate 3: approved by ludannnn on 2026-11-08.
- [x] Push and open the PR into `development` (PR #25, merged 2026-11-09); the PR body calls out C~7 (W12 test change) for the Dev Lead.

- [x] T7 spec, Gate 1: approved by ludannnn on 2026-11-08 (one review round, four lenses).
- [x] T7 plan, Gate 2: approved by ludannnn on 2026-11-08 (7 tasks, 5 waves, full review each).
- [x] Build T1-T7 and close-out (code review, fixes, checks) on 2026-11-08.
- [ ] **Handover:** guide out of date: setup (Firebase dev project, `src/fe/.env.local` from `.env.example`, local Postgres and the `agile-pg-test` container for integration tests) and testing (fe Vitest suite under root `npm test`).
- [x] Local setup verified 2026-11-08: Firebase project `agile-platform-dev` created by ludannnn (Email/Password on, web app registered), local Postgres migrated, endpoint 2 returns `{"valid":true}` and endpoint 4 returns 401 without a token.
- [ ] **Handover:** to the repo owner (W13): `agile-platform-dev` exists (owner ludannnn; add the repo owner as Owner); create `agile-platform-prod` with that exact ID (`src/be/db/src/tier-targets.ts`) and add the Vercel domains to Authorized domains on both projects; set the four `NEXT_PUBLIC_FIREBASE_*` values per tier.
- [ ] **Handover:** to the Dev Lead (W12): `tests/process-security/ci-workflow.test.ts` now pins the chained root `test` script (C~7) but not `src/fe/package.json` `scripts.test` (`vitest run`) or `src/fe/vitest.config.ts`; consider asserting the fe script too (T1 Attacker review nit).
- [ ] **Handover:** web app performance follow-up: `AuthRoot` in the root layout statically imports `lib/auth/firebase` and `session`, so `@firebase/app` and `@firebase/auth` ship in every page bundle, including prototype previews; load them lazily (`next/dynamic` or `import()`) only in `firebase` mode. `force-dynamic` on the layout is deliberate (mode read per request).
- [ ] **Handover:** close STATE Upcoming "Ask the PM about the W10 sign-in page": the merged W10 code answers it (design only: `components/canvas/Main.tsx` is static and signs in through the `/api/as?role=` cookie stand-in).

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W4 | Auth and registration | Done | [spec](../../specs/2026-10-31-w4-auth-design.md), [T7 spec](../../specs/2026-11-08-w4-sign-in-screen-design.md) (approved 2026-11-08) | [plan](../../plans/2026-11-08-w4-sign-in-screen/plan.md) (approved 2026-11-08) | T7 follow-up done; PR #25 merged 2026-11-09 | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Branch state created for the T7 sign-in screen follow-up | W4 | `4a3cfd9` |
| 2026-11-08 | T7 spec written and reviewed (four lenses, one round) | W4 | `f8d4eb6` |
| 2026-11-08 | `npm --prefix src/fe run dev` failed on Next.js 16 (Turbopack default with a `webpack` config); `dev` now passes `--webpack`, matching `build` | W4 | `38e5768` |
| 2026-11-08 | T7 spec approved at Gate 1 | W4 | `a5915ab` |
| 2026-11-08 | T7 plan written, reviewed and approved at Gate 2 | W4 | `e7d9f6e` |
| 2026-11-08 | Committed the files `next dev` (Next.js 16) regenerates on every run: `src/fe/tsconfig.json` (`jsx: react-jsx`, `.next/dev/types`) and `src/fe/AGENTS.md` (pointer to Next's bundled docs), so the tree stays clean | W4 | `cf52e09` |
| 2026-11-08 | Baseline before T1: `npm run typecheck` green, `npm test` 487/487 (integration tests against a local `agile-pg-test` container on 5433; `DATABASE_URL` for agent commands comes from the operator's `.claude/settings.local.json`) | W4 | `12e31bf` |
| 2026-11-08 | T1 blocked on its Node check (local Node 24); check relaxed in `tasks/T1.md`, D~1 recorded, T1 redispatched | W4 | `cb8666d` |
| 2026-11-08 | T1 audit stopped on `@grpc/grpc-js` (via `firebase` → Firestore); switched to `@firebase/app` + `@firebase/auth` (C~5), amendment reviewed (Maintainer, Attacker; T3 lazy-init and T7 rule 1 hardened) | W4 | `cb8666d` |
| 2026-11-08 | T1 first pass committed (Vitest, test chain); fix-up pending: Firebase 12.19 versions (C~6), W12 test assertion (C~7); `.env.example` committed by the operator (policy blocks env files) | W4 | `1b4d7e8` |
| 2026-11-08 | T1 done: Vitest + jsdom in `src/fe` (cleanup setup, JSX smoke test), `@firebase/app` 0.16.2 and `@firebase/auth` 1.13.6, root `npm test` chains the fe suite, W12 pin updated, `.env.example`. Full review (Implementer, Tester, Attacker): Tester's two fixes applied; Attacker nit (guard the fe `test` script) handed to the Dev Lead | W4 | `878bfbb` |
| 2026-11-08 | Wave 2 worktree dispatch failed (worktrees came from the remote base, which lacks this unpushed branch); T2 and T3 run one after another in the main checkout instead (skill fallback) | W4 | — |
| 2026-11-08 | T3 task file corrected: its E60 note said `/api/%2e%2e/x` passes unchanged; URL parsing resolves it outside `/api/`, so encoded and trailing dot segments must be rejected (T3 Attacker review) | W4 | `9a170e9` |
| 2026-11-08 | T2 done: `authMode` (fail-closed modes, `VERCEL_ENV` checked case-insensitively), `/api/as` 404 outside prototype, redirect only to the checked same-origin URL (round 1 found a dot-segment bypass, fixed and re-reviewed), role cookie `sameSite=lax`, `httpOnly`, `secure` on https. Rejected nits: tests for the `secure` flag and `%2e`/tab `to` values (covered by the origin check) | W4 | `adb72b1` |
| 2026-11-08 | T3 done: `lib/auth/firebase.ts` (lazy, null when unconfigured), `hardNavigate`, `apiFetch` confined to `/api/` (round 1 found encoded and trailing dot segments escaping; fixed and re-reviewed), bounded server error fields, `ApiError` in `errors.ts`, endpoints 2-4. Rejected nit: clear SDK mocks between firebase-config tests (no assertion depends on order today). Wave 2 check: typecheck, `npm test` 487/487 + fe 51/51, build green | W4 | `12b4864` |
| 2026-11-08 | T4 done: `SessionProvider`/`useSession` (generation counter, hold for registration), `AuthRoot`/`useAuthMode`, `AuthGate`, layout (`force-dynamic`) and page wiring, session-aware top bar, role bar only in prototype, placeholder auth screens. Full review: no blocking; tests tightened (E51 order, E54 at gate, E97 content, E100 hold), top-bar role fallback and idempotent hold release added. Rejected nit: a 401 with no following sign-out leaves "Loading…" (SD9 by design). Wave 3 check: `npm test` 487/487 + fe 82/82, typecheck, build green | W4 | `8d8003a` |
| 2026-11-08 | T5 done: live sign-in form (Firebase `signIn`, messages unchanged, one request at a time, gate navigates). Deviation: a T4 gate test query made stricter (`getByRole` heading). Full review (one reviewer, three lenses): nits only, rejected: re-enable window before navigation (repeat `signIn` harmless), password stays shown after an error, `b-bad` class and `role="alert"` not asserted (outside the contract) | W4 | `b4a56eb` |
| 2026-11-08 | T6 done: register flow (role and code, account with hold and skip-`signUp`, finish setup, 429 countdown, error states, code kept only in component state). Implementer choice accepted: a role/code error at Create account returns to step 1. Full review: no blocking; fixed a lost displayName 422 message, cooldown enforced in code, email/password locked once the account exists, tests tightened (deferred double-click, hold release on error, code clearing). Rejected nit: Retry resends the values of the failed request (matches "repeats the failed request"). Deviations: two T4 gate tests updated to the real headings; fake timers limited to intervals. Wave 4 check: `npm test` 487/487 + fe 126/126, typecheck, build green | W4 | `d034112` |
| 2026-11-08 | T7 done: `src/fe/test/source-rules.test.ts` enforces the six auth source rules and empty `.env.example` values, with breach samples; smoke and link-check scripts marked prototype-only. Full review: no blocking; fixed skip-dir scope, client-file detection behind comments, rule 6 for `export … from`/`require`/`.js`/`index`, template-literal imports, exact-path exemption tests. Remaining regex limits recorded as a Known Gap. Close-out checks: typecheck, `npm test` 487/487 + fe 139/139 (5.8 s), build, audit (no high), close-out lint clean | W4 | `f438c32` |
| 2026-11-08 | Close-out code review (branch vs `development`, high): 10 findings; fixed 7 (stale Retry values, a 401 during registration stuck Retry, session stuck on "Loading…" after a no-user 401, hold release now re-reads `/api/me` (D~3), Top sign-out with no user, `/api/as` 500 on a malformed `to`, a redundant condition) and re-reviewed; rejected: Top role-mapping dedupe (screen role is `pm` on `/styleguide` and `/states`, so Top must read the session user), lazy Firebase SDK loading (handover); recorded D~2 (401 state) and D~4 (trailer format). Final checks: typecheck, `npm test` 487/487 + fe 149/149, build, audit no high | W4 | `efe86cb` |
| 2026-11-08 | Merged `development` at `b95546f` (W5 PR #23) after Gate 3, no conflicts; re-checked: typecheck, `npm test` 562/562 + fe 149/149, build, audit no high | W4 | `9be278f` |

---

## 4. Architecture

> Added at fold (2026-11-13, approved by ludannnn): the branch had listed Architecture as Untouched.

### 4.1 Web

**Now (proposed):** The `src/fe` Next.js app is free of Prisma/database imports; its catch-all API adapter forwards `/api/*` to the Hono app, and business rules and authorization stay server-side. `authMode` picks the mode per request: `prototype` (fixtures and the role buttons, mock previews only), `firebase` (live sign-in) or `unconfigured`. In `firebase` mode `AuthRoot` and `SessionProvider` hold the Firebase session (`@firebase/app` and `@firebase/auth` only, loaded in `lib/auth/firebase.ts`), and `AuthGate` gates every page on it. The role comes from `GET /api/me`, never a cookie. Sign-in and register call endpoints 2-4. `apiFetch` (`lib/api/http.ts`) is the only place that calls `fetch`; it attaches the ID token and is confined to same-origin `/api/` paths. `test/source-rules.test.ts` enforces these source rules. The UI tests use Vitest, Testing Library and jsdom and run under the root `npm test`. Screens other than sign-in and register still read fixtures until their workstreams wire them.

| Path | Role |
|---|---|
| `src/fe/lib/auth` | auth mode, Firebase client, session, gate |
| `src/fe/lib/api/http.ts` | `apiFetch`, the only `fetch` caller |

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~2 | 2026-11-08 | T7 replaces the role cookie with a real auth gate | see Decisions | spec |
| C~5 | 2026-11-08 | `@firebase/app` and `@firebase/auth`, not the `firebase` package | see Decisions | spec |

---

## 6. Known Gaps

- **Sign-up reveals registered emails** — Firebase answers `auth/email-already-in-use` for an existing account and the register screen shows it (W4 ui.md), so anyone can test whether an email has a Firebase account; sits beside **Unverified email at registration** (AD-57).
- **The web app's auth source scan is regex-based** — `src/fe/test/source-rules.test.ts` catches the usual import, `fetch(`, `location.assign(`, `process.env` and `dangerouslySetInnerHTML` forms but not deliberate evasion such as `window['location'].assign`, `fetch (` with a space, `process["env"]` or computed specifiers; review covers those.

---

## 8. Deviations

> Legend: `D` = Deviation, where reality diverged from a spec or plan. Not to be confused with AD-nn, an Architecture Decision.

### D~1 The install check runs on Node 24, not Node 20.19.5
- **Date:** 2026-11-08 · **Found by:** T1 implementer (Expected state check); operator chose to continue
- **What:** spec § 4.6 asks for `npm ci --ignore-scripts` and the audit on Node 20.19.5 before pushing; the operator's machine has Node 24.10.0 and npm 11.6.0, so `package-lock.json` is regenerated with npm 11.
- **Consequence:** Node 20 / npm 10 compatibility is first checked by CI's `workspace` job on the PR, before merge. If CI's `npm ci` rejects the lockfile, regenerate it with `npx npm@10.8.2 install` and push.
- **Rejected:** installing Node 20 locally first (setup time).

### D~2 A 401 during registration sends the user to sign in
- **Date:** 2026-11-08 · **Found by:** branch code review (close-out)
- **What:** spec § 4.4 lists no state for a 401 from `register_3`. `apiFetch` signs the Firebase user out on that 401, so Retry could never succeed. Register now resets the account flags, clears the code, releases the hold and shows "Something went wrong." with a "Sign in instead" link, no Retry; signing in again leads to finish setup.
- **Consequence:** one screen state beyond the spec's table; no change to the API or the session contract.

### D~3 Releasing the registration hold re-reads `/api/me`
- **Date:** 2026-11-08 · **Found by:** branch code review (close-out)
- **What:** spec § 4.3 says release "calls nothing". It now re-runs the `me_4` load when a Firebase user arrived during the hold and `setUser` was not called, so the session never stays `signed-out` while Firebase is signed in; Register's unmount-time `retry()` workaround is removed.
- **Consequence:** simpler and covers hard navigations; tests E100, E101 and E103 updated.

### D~4 Branch commits carry `Workstream:`/`Task:` in the body, not as git trailers
- **Date:** 2026-11-08 · **Found by:** branch code review (close-out)
- **What:** commits on this branch put `Workstream: W4` / `Task: Tn` in a paragraph separated from `Co-Authored-By:` by a blank line, so `git interpret-trailers` does not see them (AGENTS.md § 6). The text is present in every commit message. History was not rewritten; later commits use one trailer block.

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~6 Use the Firebase 12.19 versions of app and auth
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator), after T1 reported `EBADENGINE`
- **Decision:** `@firebase/app` 0.16.2 and `@firebase/auth` 1.13.6 (inside `firebase` 12.19.0, engines `node >=20.0.0`) replace 0.16.5 / 1.13.9 (C~5).
- **Why:** the 13.x packages declare `node >=24.12.0`; CI runs Node 20.19.5 and the operator runs 24.10.
- **Rejected:** keeping 13.x and ignoring the engine warning; raising CI's Node (W12).

### C~7 Update W12's pinned root `test` script assertion
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** `tests/process-security/ci-workflow.test.ts` line 46 asserts the new root `test` string (backend runner, then the fe suite); the PR calls it out for the Dev Lead (W12 owner) to review.
- **Why:** the assertion stops CI's test command from being weakened; the new command only adds the fe suite, so the guard keeps its purpose. Without it CI would never run the fe tests (SD6).
- **Rejected:** leaving the root script unchanged and asking the Dev Lead to add an fe step to `ci.yml`.

### C~5 Use `@firebase/app` and `@firebase/auth`, not the `firebase` package
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator), after T1's audit stopped on a high finding
- **Decision:** `src/fe` depends on `@firebase/app` 0.16.5 and `@firebase/auth` 1.13.9 (the versions inside `firebase` 13.2.0); the spec is amended (§ 4.3, § 4.5, SD15).
- **Why:** `firebase` installs every product; its `@firebase/firestore` brings `@grpc/grpc-js` 1.9.16 (GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4, high), which fails `npm run audit:dependencies` in CI. Sign-in needs only app and auth.
- **Rejected:** an npm `overrides` pin of `@grpc/grpc-js` to 1.14.7; accepting the finding (CI fails on high).

### C~1 Settle W4 before continuing W9
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** do the T7 sign-in screen on its own branch from `development` now; W9 (`w9-dev-slice`, spec approved) resumes afterwards.
- **Why:** every local and deployed run needs working sign-in; W9's plan is waiting on W5 PR #23 anyway.
- **Rejected:** continuing W9 first.

### C~2 T7 replaces the role cookie with a real auth gate
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** sign-in, register and sign-out use Firebase and endpoints 2-4; pages are gated on the Firebase session and the role comes from `GET /api/me`, replacing the `role` cookie; a shared fetch helper attaches the ID token for later workstreams. Other screens keep their fixtures.
- **Why:** ui.md says the role shown comes from `/api/me`; leaving the cookie would contradict it.
- **Rejected:** wiring only the forms and keeping the cookie gate.

### C~3 Mock previews keep the prototype role buttons
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** when `APP_TIER=preview` and the `NEXT_PUBLIC_FIREBASE_*` values are absent, the "sign in as" role buttons stay; they never appear on dev or prod.
- **Why:** reviewers can still click through mock previews without a Firebase project.
- **Rejected:** removing the role switcher on every tier.

### C~4 `src/fe` UI tests use Vitest, Testing Library and jsdom
- **Date:** 2026-11-08 · **Asked by:** ludannnn (operator)
- **Decision:** add Vitest with Testing Library and jsdom to `src/fe`; the Firebase SDK and fetch are mocked, fake timers cover the 429 countdown; the tests run in CI.
- **Why:** F7 needs UI tests and `src/fe` had no runner (the C46 blocker).
- **Rejected:** Playwright end to end (heavier, needs a running app and stubbed Firebase).


## Fold record
Folded 2026-11-13 by Claude Opus 5.5 (with `ws fold`) on `development` · merge commit `3519ff0` · base `b95546f`

At fold, with ludannnn's yes: the `Untouched: Architecture` claim was wrong (new Firebase client, auth gate, Vitest), so a web-area Now was added and `auth.md`'s "sign-in screen is a follow-up" sentence was updated; the PR item was ticked and the W4 row set to Done (PR #25 merged). The handover that closes the "Ask the PM about the W10 sign-in page" Upcoming row was applied by deleting that row.

| Provisional | Permanent |
|---|---|
| C~1 | C62 |
| C~7 | C63 |
| D~1 | D19 |
| C~5 | C64 |
| C~6 | C65 |
| D~3 | D20 |
| D~2 | D21 |
| D~4 | D22 |
| C~2 | C66 |
| C~3 | C67 |
| C~4 | C68 |

Sessions discarded at fold: none
