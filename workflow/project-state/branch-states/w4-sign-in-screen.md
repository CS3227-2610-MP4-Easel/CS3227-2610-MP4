# Branch State — w4-sign-in-screen

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w4-sign-in-screen (from `INT` at `512dc4c`)
- **Base:** 512dc4c
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-08 by Claude Opus 5.5 — branch created, scoping T7

**Untouched:** Architecture, Conventions

---

**Scope.** W4 T7 follow-up (C46): wire the sign-in and register screen in `src/fe` to Firebase and endpoints 2-4, per [follow-up-t7.md](../../specs/2026-10-31-w4-auth-design/follow-up-t7.md) and [ui.md](../../specs/2026-10-31-w4-auth-design/ui.md). Settles every open W4 item before W9 resumes (C~1).

---

## 1. How to Resume

**Setup** (operator, outside the repo): Firebase console — enable Email/Password, register a Web app, add `localhost` to Authorized domains; put `APP_TIER`, `FIREBASE_PROJECT_ID`, the three `REGISTRATION_CODE_*`, `RATE_KEY_SECRET` and the four `NEXT_PUBLIC_FIREBASE_*` values in `src/fe/.env.local` (never committed, AD-32).

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-08 | Claude Opus 5.5 (orchestrator) + `implementer` | W4 | Active | Wave 4: T5 and T6 in flight (main checkout, separate files) | On each handover: validate, full review (Implementer, Tester, Attacker); when both are Done, wave check, then T7 | 2026-11-08 |

**Remaining**

- [x] T7 spec, Gate 1: approved by ludannnn on 2026-11-08 (one review round, four lenses).
- [x] T7 plan, Gate 2: approved by ludannnn on 2026-11-08 (7 tasks, 5 waves, full review each).
- [ ] Build T1-T7; close-out; Gate 3.
- [x] Local setup verified 2026-11-08: Firebase project `agile-platform-dev` created by ludannnn (Email/Password on, web app registered), local Postgres migrated, endpoint 2 returns `{"valid":true}` and endpoint 4 returns 401 without a token.
- [ ] **Handover:** to the repo owner (W13): `agile-platform-dev` exists (owner ludannnn; add the repo owner as Owner); create `agile-platform-prod` with that exact ID (`src/be/db/src/tier-targets.ts`) and add the Vercel domains to Authorized domains on both projects; set the four `NEXT_PUBLIC_FIREBASE_*` values per tier.
- [ ] **Handover:** to the Dev Lead (W12): `tests/process-security/ci-workflow.test.ts` now pins the chained root `test` script (C~7) but not `src/fe/package.json` `scripts.test` (`vitest run`) or `src/fe/vitest.config.ts`; consider asserting the fe script too (T1 Attacker review nit).
- [ ] **Handover:** close STATE Upcoming "Ask the PM about the W10 sign-in page": the merged W10 code answers it (design only: `components/canvas/Main.tsx` is static and signs in through the `/api/as?role=` cookie stand-in).

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W4 | Auth and registration | Building | [spec](../../specs/2026-10-31-w4-auth-design.md), [T7 spec](../../specs/2026-11-08-w4-sign-in-screen-design.md) (approved 2026-11-08) | [plan](../../plans/2026-11-08-w4-sign-in-screen/plan.md) (approved 2026-11-08) | T7 follow-up: task 4/7 done; T5 and T6 (auth screens) in flight | — |

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

---

## 6. Known Gaps

- **Sign-up reveals registered emails** — Firebase answers `auth/email-already-in-use` for an existing account and the register screen shows it (W4 ui.md), so anyone can test whether an email has a Firebase account; sits beside **Unverified email at registration** (AD-57).

---

## 8. Deviations

> Legend: `D` = Deviation, where reality diverged from a spec or plan. Not to be confused with AD-nn, an Architecture Decision.

### D~1 The install check runs on Node 24, not Node 20.19.5
- **Date:** 2026-11-08 · **Found by:** T1 implementer (Expected state check); operator chose to continue
- **What:** spec § 4.6 asks for `npm ci --ignore-scripts` and the audit on Node 20.19.5 before pushing; the operator's machine has Node 24.10.0 and npm 11.6.0, so `package-lock.json` is regenerated with npm 11.
- **Consequence:** Node 20 / npm 10 compatibility is first checked by CI's `workspace` job on the PR, before merge. If CI's `npm ci` rejects the lockfile, regenerate it with `npx npm@10.8.2 install` and push.
- **Rejected:** installing Node 20 locally first (setup time).

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
