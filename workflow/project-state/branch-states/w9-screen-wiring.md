# Branch State — w9-screen-wiring

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w9-screen-wiring (from `INT` at `2c5dd9f`)
- **Base:** 2c5dd9f
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-12 by Claude Opus 5.5 — spec approved, T1 next

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** Wire S20 (Upload and standup) and S18 (Team standups) to the live W9 endpoints in `firebase` auth mode, keeping the prototype mock. This is the C~1 follow-up from `w9-dev-slice` (PR #29). Medium: the spec is also the plan.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-12 | Claude Opus 5.5 | W~1 | Paused | Spec approved; T1 next | T1: `src/fe/lib/api/dev.ts`, `useProjectId`, date helpers, example file, `AuthModeCtx` export, `LiveTestProvider`; done when `src/fe/test/dev-api.test.ts` (E1, E2, E8, E16) passes | 2026-11-12 |

**Remaining**

- [x] Gate 1: spec approved by ludannnn on 2026-11-12 ("yes"), including SD2-SD4.
- [ ] T0: merge `development` after PR #29 (W9) merges; the code tasks need the W9 endpoints.
- [ ] T1-T5 per the spec's task list.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W~1 | W9 screen wiring (S20, S18) | Spec'd | [spec](../../specs/2026-11-12-w9-screen-wiring-design.md) (approved 2026-11-12) | in the spec (Medium) | Spec approved; T1 next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-12 | Branch created from `development`; S20/S18 wiring spec drafted (Medium, 18 edge cases, 6 tasks); Implementer review round 1: 3 blocking, 10 should-fix, 4 nits, all applied. Spec is 12 KB against the ~4 KB Medium target (logged with `ws feedback`); approved at Gate 1 by ludannnn | W~1 | `4fdb179` |

---

## 6. Known Gaps

- **Live S20/S18 are reached by URL only** — the project list and other W5 screens still read the mock, so a signed-in user opens `/projects/<uuid>/standup` or `/standups` directly until the W5 screens are wired.
- **S20's summary list is lost on reload** — no endpoint lists a developer's earlier uploads (W10 Q6); the stored summaries are still used by the standup.

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 Wire the W9 endpoints only; the project screens stay mock
- **Date:** 2026-11-12 · **Asked by:** ludannnn (operator), choosing "Wire W9 only"
- **Decision:** S20 and S18 call endpoints 9, 49-52 and 55 for the project id in the URL; the project list and other W5 screens are not wired here.
- **Why:** the work can start before W9 merges and stays inside the Developer's area.
- **Rejected:** also wiring the project list (the Dev Lead's area, larger spec); waiting for the W5 screens.

### C~2 Hide Edit, Use as is and thumbs in live mode until W16
- **Date:** 2026-11-12 · **Asked by:** ludannnn (operator)
- **Decision:** live S20 shows Regenerate and Copy only; W16 adds endpoints 53 and 54 and their controls.
- **Why:** those endpoints are not built; mocked buttons would claim a save that never happened.
- **Rejected:** keeping them on the in-browser mock.
