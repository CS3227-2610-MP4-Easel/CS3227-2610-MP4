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

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** W4 T7 follow-up (C46): wire the sign-in and register screen in `src/fe` to Firebase and endpoints 2-4, per [follow-up-t7.md](../../specs/2026-10-31-w4-auth-design/follow-up-t7.md) and [ui.md](../../specs/2026-10-31-w4-auth-design/ui.md). Settles every open W4 item before W9 resumes (C~1).

---

## 1. How to Resume

**Setup** (operator, outside the repo): Firebase console — enable Email/Password, register a Web app, add `localhost` to Authorized domains; put `APP_TIER`, `FIREBASE_PROJECT_ID`, the three `REGISTRATION_CODE_*`, `RATE_KEY_SECRET` and the four `NEXT_PUBLIC_FIREBASE_*` values in `src/fe/.env.local` (never committed, AD-32).

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-08 | Claude Opus 5.5 (lead) + 4 `reviewer` agents (Implementer, Tester, Maintainer, Attacker) | W4 | Blocked — needs human | T7 spec reviewed (1 round, findings fixed); Gate 1 asked | On the operator's yes: set the spec's Status to Approved, run `lint.mjs spec --approved`, commit, then `writing-plans-lite-v2` | 2026-11-08 |

**Remaining**

- [ ] T7 spec, Gate 1.
- [ ] T7 plan, Gate 2; build; Gate 3.
- [ ] **Handover:** close STATE Upcoming "Ask the PM about the W10 sign-in page": the merged W10 code answers it (design only: `components/canvas/Main.tsx` is static and signs in through the `/api/as?role=` cookie stand-in).

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W4 | Auth and registration | Building | [spec](../../specs/2026-10-31-w4-auth-design.md), [T7 spec](../../specs/2026-11-08-w4-sign-in-screen-design.md) (draft) | — | T7 spec reviewed; awaiting Gate 1 | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Branch state created for the T7 sign-in screen follow-up | W4 | `4a3cfd9` |
| 2026-11-08 | T7 spec written and reviewed (four lenses, one round) | W4 | `f8d4eb6` |
| 2026-11-08 | `npm --prefix src/fe run dev` failed on Next.js 16 (Turbopack default with a `webpack` config); `dev` now passes `--webpack`, matching `build` | W4 | this commit |

---

## 6. Known Gaps

- **Sign-up reveals registered emails** — Firebase answers `auth/email-already-in-use` for an existing account and the register screen shows it (W4 ui.md), so anyone can test whether an email has a Firebase account; sits beside **Unverified email at registration** (AD-57).

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

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
