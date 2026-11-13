# Branch State — w7c-pm-ui

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7c-pm-ui (continues the earlier `w7-link-ui` branch, whose record is merged into this file on 2026-11-13; `w7-link-ui` itself was stacked on `w7-implement-pm-plan-flow` at `1bc7384`)
- **Base:** 57708a8 (`development` after PR #44 merged; PR #42 included)
- **Owner:** Xiao-Congchen (PM)
- **Status:** Draft
- **Last updated:** 2026-11-13 by Claude — merged the `w7-link-ui` record and the local CI-investigation record into this file

**Untouched:** Conventions

---

**Scope and fold boundary.** Substantive W7c record: story points 1–20 and plan-wide expansion (endpoint 61), plus W7-UI plan screens and live backlog work. PR #33 merged into a feature branch; PR #44 carried this stack, including W7b, into `development` at `57708a8`. Reconcile outstanding evidence, approvals and overlapping provisional IDs before folding. Do not duplicate W7 or W7b decisions/handovers; W14, W5 and W9 own their separate changes. The former integration-only `codex/w7c-pm-ui` record and the `w7-link-ui` record are both folded into this file; `w7-implement-pm-plan-flow.md` holds W7 and W7b.

**Current integration caveat:** the development merge retained newer live project navigation and backlog components in conflicts. Compare the final PR #44 diff with C~11–C~14 and the live-backlog spec before filing those decisions or claiming all earlier UI behavior remains; previously recorded browser verification predates this integration. Real authenticated PM flow, D~8 live outline, E36, conflict recovery and project switching remain unverified. Historical session rows and Remaining items below describe earlier work and require reconciliation before a fold.
---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| s1 | 2026-11-08 | Claude Sonnet 5.5 | W7 UI | Paused | Survey done; waiting on the operator's answer on auth and live-versus-fixture mode (Remaining) | Add data-layer functions 34-41 in `src/fe/lib/api/index.ts`, then wire `PlanIdea` to 34 | 2026-11-08 |
| s2 | 2026-11-10 | Codex | W7c, W7-UI | Blocked — live outline | PM history wired and reviewed; W5/W14/W16 remain with their owners; D~8 remains | Diagnose D~8; verify backlog conflict/project switching and complete E36 and live 10-epic measurement | 2026-11-11 |
| s3 | 2026-11-13 | Claude | W7c, W7-UI | Paused | Verified CI fixes; merged `development` (57708a8); consolidated branch states. Repaired New project popup and PM backlog wiring (uncommitted) | Open a project with epics as the PM and exercise the backlog (picker, drag, keyboard move, conflict, project switch); then commit | 2026-11-13 |
| s4 | 2026-11-13 | Codex | Tier 2 removal | Blocked — needs human | Removal spec reviewed and awaiting Gate 1 approval | On approval, mark spec approved and prepare the implementation plan | 2026-11-13 |

**Upstream check (2026-11-11):** origin/main remains at the initial commit and is already an ancestor; a fast-forward-only pull was a no-op. origin/development has 59 commits absent from this branch; eight files changed on both sides. Do not merge or rebase without the required branch review and integration decision. The published parent stops at 1bc7384; its 30 W7b commits are local only.

**Integration (2026-11-11):** Development integrated through the W7 and W7b stack. The PM UI now uses the Firebase-backed authenticated API client; the previous fixed frontend dev token is no longer used. Verify real sign-in, live PM calls, session behavior, project switching and sign-out before review; frontend typecheck and tests could not run because Firebase and Vitest dependencies were unavailable in the isolated checkout. W12-paths was extracted to codex/w12-paths; its independent PR must land separately.

**Current remaining (2026-11-13)**

- [ ] **Flaky test (handover):** `transaction-marker` fails intermittently with a connection/transaction timeout on a local PostgreSQL 16; passes on rerun. Not fixed, cause unproven; PR #44's CI run passed it.
- [ ] Reconcile W7, W7b, W7c and W7-UI decisions, deviations, handovers and architecture together against current development and the final PR #44 tree; allocate separate provisional IDs by source before any permanent allocation.
- [ ] **PM backlog regression (repaired 2026-11-13, browser check pending):** `backlog-list.tsx` now renders `live-backlog.tsx` for the PM in live mode (search/filter and board link kept; sprints read through the paged `listSprintsLive_27`). Dev Lead and developer keep the W5 list, whose tests pin its behavior; the spec also lets the Dev Lead edit, so decide whether to extend it. Still to verify in a browser with a project that has epics: checkpoint picker, drag, keyboard move, conflict recovery, project switching.
- [ ] Diagnose live outline D~8 and verify authenticated idea → expand → approve, E36 and the live measurement where feasible; preserve limitations as handovers if unresolved.
- [ ] Obtain owner review/approval and prepare the combined W7 family fold. Reconcile other already-folded workstreams against current development rather than replaying their entries.
- [ ] Resolve or mark historical sessions and open items as handovers before fold; W7, W7b and W7c integration-only files must not duplicate substantive records.

**Historical checklist (superseded; evidence to reconcile, not a current task list)**

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
| W7c | Story points 1-20 and plan-wide expansion | Building | [spec](../../specs/2026-11-10-w7c-points-and-plan-expand-design.md) (approved 2026-11-10) | [plan](../../plans/2026-11-10-w7c-points-and-plan-expand/plan.md) (approved 2026-11-10; 9 tasks, 6 waves) | 10/10 tasks done; live E36 and measurement blocked by D~8 | — |
| W7-UI | PM plan screens and live backlog editing | Building | [backlog editing draft](../../specs/2026-11-11-live-backlog-editing-design.md) | none yet | PM history wired; conflict/project-switch verification remains | — |
| W~1 | Remove Tier 2 | Spec'd | [in review](../../specs/2026-11-13-tier-2-removal-design.md) | none | Spec review complete; Gate 1 approval pending | — |

## Integration record reconciliation

- `codex/w7c-pm-ui` was an integration-only record. On 2026-11-12 it integrated the W7b base while retaining sprint and Dev Lead services. PR #33 merged into the W7b feature branch; PR #44 merged the stack to development at `57708a8`. The 2026-11-13 integration retained W14 services and UI, and its typecheck, 48 focused backend tests and 286 frontend tests passed. Real sign-in and the live PM flow remain unverified. W14 and other workstreams retain their own records.
- The local CI-investigation record that briefly used this filename is folded into this file (its Changes lines are below). PR #44 head `8231861` passed the workspace CI job, whose workflow provisions PostgreSQL 16, applies migrations and runs `npm test` with `W1_INTEGRATION_DATABASE_URL`; typecheck, lint and contract jobs also passed. On 2026-11-13 the operator also ran the full suite locally against a disposable PostgreSQL 16 container: no failures except the flaky `transaction-marker` timeout.
- `codex/w7-pm-plan-flow` and `codex/w7b-plan-editing` integration records were deleted; their content is in `w7-implement-pm-plan-flow.md` (Integration record reconciliation).

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-13 | Drafted Tier 2 removal spec after operator reversed C19, C27's usage ownership and C83's Tier 2 policy restriction; first review found task and session dependencies, Q1 open. No implementation changed. | W~1 | working tree |
| 2026-11-13 | Styled dropdown: new `live/select.tsx` (pill trigger, rounded floating menu of pill options, accent on the chosen one, keyboard and Esc support that does not close the surrounding modal) replaces the native `<select>` in `live-backlog.tsx`, `live-plan.tsx` and `forms.tsx` (styles `.ss*` in `canvas.css`). Every native `<select>` in `src/fe` is now this component (compact variant for the board filters, My Work and standups); "Blocked only" is a pill toggle. Board Epic and Assignee filters are a searchable multi-select (`live/multi-select.tsx`) with Unassigned pinned first: the task API takes one epic/assignee and has no unassigned filter, so with a multi-selection the board loads up to 100 tasks, filters and pages them client-side (a project with over 100 tasks is truncated at 100, same limit as the Backlog). Number spinners hidden, native controls tinted with the accent. Date, file and radio inputs are still native. Tests updated for the new controls; one unrelated test (F7 "no remove control") is stale since `3676c59` added member removal. Board page no longer scrolls: `.board-fit` makes the columns fill the viewport height and only each column's cards scroll. FE typecheck clean for touched files; not run in a browser. | W7c, W7-UI | working tree |
| 2026-11-13 | Live wiring audit against the local DB (agile_platform, project "Library bookkeeping": 4 checkpoints, 8 epics, 21 tasks, 161 pts, 1 approved plan; browser as the PM): Projects, Overview, Board, Backlog, Checkpoints, Sprints, Health, Members, Plan and Plan history match it. Fixed: approve (and the post-generate URL swap) pushed `/projects/p1/...` because `r()` defaults to the prototype project id, so the PM landed on the mock backlog; they now carry the open project id. Settings was a pure mockup; now shows the real name and brief read-only. Checkpoints now list their linked epics (read from endpoint 16). Handover: the API has no project update or archive route (`PM_PROJECT_UPDATE` is in the contract only), so Settings cannot save or archive. Approve redirect not exercised end to end (no model run). FE typecheck, lint and 286 tests pass. | W7c, W7-UI | working tree |
| 2026-11-13 | Post-merge UI repairs: New project is a `ModalRoute` popup over the Projects list again (it had rendered as a full page below the list after W14's modal routing; `NewProject` added to `MODAL_BASE`). PM live backlog restored to the editable `live-backlog.tsx` (was unreachable); its sprint read fixed for the paged endpoint 27. FE typecheck, lint and 286 tests pass. New project popup checked in a browser; backlog not yet (test user had no projects). | W7c, W7-UI | working tree |
| 2026-11-13 | Consolidated branch states: `w7-link-ui.md` and the local CI-investigation record merged into this file; the three `codex/w7*` integration records deleted (already reconciled in `w7-implement-pm-plan-flow.md`). | W7c, W7-UI | working tree |
| 2026-11-13 | Windows test fixes in `d164778`: LF for migration SQL in `.gitattributes`, `fileURLToPath` in `w13-migration.test.ts`, and a reviewed edit to `scripts/w13/migrate-production.mjs`. Full local suite against PostgreSQL 16 then passed except the flaky `transaction-marker` timeout. | W7b, W7c | d164778 |
| 2026-11-13 | Updated stale W14 integration assertions and the story-points hint; reject edits on archived projects before reading proposal epics (CI repairs for PR #44). | W7b, W7c | 9f4afe7 |
| 2026-11-13 | Compared merged PM backlog with W7c: `live-backlog.tsx` is not imported; W14 `backlog-list.tsx` is rendered instead, leaving W7c edit/drag/picker behavior unreachable. Repair and verification remain. | W7c, W7-UI | working tree |
| 2026-11-13 | Confirmed PR #44 merged into development at `57708a8`; coordinated reconciliation remains pending. | W7c, W7-UI | 57708a8 |
| 2026-11-13 | Owner requested one coordinated W7/W7b/W7c fold, preserving cross-branch changes and reconciling current development. Preparation only; PR #44 has merged at `57708a8`. | W7c, W7-UI | working tree |
| 2026-11-13 | Integrated development and opened PR #44. Typecheck, 48 focused backend tests and 286 frontend tests passed; real authenticated flow and retained UI behavior remain to be reviewed. | W7c, W7-UI | fe016cd, PR #44 |
| 2026-11-11 | Wired PM plan history to endpoint 36 with filters, paging and project-safe opening; live browser verified approved plan, filter and new composer. FE typecheck, lint and navigation epoch test pass; independent review fixed stale-navigation races. W5/W14/W16 owner scopes retained. | W7-UI | this commit |
| 2026-11-11 | Restored compact backlog rows and status chips; chevrons toggle checkpoint/task details, direct epic drag and keyboard move with focus restoration verified in local test project. FE typecheck, lint and spec lint passed; independent review clean. | W7-UI | this commit |
| 2026-11-11 | Live backlog editing implemented and reviewed: checkpoint, epic and task editors; checkpoint grouping and task movement; sprint list and scoped versioned writes. Full suite 786 passed, 0 skipped; typecheck, lint, contracts and Prisma validation passed. Browser verified collapse, keyboard expand, checkpoint/epic/task saves, task move selector, checkpoint drop picker and cancel in disposable local project; conflict recovery, cross-checkpoint drop completion and project switching remain unverified. | W7-UI | this commit |
| 2026-11-11 | T10 prompt amendment implemented: outline targets three months; bulk receives checkpoint dates and requests small developer-assignable tasks. PM 68 and proposals 78 passed, no skips; review clean after separator test, typecheck passed. Live model measurement pending. Backlog editing spec reviewed; operator chose destination epic on checkpoint drop; gate 1 pending. | W7c, W7-UI | this commit |
| 2026-11-11 | Operator requested checkpoint grouping on both review steps; C~9 spec amendment and T8 follow-up implemented, FE typecheck and lint and ordering self-check pass; independent review clean, browser check pending. | W7c | this commit |
| 2026-11-11 | Close-out npm test: 781 passed, 0 failed, 0 skipped; typecheck, lint, contract, Prisma validation and plan close-out lint pass. Browser opened project list but repeated clicks and navigation timed out; E36 steps and live 10-epic measurement not run. | W7c | this commit |
| 2026-11-11 | T5 D~6 fixed (2eaa418): skip stale claims under proposal lock, lock and recheck matching rows. Proposal suite 77 passed, targeted 10 passed, no skips; Implementer, Tester and Attacker review clean after E12 assertion fix. | W7c | 2eaa418 |
| 2026-11-11 | Operator approved T5 stale-claim check, lock and recheck correction (C~8); task amended, regression fix started. | W7c | this commit |
| 2026-11-11 | Close-out review: fixed stale UI after bulk failure (bb7b5ed), independently reviewed; found T5 skipped-row timestamp conflict D~6. E36 and live measurement pending; browser automation timed out. | W7c | bb7b5ed |
| 2026-11-11 | T9 complete (62d1145); old-scale scan passed and Implementer review corrected formula wording; wave build checks pass. | W7c | 62d1145 |
| 2026-11-11 | T7 complete (13ea6a2); full suite 780 passed, 0 failed, 0 skipped; full review resolved E28/E29 coverage gaps; wave build checks pass. | W7c | 13ea6a2 |
| 2026-11-11 | D~5 migration checksum fixed locally by restoring tracked LF checkout; W13 migration tests 6 passed, 0 failed, 0 skipped. Checkout-only fix will need repeating if Git converts line endings again. Security path fix being specified under W12-paths. | W7c | working tree |
| 2026-11-11 | Operator clarified T7 E28/E34 (C~6): mock provider is allowed, live provider is not; non-creator receives 404 via existing ownership check. Task corrected; T7 resumed. | W7c | this commit |
| 2026-11-11 | T8 complete (1d2bc12); FE typecheck and data-layer lint pass, 8 validation self-check cases pass; reviewer found and confirmed fix for missing bulk loading copy. Manual E36 pending. | W7c | 1d2bc12 |
| 2026-11-11 | T6 complete (ade3a1b); PM suite 66 passed, 0 failed, 0 skipped; full reviews resolved F6 task-context coverage. Wave build, contract and Prisma checks pass. D~2 remains. | W7c | ade3a1b |
| 2026-11-11 | Operator accepted all-DONE lock updating proposal updatedAt (C~5); E12 spec and T5/T6 amended; Implementer, Tester and Attacker reviewed and re-reviewed. T5 restored to Done; T6 resumes. | W7c | this commit |
| 2026-11-10 | T4 and T5 complete (7b665b7, 60702ae); full reviews resolved Unicode separator injection and E11/E12 coverage findings. PM suite 60 and proposal suite 76 passed without skips; revised targeted suites passed. Shared-worktree task markers skipped to avoid collisions. Handover commit fields are pending; refs here are actual. | W7c | 7b665b7, 60702ae |
| 2026-11-10 | T2 complete (04feed6): shared points schema applied to backend; 308 tests passed, 0 failed, 0 skipped including integration; Implementer review clean. Handover commit field says pending; actual commit is 04feed6. | W7c | 04feed6 |
| 2026-11-10 | T1 and T3 complete (2ed9726, 26d1329); Implementer, Tester and Attacker reviews found no blocking issues. T1 OpenAPI mappings lack direct assertions; contract parity passes. Gateway tests: 149 passed, 0 failed, 0 skipped including integration. | W7c | 2ed9726, 26d1329 |
| 2026-11-13 | Delete routes wired (operator said yes): endpoints 15, 19, 25 (`DELETE ...?version=`, 204; PM or Dev Lead; soft delete). Checkpoint delete unlinks its epics; epic delete cascades to its tasks and is 409 while it holds a DONE task; task delete is 409 when DONE or in a CLOSED sprint (architecture lifecycle table). Core tests in `planning-deletes.test.ts` and route-list tests pass; `tsc -b` clean. Frontend: `deleteCheckpointLive_15`, `deleteEpicLive_19`, `deleteTaskLive_25`; Delete on live checkpoint cards, and Delete checkpoint/epic/task in `live-backlog.tsx` (left uncommitted: it also carries the operator's concurrent `Select` edits). The live task drawer still has no delete (its delete is prototype-only). Not run in a browser or in the frontend tests. Still no route for 26, 43, 53, 54, 56, 57 | W7c | this commit |
| 2026-11-13 | Operator asked to wire the remaining flows. Backend: new `projects.update` (endpoint 8, PM only, version guard, one-way `status: ARCHIVED`) and `projects.removeMember` (endpoint 11, add's role pairs, 409 `CONFLICT_STATE` with open tasks), routes in `api/routes/projects.ts`, core and route tests pass (15). Frontend: `updateProjectLive_8`, `removeMemberLive_11`; `LiveSettings` saves name/brief with a conflict banner and archives behind a type-the-name confirm (archived projects drop out of reads, so it leaves for the project list); live Members shows Remove and the dialog calls 11. Operator deferred the frontend test run: `w5-pages` "live members without a remove control" now pins the old behavior and must change; `w5-pages`/`team-standups-live` failures also appeared in a full run and were not triaged (the operator has concurrent UI edits). Not exercised in a browser. **Handover:** still no backend route for 15 (delete checkpoint), 19 (delete epic), 25 (delete task), 26 (task events), 43 (lead overview), 53/54 (standup update, feedback), 56/57 (usage); the matching UI is mock-only | W7c | this commit |
| 2026-11-10 | W7c spec approved at Gate 1 and plan approved at Gate 2 by Xiao-Congchen; plan reviewed once (7 blocking findings fixed); the front-end work (project flow, plan editing, live backlog) committed as `7dbde06`; spec `0aab004`; execution handed to another agent | W7c | this commit |
| 2026-11-10 | W7c spec written ([spec](../../specs/2026-11-10-w7c-points-and-plan-expand-design.md), Medium + Attacker lens, lint clean): points 1 to 20 (reverses AD-12) and plan-wide expansion (new endpoint 61, one model call for all epics, rest-of-plan context for 37 and 39, per-feature gateway limits). Live measurement on SoCLaaS (llama3.1:8b, 10 epics): bulk call 12.3 to 26.9 s, 977 to 2,086 output tokens; limits set to 2x (54 s, 4,200 tokens). Review round 1 (Implementer, Tester, Attacker) folded; awaiting Gate 1 approval | W7c | this commit |
| 2026-11-10 | Project flow UI on real data (`LLM_MODE=live`): Projects list (6), New project (5), project switcher and header names (7); `Screen` sets the open project from the URL (`setCurrentProject`) and the data layer, plan drafts and backlog follow it (the seeded-id constant is gone). Endpoint 6 takes no `status` query, so the tabs filter client-side. FE typecheck and lint pass; not run in a browser | W7-UI | this commit |
| 2026-11-10 | Live plan page reworked on the operator's feedback: checkpoint list and editor use a 160 px date column then the name; two steps (outline: approach, checkpoints and an editable Epics card with "Confirm and Expand Epics", then tasks, all editable); approve shows a toast and opens the backlog; live backlog shows a "live data" banner with the project name (endpoint 7). Story points still the 1, 2, 3, 5, 8, 13 select: the request for any number up to 20 collides with AD-12 and is held for the operator (Remaining) | W7-UI | this commit |
| 2026-11-09 | Merged `w7-implement-pm-plan-flow` at `21b47fd` (W7b: endpoints 36, 38, 39, 58, 59, 60; clean merge). `live-plan.tsx` now edits checkpoints (58), epics (38: title, description, checkpoint, whole task list), adds (59) and deletes (60) epics, regenerates (39), with a note on title/description edits (W7b spec SD10); "Expand all" keeps going past a failed epic and says how to recover (Edit and write the tasks). New `live-backlog.tsx` reads checkpoints, epics and tasks (12, 16, 20) when `LLM_MODE=live`. FE and `tsc -b` clean; not run in a browser | W7-UI | this commit |
| 2026-11-08 | First UI slice: `LLM_MODE=live` switches `PlanIdea` and `Plan` to a new `live/live-plan.tsx` (idea, generate, expand each or all epics, approve, reject) over data-layer functions 34, 35, 37, 40, 41 (`lib/api/index.ts`, `live.ts`, `mode.tsx`); layout passes the mode down; `local`-tier dev token `dev-pm` (C~2). FE typecheck and data-layer lint pass; `tsc -b` clean; 15 API tests pass. Not run in a browser or against a database | W7-UI | this commit |
| 2026-11-08 | Branch `w7-link-ui` created in worktree `../CS3227-2610-MP4-w7-link-ui` from `w7-implement-pm-plan-flow`; branch state written | W7-UI | this commit |

## Architecture — planning and backlog (proposed Now)

Project members can read checkpoints, epics, tasks, members and sprints. Project-member PMs and Dev Leads can update checkpoints and epics through versioned, transactionally authorized endpoints, and update tasks through the existing task endpoint. The live backlog groups epics by checkpoint, supports editing and moving tasks between epics, and uses project-scoped data and versions. Task status authorization remains separate. The frontend uses the local dev-PM token until real sign-in is wired.

## 4. Decisions

### C~15 — Drop Tier 2 for lack of time

- **Date:** 2026-11-13.
- **Who asked and why:** the operator asked to remove W14, W15, W16 and their connected views because there is not enough time to build Tier 2.
- **Decision:** reverse C19 and the usage-endpoint ownership portion of C27; Tier 2 will not be built. Scope and treatment of existing implementation require a spec.
- **Finding:** W14 and several other Tier 2 routes are implemented; Tier 1 progress and backlog depend on some sprint functionality. Removing Tier 2 route policy entries collides with C83. Preserve gateway metering and existing data while scoping; no implementation changes made.
- **C83 reversal:** on 2026-11-13 the operator approved reversing C83 for Tier 2 policy entries so Tier 2 can be removed; retain policy protections for remaining endpoints.
- **Closed sprints:** on 2026-11-13 the operator chose to keep closed-sprint tasks locked because there is no reason to unlock them; preserve historical velocity snapshots.

### C~14 — Wire PM plan history in its existing UI slice

- **Date:** 2026-11-11.
- **Who asked:** the operator, asking to implement PM-side gaps not covered by other workstreams.
- **Decision:** connect the PM plan-history screen to W7b endpoints 36 and 35 in live mode; retain mock history in mock mode. W5, W14 and the other W16 owner slices remain with their recorded owners.
- **Why:** W7b shipped the history API but explicitly left UI wiring out; this branch lists the PM history screen as remaining.

### C~13 — Restore backlog rows and direct epic dragging

- **Date:** 2026-11-11.
- **Who asked:** the operator, after trying the nested-card backlog.
- **Decision:** restore compact rows, use chevrons for checkpoint and task expansion, and move tasks by dragging directly onto epics. Remove the always-visible per-task destination dropdown; preserve the C~11 checkpoint drop picker and retain an accessible keyboard move alternative.
- **Why:** the operator preferred the original row layout and direct epic dragging.

### C~12 — Approve live backlog editing

- **Date:** 2026-11-11.
- **Who asked:** the operator approved the reviewed live backlog editing spec for implementation.
- **Decision:** implement the approved spec directly, continuing the operator preference to skip separate plans; retain security review and tests.
- **Why:** the operator approved implementation and previously directed direct implementation from the spec.

### C~11 — Choose an epic when dropping a task on a checkpoint

- **Date:** 2026-11-11.
- **Who asked:** the operator, selecting a destination epic after being told tasks belong to epics.
- **Decision:** ask the user to choose an epic under the destination checkpoint; do not move the entire existing epic.
- **Why:** move only the intended task while preserving existing task-to-epic relationships.

### C~10 — Prompt for three-month delivery and smaller tasks

- **Date:** 2026-11-11.
- **Who asked:** the operator, after live generation produced overly long timelines and tasks repeating their epic.
- **Decision:** ask the outline model to plan within three months and the bulk model for small, distinct, developer-assignable tasks. Preserve existing date and task-count validation; prompt targets are advisory.
- **Why:** improve initial plan usefulness without rejecting existing valid outputs.

### C~9 — Group review epics by checkpoint

- **Date:** 2026-11-11.
- **Who asked:** the operator, after trying the review flow.
- **Decision:** display epics in checkpoint-list order on both review steps; unassigned or unknown checkpoints last, original order within groups. Display only; rejected changing stored ordering.
- **Why:** make epics easier to review by checkpoint.

### C~8 — Skip stale epic claims before taking an epic lock

- **Date:** 2026-11-11.
- **Who asked:** the operator approved the proposed approach after discussing timestamp and locking behavior.
- **Decision:** under the proposal lock, read and skip stale epic claims without an epic lock; lock and recheck matching claims before writing. Preserve every field of skipped rows.
- **Why:** the existing epic lock updates updatedAt; checking first preserves stale rows while retaining a lock and final guarded check for writes.


### C~7 — Implement security fix directly from its spec

- **Date:** 2026-11-11.
- **Who asked:** the operator, after questioning the ceremony.
- **Decision:** approve the narrowed process-security spec and skip its implementation plan; implement directly from the spec.
- **Why:** the operator judged a separate plan excessive for these fixes. Security tests and review still apply.


### C~6 — Clarify mock provider and creator checks in T7

- **Date:** 2026-11-11.
- **Who asked:** the operator, clarifying T7 after D~3 and D~4 were reported.
- **Decision:** mock mode makes no live provider call; invoking the in-process mock provider is expected. A non-creator receives 404; the existing store check may run through the flow before rejecting the request.
- **Why:** these are the intended test outcomes; the previous task wording incorrectly excluded the mock provider and the existing ownership-check path.


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

### D~5 — Full test suite failed during T7

- **What:** discover-tests: 770 passed, 8 failed, 0 skipped. Failures cover migration checksum, two gateway timing tests, gateway integration and four process-security tests; targeted T7 integration 5 passed, 0 failed, 0 skipped.
- **Consequence:** T7 not accepted or committed; full log is .ws/t7-tests.log and partial files remain.
- **Action:** Focused reruns: gateway suites 46 passed, 0 failed, 0 skipped (full-run cause unproven). Migration checksum reproduces because tracked LF migration is checked out CRLF. Four process-security failures reproduce: scripts/agent-pre-tool-hook.mjs isExternalPath overlooks absolute paths when path and parent do not exist; this merits security review. No tests weakened. T7 handover and .ws/t7-tests.log preserve details.

## Known Gaps

### D~6 — T5 stale epic lock changes skipped row

- **What:** Close-out review found lockEpic updates epic.updatedAt before stale claim checking; when a transaction commits, skipped epic rows are not left exactly unchanged as required. This affects bulk store and fail paths.
- **Consequence:** T5 is blocked: its explicit steps say to lock every result before checking, contradicting the no-change contract under the existing write-based lock. The E12 exception C~5 applies only to proposal updatedAt, not epic timestamps.
- **Action:** Stopped T5 per operator instruction for wrong task files. The implementer identified a candidate ordering (read under proposal lock, skip stale rows, lock and recheck matching rows), but it requires a task correction; no change applied. UI failure refresh fix committed as bb7b5ed and independently reviewed; FE checks and two behavioral self-checks pass. Browser inspection attempts timed out; E36 and live measurement remain unrun.

### D~8 — Live outline fails output guard

- **What:** Three live outline requests in local project W7c close-out verification (dd20c48e-dfcd-4efd-b518-d9a2f982074d) returned The AI is unavailable. Stored call metadata shows SCHEMA_FAIL for llama3.1:8b on all three; this status covers output parsing, security guards and schema validation. The detailed reason is discarded. The truncated flag is false but covers input, not provider output; provider finish reason is not recorded. Test project remains in local DB.
- **Consequence:** Cannot generate an outline to execute E36 or record the 10-epic bulk measurement; W7c remains Building. No live bulk call was made.
- **Action:** Diagnose the output guard without reading secrets or logging prompts; a reason-only diagnostic would change logging and needs spec change control; preserve the no-live-provider rule in automated tests. Browser control is intermittent. Local project W7c close-out verification contains disposable checkpoint, epic and task records; browser verified checkpoint, epic and task saves, move selector, checkpoint drop picker, cancel, collapse and keyboard expand. Conflict, cross-checkpoint drop completion and project switching remain unchecked.

### D~7 — Browser control prevented live close-out

- **What:** Chrome displayed the local project list at localhost:3101 but repeated input dispatch and navigation calls timed out; in-app browser tab creation also timed out.
- **Consequence:** T8 E36 manual network/input checklist and 10-epic live expansion time/token measurement were not performed. Existing app tier/mode and live key have not been verified. W7c remains Building rather than In review.
- **Action:** Restore usable browser control; verify APP_TIER=local and LLM_MODE=live without reading secrets; execute each E36 step and record live measurement. Then finish plan close-out and ask operator for gate 3 review.
