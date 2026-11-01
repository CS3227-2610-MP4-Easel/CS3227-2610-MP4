# Branch State — w10-ui-mockups

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w10-ui-mockups (from `INT` at `4f5f5de`)
- **Base:** 4f5f5de
- **Owner:** Xiao-Congchen (W10 is owned by the PM role, AD-72; member-to-role mapping is open, STATE Q1)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-01 by Claude Sonnet 5.5 — spec index, edge cases and implementation order written

**Untouched:** Architecture, Conventions, Known Gaps

---

**Scope.** W10 UI mockups and shell. First deliverable: one reference document that lists, for every screen of every role, its contents, interactions and states, so the mockups can be built from it. Tier 1 mockups are due 2 Nov, Tier 2 by 5 Nov (AD-71). No code and no mockup yet.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-01 | Claude Sonnet 5.5 | W10 | Paused | Spec approved (gate 1); canvas awaits operator review | Write the plan (`writing-plans-lite`) once the operator confirms the canvas; send the T8 handovers | 2026-11-02 |

**Remaining**

- [x] Operator review of the flows draft: inventory and Q1 to Q8 decided 2026-11-01 (`ui.md` §8).
- [x] Spec index (`2026-11-01-w10-ui-design.md`), `edge-cases.md`, `implementation-order.md` written; `lint.mjs spec` passes (2026-11-01).
- [x] Review: one Implementer lens run, findings fixed; Tester lens skipped at the operator's request (C~5).
- [x] Gate 1 (`writing-specs-lite`): approved by Xiao-Congchen, 2026-11-02. No open questions. Q9 closed 2026-11-02 as SD13 (Next.js 15 + Tailwind + shadcn prototype with a typed data layer). Q10 closed 2026-11-02 as SD12 (no Remove on a row of the caller's own role).
- [ ] Re-check that the canvas matches the review fixes: Continue plan banner on S14 phase A, PM keeps Add task on S6, sprint controls hidden in Tier 1, project tabs now carry a Tier.
- [x] Design tokens, shell and shared components, then all 20 screens drawn on the design canvas (https://claude.ai/artifact/1J79XZiCmPvriGrBtAP2B6), 2026-11-01.
- [ ] Operator review of the canvas; fix details until "most details are confirmed" (C~4).
- [ ] Then translate the confirmed canvas to a standalone prototype (Next.js 15 in `src/fe`, C~13). Tokens to mirror as CSS variables: `project/ui.css` `:root` on the canvas.
- [x] Drawn 2026-11-01 (C~6 to C~10): role variants (board PM/Developer/archived, backlog, checkpoints, sprints, members, overview), dialogs and forms (add task, add epic, add checkpoint, new sprint, close sprint all done, mark blocked, remove member), states (sign-in error, finish setup, empty lists, plan approved/discarded/replaced, standups Earlier, standup AI unavailable on a Friday, 1024 px icon nav).
- [ ] Still not drawn: inline edit forms beyond the add forms, the S14 epic edit form (T2), the S6 "Show more" paging state, the offline banner on a project screen, the 403 page on its own. Nothing is visually verified: I have not opened the canvas.
- [ ] **Handover (layout):** C~13 moves the web app from `apps/web` to `src/fe`; the W1 owner amends AD-01a/b, the guardrail, the Vercel root and the monorepo layout.
- [ ] **Handover:** tell the Dev Lead (W5) that endpoint 6 should return `ProjectDetail` items (progress per project, approved as Q1 in the W10 spec's `ui.md` §8); without it S3 calls endpoint 7 per row.
- [ ] **Handover (permission change and endpoint move):** the PM may read the full facts (approved as Q5 and C~3). Endpoint 42 moves from `/api/lead/projects/{id}/facts` to the shared path `GET /api/projects/{id}/facts` (AD-07 reserves `/api/lead` for the Dev Lead) and its policy changes from `LEAD; member` to `PM, LEAD; member`. The number and the endpoint count (57) stay. Owners: the Dev Lead (policy map, W1) and the W8 owner (`lead` module). Amend AD-47, architecture §7 operation table, `contracts.md` §3.5, `delivery-plan.md` and `slicing.md` if they cite the path, and the generated authorisation tests (AD-26). Digest (44, 45) and re-plan (46 to 48) stay Dev Lead only.
- [ ] **Handover:** tell the W7 owner that endpoint 36 (plan list) moves from Tier 2 to Tier 1, so the PM can continue a plan in progress (approved as Q2). Update the Tier lists in `delivery-plan.md` and `slicing.md`.
- [ ] **Handover:** tell the W9 owner that the standup `date` may be tomorrow (the next working day, Asia/Singapore) as well as today, because a standup prepares the next daily standup. Confirm endpoint 51 and 52 accept a future date and how the AD-44 activity window is anchored to it; amend `contracts.md` if needed.
- [ ] **Handover:** tell the W4 owner the sign-in and register screens are specified in `screens-shared.md` S1 and S2; W4's branch still asks whether W10 delivers a working page or a design only; answer it in the spec index.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W10 | UI mockups and shell | In progress | [spec folder](../../specs/2026-11-01-w10-ui-design/ui.md) ([index](../../specs/2026-11-01-w10-ui-design.md), approved 2026-11-02) | [plan](../../plans/2026-11-02-w10-prototype.md) (approved 2026-11-02) | T9 in flight: data layer behind the interactive screens; move the rest, then T9f | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-01 | Draft UI reference: shell and navigation, 20 screens with contents, interactions and states, and end-to-end flows per role | W10 | 4cd429a |
| 2026-11-01 | PM Backlog and Checkpoints boards added; Plan tab moved before Checkpoints (C~12; ui.md §3) | W10 | this commit |
| 2026-11-01 | Left nav removed; top-bar project switcher with All projects; full-width pages (C~11; ui.md, edge-cases E45) | W10 | this commit |
| 2026-11-01 | Role variants, dialogs, states and shared components added to the canvas; spec updated for C~6 to C~9 (ui.md, edge-cases.md E11 and E48, screens-shared, screens-project, screens-dev, flows) | W10 | this commit |
| 2026-11-01 | All 20 screens, a global-states sheet, the close-sprint and plan-approve dialogs and shared shell components drawn on a design canvas (outside the repo); not visually verified | W10 | canvas link in Remaining |
| 2026-11-01 | Spec index, edge cases and implementation order written; the screen files split so each stays under 200 lines (`screens-project.md`, `endpoint-coverage.md` added). `lint.mjs spec` passes. Implementer lens run, Tester skipped (C~5) | W10 | 3aab4d6 |
| 2026-11-02 | Data layer `src/fe/lib/api` (typed fixtures, one function per endpoint number, in-memory store kept in sessionStorage). Board, sprints (start, close with carry-over, delete), members (add, remove with open-task refusal), checkpoints (add), standup (edit, accept, regenerate, copy, retry, example download), health (refresh, apply, dismiss), task status and blocked, archive project now work through it; toasts report each result | W10 | this commit |
| 2026-11-02 | `src/fe` prototype: 73 canvas pages converted to React, routed by the spec URLs with a role cookie, every control wired to its screen; `linkcheck` passes for all three roles (no dead link, every screen reached). Not yet behind a data layer (T9b) | W10 | this commit |
| 2026-11-02 | Prototype plan written and approved (gate 2); link check added at the operator's request | W10 | this commit |
| 2026-11-02 | Web app location reversed to `src/fe` (C~13); ui.md updated | W10 | this commit |
| 2026-11-02 | Spec approved by the operator (gate 1); Q9 closed as SD13, Q10 as SD12 | W10 | this commit |

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — The screen reference lives in the W10 spec folder, split by role

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen), who wanted a document of each page's contents and interactions to build the mockups from, going beyond architecture §13
- **Why:** it is the `ui.md` component of W10's Big spec, so it is reviewed and approved with the spec. Split into shared rules, flows and one file per role so each stays readable.
- **Rejected:** a standalone file under `docs/`, which would sit outside the approval gate; a single file, which would be too long to review.

### C~2 — Inventory and open points of the UI reference approved; standup day is a two-option selector

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Why:** the 20-screen inventory and Q1, Q2, Q3, Q4, Q6, Q8 were accepted as proposed; Q1 and Q2 change other owners' contracts and scope, so they are handovers above. Q5 was answered: the PM sees project progress, only forecast and risk stay Dev Lead only. Q7 was changed: a standup prepares the next daily standup, so S20 offers **For the next standup** (default, the next working day) and **For today**, instead of a date picker.
- **Rejected:** a free date picker limited to the last 7 days (the first proposal).

### C~4 — Mock up on the design canvas first, prototype later; all 20 screens in one pass

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen), answering the build-target question
- **Why:** details should be confirmed on the canvas before any code; the standalone prototype is translated from it afterwards. Scope is all 20 screens, not Tier 1 only.
- **Rejected:** scaffolding `apps/web` now (W1 has not landed); static HTML only.

### C~3 — The PM may read project facts

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen), reversing the earlier clarification of Q5 (PM sees progress but no risk)
- **Supersedes:** AD-47 and architecture §7's operation table, which list facts as Dev Lead only
- **Why:** the PM should see current progress, forecast and checkpoint risk without asking the Dev Lead. It is a read of data the PM can already see in pieces.
- **Scope confirmed:** the PM gets the whole `Facts` response (progress, forecast, per-checkpoint risk, overload), because the PM manages the whole project or several. Uploaded items, summaries and standups stay invisible to the PM.
- **Contract:** endpoint 42 moves to `GET /api/projects/{id}/facts` with policy `PM, LEAD; member`.
- **Rejected:** computing checkpoint progress in the browser; a trimmed PM response.

### C~5 — Only the Implementer lens reviews the W10 spec

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Why:** W10 is UI design only (no data, no code), so the Tester lens adds little.
- **Rejected:** the Medium-tier default of Implementer plus Tester.

### C~6 — Light is the default theme; the dark palette on the canvas is for testing only

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Why:** the spec stays light-only (`ui.md` §2, non-goal "a dark theme"); the canvas keeps a dark and a light palette with a toggle so colours can be compared and tuned. Light is the default; dark is opt-in.
- **Rejected:** shipping dark as a product theme.

### C~7 — No "Sprint closed" label on cards and rows

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen): "if it is done it is done"
- **Supersedes:** edge case E11's lock and label on rows and cards (updated). The drawer still says the task is frozen.
- **Why:** closing a sprint moves unfinished work on (C~8), so a closed sprint holds only Done tasks and the label adds nothing.

### C~8 — Closing a sprint moves unfinished tasks to the next sprint, after confirmation

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Why:** unfinished work should continue in the next sprint. The happy path is that every task is done in time and the sprint closes with nothing to carry over. The Dev Lead can still send a task to the backlog; with no PLANNED sprint the default is the backlog (E48).
- **Rejected:** defaulting every unfinished task to the backlog (the first draft).
- **Contract:** none; `carryOver` in endpoint 31 already takes a target per task, so only the UI default changes.

### C~9 — Board gets a status filter; the multi-column card layout is dynamic

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Why:** a Dev Lead may want only In progress, or In progress and In review. The remaining columns widen and their cards flow into several columns; this is responsive layout, not a separate design. Two filtered variants are on the canvas.

### C~10 — Canvas organisation: shared components at the side, role variants, states and dialogs drawn

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Why:** shared components (top bar, left nav, project header, task card, board view, status chip, role badge, risk badge, banner, empty state, confirm dialog, progress bar, icons) are their own boards in a column at the left, so an edit applies on every screen. Role variants, dialogs and states live in three columns to the right of the screens.

### C~11 — No left navigation: the top-bar project switcher gains "All projects", and pages use the full width

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen): the left bar held too little
- **Supersedes:** `ui.md` §2 left navigation and §3 left-nav table (rewritten as the switcher table); the 1200 px content cap; the icon-only nav at 1024 px.
- **Why:** the left bar had one or two items. **All projects** in the switcher opens Projects (PM), Overview (Dev Lead) or My work (Developer), so no screen needs a side column and every page can use the full width.
- **Canvas:** `Side` component removed; `Top` carries the switcher; board "Project switcher open (Dev Lead)" shows the menu.

### C~12 — Plan tab moves before Checkpoints; PM gets its own Backlog and Checkpoints boards

- **Date:** 2026-11-01
- **Who asked:** operator (Xiao-Congchen)
- **Supersedes:** the tab order in `ui.md` §3 (Plan was after Sprints). Order is now Overview, Board, Backlog, Plan, Checkpoints, Sprints, Health, Standups or My standup, Members, Settings.
- **Why:** planning leads into the backlog and checkpoints, so Plan belongs next to them. The PM row of the canvas lacked Backlog and Checkpoints boards (the Checkpoints board in the Dev Lead row was drawn with the PM tabs); both now exist for each role.

### C~13 — All source code lives under `src/`; the web app is `src/fe`, not `apps/web`

- **Date:** 2026-11-02
- **Who asked:** operator (Xiao-Congchen): "it is a project requirement that all source code be under a dedicated src folder", answering the keep-or-reverse question on the `apps/web` layout.
- **Supersedes:** the path `apps/web` in AD-01a/AD-01b, guardrail AD-01b, architecture §3 and `decision-log.md` (Vercel project root `apps/web`). The rules stay: the UI never imports Prisma or `packages/db`, and all data access goes through the contracts client.
- **Why:** the course requires source under a dedicated `src/` folder. The W10 prototype is built in place at `src/fe` (Next.js 15, SD13), so linking the backend later means swapping the data-layer adapter, not moving code. The rest of the monorepo (`apps/api`, `packages/*`) is for W1 to place under `src/` as well.
- **Rejected:** `apps/web` (keeps the layout, breaks the requirement); `src/fe/mockup` (a throwaway app that has to be ported when the backend lands).
- **Handover:** tell the W1 owner (Dev Lead) to amend AD-01a/b, the AD-01b guardrail and import test, the Vercel root, and the monorepo layout to `src/`. Not done by this branch.

---

## 8. Deviations

### D~1 — The prototype reuses the canvas CSS and markup instead of Tailwind and shadcn/ui

- **Planned:** SD13 and plan T9a/T9c: Tailwind theme variables, shadcn/ui, components rewritten per screen.
- **Built:** the 73 canvas pages were converted mechanically to React (`src/fe/components/canvas/*.tsx`, from `ui.css` copied to `app/canvas.css`), so the result matches the canvas exactly and every canvas control and link carries over. Tailwind and shadcn are not installed.
- **Why:** rewriting 73 pages by hand would diverge from the confirmed canvas and cost far more for the same look. The tokens are still CSS variables.
- **Still open:** screens not listed in the Changes line above (overviews, backlog rows, plan, usage, my work, projects list, new sprint form, add task and epic forms) still hold sample data inline. Plan epic controls act on the page only (plan proposals belong to W7). Role variants are separate components picked by role (`lib/screens.ts`).

