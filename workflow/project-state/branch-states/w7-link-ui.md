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
| s1 | 2026-11-08 | Claude Sonnet 5.5 | W7 UI | Paused | Survey done; waiting on the operator's answer on auth and live-versus-fixture mode (Remaining) | Add data-layer functions 34-41 in `src/fe/lib/api/index.ts`, then wire `PlanIdea` to 34 | 2026-11-08 |

| s2 | 2026-11-10 | Codex | W7c | Blocked | T7 task conflicts D~3 and D~4; partial T7 work uncommitted | Correct T7 task then resume, review, and finish wave 5 | 2026-11-11 |

**Remaining**

- [x] Flag chosen: `LLM_MODE` (C~1).
- [x] Token source: dev token on the `local` tier (C~2); real sign-in is still the C46 follow-up.
- [ ] **Run it:** local Postgres + `npm run seed`-style seeding (demo PM and project `00000000-0000-4000-8000-000000000010`), `APP_TIER=local`, `LLM_MODE=live` (or the mock-model route is not reachable from the UI, see C~1), then drive idea → generate → expand → approve in the browser.
- [ ] **W7c execution (next action):** a different agent runs `executing-plans-lite-v2` on `workflow/plans/2026-11-10-w7c-points-and-plan-expand/plan.md`, starting with wave 1 (T1 and T3). `.ws/w7.env` is in this worktree. The orchestrator writes the plan's Status column and this file. Close-out lists the manual E36 run and the Known Gap about rolling back after points outside the earlier scale.
- [x] W7c spec and plan approved (above). Original scope, for reference: (1) story points become any integer 1 to 20, reversing AD-12 (C~3); changes `Task`/`PlanInputSchema`/W5 task CRUD/contracts.md/decision log and the FE points input; (2) a new bulk-expand prompt: one model call that writes the tasks of every epic together so they flow logically (C~4), with the other epics and tasks sent along when regenerating a single epic (endpoint 39). Contract change (new endpoint or changed 37) and a prompt change; AD-11 sign-offs.
- [x] Project flow UI (2026-11-10): live Projects list (6), New project (5), project switcher and page header names (7), project id taken from the URL; the plan flow, backlog and drafts follow the open project. Other project pages (Overview, Board, Sprints, Members, Settings, Health) are still fixtures.
- [x] Edit, add, delete, regenerate and checkpoint editing wired (2026-11-09); live backlog added. Not tried in a browser or with a model.
- [ ] Live backlog shows sprint and assignee as plain text only (endpoints 27 and 9 not linked); Checkpoints pages still fixtures; the Backlog add/edit forms (`BacklogAddEpic`, `BacklogAddTask`) still write fixtures.
- [ ] Still canvas-only (not wired): `PlanApprove` dialog, `PlanApproved`, `PlanRejected`, `PlanHistory` (endpoint 36), edit/regenerate (38, 39 have no backend), Stop. `live/plan-actions.tsx` still fakes them on the canvas pages.
- [ ] The live project id is the seed constant `LIVE_PROJECT_ID` in `lib/api/live.ts` until screens carry a project id.
- [ ] Data layer: endpoints 34, 35, 36, 37, 40, 41 in `src/fe/lib/api/index.ts` with `PlanProposal` types from `@agile/contracts` (AD-01b: no Prisma or `@agile/db` in `src/fe`).
- [ ] Screens: `PlanIdea` (34), `Plan` (35, 37; replaces the DOM-click `live/plan-actions.tsx`), `PlanApprove` and `PlanApproved` (40), `PlanRejected` (41), `PlanHistory` (36), with the error banners (422, 429, 503, 409).
- [ ] Run the app against the backend and call the flow over HTTP (W7 Known Gap: not yet called with real auth).

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W7c | Story points 1-20 and plan-wide expansion | Building | [spec](../../specs/2026-11-10-w7c-points-and-plan-expand-design.md) (approved 2026-11-10) | [plan](../../plans/2026-11-10-w7c-points-and-plan-expand/plan.md) (approved 2026-11-10; 9 tasks, 6 waves) | 7/9 done; T7 blocked D~3 and D~4 | — |
| W7-UI | PM plan screens linked to the backend | Building | none yet (size to be set; Medium if it only wires existing screens to existing endpoints) | none yet | Survey done; blocked on the two questions above | — |

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-11 | T8 complete (1d2bc12); FE typecheck and data-layer lint pass, 8 validation self-check cases pass; reviewer found and confirmed fix for missing bulk loading copy. Manual E36 pending. | W7c | 1d2bc12 |
| 2026-11-11 | T6 complete (ade3a1b); PM suite 66 passed, 0 failed, 0 skipped; full reviews resolved F6 task-context coverage. Wave build, contract and Prisma checks pass. D~2 remains. | W7c | ade3a1b |
| 2026-11-11 | Operator accepted all-DONE lock updating proposal updatedAt (C~5); E12 spec and T5/T6 amended; Implementer, Tester and Attacker reviewed and re-reviewed. T5 restored to Done; T6 resumes. | W7c | this commit |
| 2026-11-10 | T4 and T5 complete (7b665b7, 60702ae); full reviews resolved Unicode separator injection and E11/E12 coverage findings. PM suite 60 and proposal suite 76 passed without skips; revised targeted suites passed. Shared-worktree task markers skipped to avoid collisions. Handover commit fields are pending; refs here are actual. | W7c | 7b665b7, 60702ae |
| 2026-11-10 | T2 complete (04feed6): shared points schema applied to backend; 308 tests passed, 0 failed, 0 skipped including integration; Implementer review clean. Handover commit field says pending; actual commit is 04feed6. | W7c | 04feed6 |
| 2026-11-10 | T1 and T3 complete (2ed9726, 26d1329); Implementer, Tester and Attacker reviews found no blocking issues. T1 OpenAPI mappings lack direct assertions; contract parity passes. Gateway tests: 149 passed, 0 failed, 0 skipped including integration. | W7c | 2ed9726, 26d1329 |
| 2026-11-10 | W7c spec approved at Gate 1 and plan approved at Gate 2 by Xiao-Congchen; plan reviewed once (7 blocking findings fixed); the front-end work (project flow, plan editing, live backlog) committed as `7dbde06`; spec `0aab004`; execution handed to another agent | W7c | this commit |
| 2026-11-10 | W7c spec written ([spec](../../specs/2026-11-10-w7c-points-and-plan-expand-design.md), Medium + Attacker lens, lint clean): points 1 to 20 (reverses AD-12) and plan-wide expansion (new endpoint 61, one model call for all epics, rest-of-plan context for 37 and 39, per-feature gateway limits). Live measurement on SoCLaaS (llama3.1:8b, 10 epics): bulk call 12.3 to 26.9 s, 977 to 2,086 output tokens; limits set to 2x (54 s, 4,200 tokens). Review round 1 (Implementer, Tester, Attacker) folded; awaiting Gate 1 approval | W7c | this commit |
| 2026-11-10 | Project flow UI on real data (`LLM_MODE=live`): Projects list (6), New project (5), project switcher and header names (7); `Screen` sets the open project from the URL (`setCurrentProject`) and the data layer, plan drafts and backlog follow it (the seeded-id constant is gone). Endpoint 6 takes no `status` query, so the tabs filter client-side. FE typecheck and lint pass; not run in a browser | W7-UI | this commit |
| 2026-11-10 | Live plan page reworked on the operator's feedback: checkpoint list and editor use a 160 px date column then the name; two steps (outline: approach, checkpoints and an editable Epics card with "Confirm and Expand Epics", then tasks, all editable); approve shows a toast and opens the backlog; live backlog shows a "live data" banner with the project name (endpoint 7). Story points still the 1, 2, 3, 5, 8, 13 select: the request for any number up to 20 collides with AD-12 and is held for the operator (Remaining) | W7-UI | this commit |
| 2026-11-09 | Merged `w7-implement-pm-plan-flow` at `21b47fd` (W7b: endpoints 36, 38, 39, 58, 59, 60; clean merge). `live-plan.tsx` now edits checkpoints (58), epics (38: title, description, checkpoint, whole task list), adds (59) and deletes (60) epics, regenerates (39), with a note on title/description edits (W7b spec SD10); "Expand all" keeps going past a failed epic and says how to recover (Edit and write the tasks). New `live-backlog.tsx` reads checkpoints, epics and tasks (12, 16, 20) when `LLM_MODE=live`. FE and `tsc -b` clean; not run in a browser | W7-UI | this commit |
| 2026-11-08 | First UI slice: `LLM_MODE=live` switches `PlanIdea` and `Plan` to a new `live/live-plan.tsx` (idea, generate, expand each or all epics, approve, reject) over data-layer functions 34, 35, 37, 40, 41 (`lib/api/index.ts`, `live.ts`, `mode.tsx`); layout passes the mode down; `local`-tier dev token `dev-pm` (C~2). FE typecheck and data-layer lint pass; `tsc -b` clean; 15 API tests pass. Not run in a browser or against a database | W7-UI | this commit |
| 2026-11-08 | Branch `w7-link-ui` created in worktree `../CS3227-2610-MP4-w7-link-ui` from `w7-implement-pm-plan-flow`; branch state written | W7-UI | this commit |

## 4. Decisions

### C~5 — Allow timestamp update for an all-DONE bulk claim

- **Date:** 2026-11-11.
- **Who asked:** the operator, answering the E12 blocker question.
- **Decision:** proposal updatedAt may advance when the existing lock is acquired on an all-DONE request; plan content and proposal version remain unchanged, with no model call or session check.
- **Why:** the operator accepts the lock's timestamp update; preserving the timestamp was rejected as unnecessary.


### C~1 — `LLM_MODE` is the switch between fixtures and the live API; no new variable

- **Date:** 2026-11-08.
- **Who asked:** the operator, replying to the question on how the plan screens decide to call the real API: use the existing `LLM_MODE` and create no new variable.
- **Decision:** the plan data-layer functions (endpoints 34 to 41) call `/api` when `LLM_MODE=live` and use fixtures otherwise. `LLM_MODE` is read on the server (it is not `NEXT_PUBLIC_`) and handed to the client through the root layout; no new environment variable is added.
- **Consequence to check:** by W2 SD5, `prod` must be `live` and `test` and `preview` must be `mock`, so `mock` is not a "backend with a mock model" in the UI; in `mock` the plan screens never reach the backend, and the mock plan flow (E45) can be driven from the UI only by a tier that sets `live`. The API needs a Firebase Bearer token and `src/fe` has no sign-in (role cookie only, C46), so the live path returns 401 until a token source exists.

### C~3 — Reverse AD-12: story points are any integer 1 to 20 (not built yet)

- **Date:** 2026-11-10.
- **Who asked:** the operator, answering the keep-or-reverse question raised when they asked for a numeric points input up to 20.
- **Decision:** reverse AD-12 (story points were 1, 2, 3, 5, 8, 13). New range: integers 1 to 20. Velocity, progress and forecast keep working on the sum.
- **Why:** the operator's call; they want free numeric estimates. Not yet recorded in `docs/architecture` (decision log, contracts §3.1, `agile-platform-architecture.md` §8 error example); that is part of W7c.
- **Follow-up:** own workstream W7c with a spec before any code (AGENTS §3, §4); owners of W5 (Dev Lead: task CRUD) and W8 (facts) to agree under AD-11.

### C~4 — Bulk expand: one model call for all epics, single-epic regenerate sees the rest

- **Date:** 2026-11-10.
- **Who asked:** the operator: since the UI expands all epics at once, add a new prompt that writes every epic's tasks in one call so they flow logically; regenerate stays per epic but is sent the other epics and tasks.
- **Decision:** part of W7c (above). Replaces the per-epic calls of the "Confirm and Expand Epics" button.
- **Why:** per-epic calls only see the approach and their own epic, so tasks overlap across epics.

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

## Lessons

### L~1 — Prompt labels must flatten Unicode line separators

- **Date:** 2026-11-10
- **Cause:** T4 initially flattened CR and LF but omitted U+2028 and U+2029, permitting forged mock index lines.
- **Rule:** When rendering untrusted text into line-based prompt formats, test all JavaScript line separators.
- **Scope:** project
- **Found by:** Attacker reviewer

### L~2 — Assert context and no-write results directly

- **Date:** 2026-11-10
- **Cause:** T5 tests checked result kinds without checking populated context and unchanged persisted rows.
- **Rule:** Test the returned data and persisted state for context and no-op paths, not just the result kind.
- **Scope:** project
- **Found by:** Tester reviewer

## Deviations

### D~1 — All-DONE bulk claim updates proposal timestamp

- **What:** T6's all-DONE no-change integration test sees proposal.updatedAt advance because T5 claimPlanEpics locks the proposal via a write before detecting no targets.
- **Consequence:** T6 is blocked; its partial edits and failing test are uncommitted. Determine whether the approved task contracts can be reconciled without a behavior change; otherwise a spec amendment is required.
- **Action:** Stopped T6 without weakening the test. T5 reviewer confirmed the task requires both the existing write-based lock and no writes, which conflict in this environment. T5 is blocked as a wrong task file; T6 is blocked on its dependency. Plan lint now reports two existing T5 Create paths because T5 is Blocked; it passed before the status change. Partial T6 edits are in src/be/pm/src/plan-flow.ts, runtime.ts, test/fakes.ts and test/plan-flow.test.ts; handover T6.json records the failure.

### D~2 — Endpoint 61 lists an unreachable error

- **What:** The approved spec lists RATE_LIMITED for endpoint 61, but no expand path can raise it; gateway result codes exclude it.
- **Consequence:** This listed error cannot be exercised as specified.
- **Action:** Recorded as requested; no artificial error path added. Resolve through spec change control if behavior or contract is amended.

### L~3 — Check prompt context inclusions and exclusions

- **Date:** 2026-11-11
- **Cause:** T6 tests checked other epic titles but omitted task-title inclusion and target exclusion.
- **Rule:** Assert both included and excluded context at each prompt path.
- **Scope:** project
- **Found by:** Tester reviewer

### D~3 — T7 mock provider assertion conflicts with gateway

- **What:** T7 E34 requires no provider call in mock mode, but the real gateway invokes a mock provider's complete method.
- **Consequence:** T7 stopped as instructed for a wrong task file; route edits and tests remain uncommitted. T8 continues independently.
- **Action:** Preserve T7 partial work (paths and exact task quotations in handovers/T7.json); report the discrepancy without interpreting provider as live provider. Plan lint reports two existing T7 create paths while T7 is Blocked; E2E tests have not been written.

### D~4 — T7 non-creator assertion conflicts with ownership boundary

- **What:** T7 E28 requires a member non-creator to receive 404 without calling the flow, but its rules put creator ownership in the proposal store reached through the flow.
- **Consequence:** T7's assertions cannot both hold under the specified ownership boundary.
- **Action:** Stopped T7 and retained partial work for task correction.

### L~4 — Verify required UI copy in loading states

- **Date:** 2026-11-11
- **Cause:** T8 initially retained shorter loading labels than the task required.
- **Rule:** Compare each changed UI state against its exact specified copy before review.
- **Scope:** project
- **Found by:** Implementer reviewer
