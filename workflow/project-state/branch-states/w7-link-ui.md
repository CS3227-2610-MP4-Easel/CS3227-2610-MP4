# Branch State — w7-link-ui

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7-link-ui (from `w7-implement-pm-plan-flow` at `1bc7384`; stacked, so it merges after that branch and after W5 PR 23)
- **Base:** 1bc7384 (tip of `w7-implement-pm-plan-flow`; `INT` last merged there at `faa1c08` plus W5)
- **Owner:** Xiao-Congchen (PM)
- **Status:** Building
- **Last updated:** 2026-11-08 by Claude Sonnet 5.5 — branch and worktree created, scope survey done, no UI code yet

**Untouched:** Conventions, Architecture (no Now block changed yet)

---

**Scope.** Link the PM plan screens in `src/fe` to the W7 backend endpoints 34, 35, 36, 37, 40, 41 (`@agile/pm`, `@agile/proposals`). W7's C~1 left "the New Plan screen is wired later"; this branch is that later. Feature freeze is end of 10 Nov (AD-69).

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| s1 | 2026-11-08 | Claude Sonnet 5.5 | W7 UI | Active | Survey done; waiting on the operator's answer on auth and live-versus-fixture mode (Remaining) | Add data-layer functions 34-41 in `src/fe/lib/api/index.ts`, then wire `PlanIdea` to 34 | 2026-11-08 |

**Remaining**

- [x] Flag chosen: `LLM_MODE` (C~1).
- [x] Token source: dev token on the `local` tier (C~2); real sign-in is still the C46 follow-up.
- [ ] **Run it:** local Postgres + `npm run seed`-style seeding (demo PM and project `00000000-0000-4000-8000-000000000010`), `APP_TIER=local`, `LLM_MODE=live` (or the mock-model route is not reachable from the UI, see C~1), then drive idea → generate → expand → approve in the browser.
- [ ] Still canvas-only (not wired): `PlanApprove` dialog, `PlanApproved`, `PlanRejected`, `PlanHistory` (endpoint 36), edit/regenerate (38, 39 have no backend), Stop. `live/plan-actions.tsx` still fakes them on the canvas pages.
- [ ] The live project id is the seed constant `LIVE_PROJECT_ID` in `lib/api/live.ts` until screens carry a project id.
- [ ] Data layer: endpoints 34, 35, 36, 37, 40, 41 in `src/fe/lib/api/index.ts` with `PlanProposal` types from `@agile/contracts` (AD-01b: no Prisma or `@agile/db` in `src/fe`).
- [ ] Screens: `PlanIdea` (34), `Plan` (35, 37; replaces the DOM-click `live/plan-actions.tsx`), `PlanApprove` and `PlanApproved` (40), `PlanRejected` (41), `PlanHistory` (36), with the error banners (422, 429, 503, 409).
- [ ] Run the app against the backend and call the flow over HTTP (W7 Known Gap: not yet called with real auth).

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W7-UI | PM plan screens linked to the backend | Building | none yet (size to be set; Medium if it only wires existing screens to existing endpoints) | none yet | Survey done; blocked on the two questions above | — |

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | First UI slice: `LLM_MODE=live` switches `PlanIdea` and `Plan` to a new `live/live-plan.tsx` (idea, generate, expand each or all epics, approve, reject) over data-layer functions 34, 35, 37, 40, 41 (`lib/api/index.ts`, `live.ts`, `mode.tsx`); layout passes the mode down; `local`-tier dev token `dev-pm` (C~2). FE typecheck and data-layer lint pass; `tsc -b` clean; 15 API tests pass. Not run in a browser or against a database | W7-UI | this commit |
| 2026-11-08 | Branch `w7-link-ui` created in worktree `../CS3227-2610-MP4-w7-link-ui` from `w7-implement-pm-plan-flow`; branch state written | W7-UI | this commit |

## 4. Decisions

### C~1 — `LLM_MODE` is the switch between fixtures and the live API; no new variable

- **Date:** 2026-11-08.
- **Who asked:** the operator, replying to the question on how the plan screens decide to call the real API: use the existing `LLM_MODE` and create no new variable.
- **Decision:** the plan data-layer functions (endpoints 34 to 41) call `/api` when `LLM_MODE=live` and use fixtures otherwise. `LLM_MODE` is read on the server (it is not `NEXT_PUBLIC_`) and handed to the client through the root layout; no new environment variable is added.
- **Consequence to check:** by W2 SD5, `prod` must be `live` and `test` and `preview` must be `mock`, so `mock` is not a "backend with a mock model" in the UI; in `mock` the plan screens never reach the backend, and the mock plan flow (E45) can be driven from the UI only by a tier that sets `live`. The API needs a Firebase Bearer token and `src/fe` has no sign-in (role cookie only, C46), so the live path returns 401 until a token source exists.

### C~2 — Fixed dev token `dev-pm` stands in for sign-in on the `local` tier only

- **Date:** 2026-11-08.
- **Who asked:** the operator: no token source yet, but the flows must be testable before the sign-in screen lands, so bypass with a mocked PM token.
- **Decision:** `createAppDependencies` (`src/be/api/src/deps.ts`) resolves `Authorization: Bearer dev-pm` to the seeded demo PM (`firebaseUid` `w13-demo-pm`) only when `auth.settings.tier === "local"`; every other tier and token goes to the real verifier. No new variable (uses `APP_TIER`). The FE (`lib/api/live.ts`) sends that token on every live plan call. Tests: `src/be/api/test/dev-pm-token.test.ts`.
- **Why:** reuses the existing tier setting and the W13 seed user; the policy map (AD-55) still runs after the principal is resolved.
- **Risk / deviation:** this is an authentication change, which `AGENTS.md` §3 sizes as Big (spec first); it was built Medium-sized on the operator's explicit instruction. It must be removed (or replaced by real sign-in) before the sign-in follow-up (C46) ships; the PM reviewer should look at `deps.ts` at Gate 3.

## 5. Findings from the survey (for the next session)

- `src/fe` is fixture-only today: `src/fe/lib/api/index.ts` has one function per endpoint but its bodies read and write an in-memory store; it says linking replaces the bodies with calls to `/api`. No screen calls `fetch`; only `app/api/[[...route]]/route.ts` mounts the Hono API.
- The plan screens are generated canvas files with `// @ts-nocheck` (`components/canvas/Plan*.tsx`), and `components/live/plan-actions.tsx` fakes expand, retry, stop, edit and regenerate by clicking DOM buttons and rewriting text. That file is the part to replace.
- Contracts define 38 (edit an epic) and 39 (regenerate an epic), but W7's backend scope is 34, 35, 37, 40, 41 (C~1), so edit and regenerate have no backend yet; "Expand all" and "Stop" have no endpoint at all (expand-all can loop 37). Which of those controls to keep, hide or build is a scope question.

- **Seed on Windows does nothing (W13 bug, found 2026-11-08):** `npm --workspace @agile/db run seed` exits silently because the entry check in `src/be/db/prisma/seed.ts` compares `import.meta.url` with `file://` + the raw path, which never matches on Windows. Workaround: `node --import tsx -e "import('./prisma/seed.ts').then(m => m.runSeed())"` from `src/be/db` with `APP_TIER=local`, `NEON_HOST=localhost`, `NEON_PROJECT=local` and `DATABASE_URL` set for that command only (the Neon variables must not stay set when running the app: they trigger the Vercel identity checks). Hand over to W13 (repo owner).
