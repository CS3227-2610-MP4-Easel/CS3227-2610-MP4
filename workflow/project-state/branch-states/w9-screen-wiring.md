# Branch State — w9-screen-wiring

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w9-screen-wiring (from `INT` at `2c5dd9f`)
- **Base:** 465c8fe
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-13 by Claude Opus 5.5 — T4 done; T5 close-out next

**Untouched:** Architecture, Conventions

---

**Scope.** Wire S20 (Upload and standup) and S18 (Team standups) to the live W9 endpoints in `firebase` auth mode, keeping the prototype mock. This is the C~1 follow-up from `w9-dev-slice` (PR #29). Medium: the spec is also the plan.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-13 | Claude Opus 5.5 | W~1 | Paused | T4 done; T5 next | T5 close-out: merge `development`, fe typecheck and `vitest`, root `npm test`, one Implementer review of the branch, then Gate 3 and a PR into `development` | 2026-11-13 |

**Remaining**

- [x] Gate 1: spec approved by ludannnn on 2026-11-12 ("yes"), including SD2-SD4.
- [x] T0: merged `development` at `465c8fe` (W9 PR #29) on 2026-11-13.
- [ ] T1-T5 per the spec's task list.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W~1 | W9 screen wiring (S20, S18) | Spec'd | [spec](../../specs/2026-11-12-w9-screen-wiring-design.md) (approved 2026-11-12) | in the spec (Medium) | T0-T4 done; T5 close-out next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-12 | Branch created from `development`; S20/S18 wiring spec drafted (Medium, 18 edge cases, 6 tasks); Implementer review round 1: 3 blocking, 10 should-fix, 4 nits, all applied. Spec is 12 KB against the ~4 KB Medium target (logged with `ws feedback`); approved at Gate 1 by ludannnn | W~1 | `4fdb179` |
| 2026-11-13 | T4 done: `LiveTeamStandups` (`src/fe/components/live/team-standups-live.tsx`): members from 9 (once) and standups from 55 per day; For today (default), For the next standup and Earlier (a dropdown of the 7 calendar days before today, dates only); developer filter in the browser; one card per DEVELOPER member by name, matched on `developerId`, "not generated" otherwise; badges Edited, degraded, flagged (none for ACCEPTED); no-developers line; 404 shows the not-found text, other errors a toast. `canvas/Standups.tsx` renders it in `firebase` mode; `StandupsEarlier` stays mock-only. Tests: `team-standups-live.test.tsx` (E1, E12-E15, day options, filter, badges, 404). Checks: typecheck green; fe 187/187 | W~1 | this commit |
| 2026-11-13 | T3 done: the standup panel in `LiveStandupScreen`: next-standup and today tabs (computed once on mount), 52 on load and switch with stale responses dropped, Generate/Regenerate via 51 with the selected date, badges (Edited, degraded, flagged), the accepted banner, the cached note, Copy; 429 holds Regenerate for the wait, 422 and 503 `AI_DISABLED` show their messages, 409 turns the controls off and keeps Copy. Edit, Use as is and thumbs are absent (C~2). `canvas.css` gains `.seg button` so the tabs can be real buttons. Tests: E9-E11, E14, E15, E17, E18 and the error cases in `standup-live.test.tsx`. Checks: typecheck green; fe 176/176 | W~1 | `921683b` |
| 2026-11-13 | T2 done: `LiveStandupScreen` (`src/fe/components/live/standup-live.tsx`) with the upload panel (file checks, one call to 49, result strip, rejections) and the summaries panel (sequential batches of 10, AI_BUSY countdown and resend, RATE_LIMITED stop, Retry failed); 404 shows the not-found text, 409 the archived banner with controls off. `canvas/Standup.tsx` renders it in `firebase` mode. Files are read with `FileReader` (jsdom lacks `Blob.text()`). Deviation D~1. Tests: `standup-live.test.tsx` (E1, E3-E7, E14, E17, 404, RATE_LIMITED). Checks: typecheck green; fe 165/165 | W~1 | `6dfcd17` |
| 2026-11-13 | T1 done: `src/fe/lib/api/dev.ts` (endpoints 9, 49-52, 55; `useProjectId`/`projectIdFrom`; `todaySgt`, `nextStandupDate`), exported as `live`; `AuthModeCtx` exported; `LiveTestProvider`; the example file is now valid `ActivityItemInput` (it used `kind/text/at`, which the server rejects). Tests: `dev-api.test.ts` (E1, E2, E8, E16, paths and bodies). Checks: typecheck green; fe 155/155 | W~1 | `f36cbe0` |
| 2026-11-13 | T0: merged `development` at `465c8fe` (W9, W7 backend, W8, PR #34); only `skill-feedback.md` conflicted (kept both rows) | W~1 | merge commit |

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

## 8. Deviations

> Legend: `D` = Deviation, where reality diverged from a spec or plan. Not to be confused with AD-nn, an Architecture Decision.

### D~1 A JSON file with no `items` list gets its own message
- **Date:** 2026-11-13 · **Found by:** T2 implementer
- **What diverged:** the spec's Upload behaviour lists three messages (not JSON, over 1 MB, over 100 items) but none for valid JSON without an `items` array; the panel shows "That file has no items list." and sends nothing.
- **Impact:** one extra message; nothing is sent, as the spec requires.
