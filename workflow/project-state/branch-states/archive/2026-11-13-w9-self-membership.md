# Branch State — w9-self-membership

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w9-self-membership (from `INT` at `d452926`)
- **Base:** d452926
- **Owner:** ludannnn (Developer member)
- **Status:** Folded
- **Approved:** ludannnn 2026-11-13
- **Last updated:** 2026-11-13 by Claude Opus 5.5 — integration-test fixes; Gate 3 approved

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** Small, tests only: settle the STATE Upcoming row "W9 SELF membership check" (handed over from w1) by checking endpoint 52 and adding a route-level test, and do the "W9 integration test follow-ups" row.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [x] Gate 3: approved by ludannnn on 2026-11-13 ("ok", covering the route test and the test-only integration fixes).
- [x] Push and open the PR into `development` (PR #38, merged 2026-11-13).
- [x] Applied at fold: removed STATE Upcoming "W9 integration test follow-ups" (done on this branch).
- [x] Applied at fold: replaced STATE Upcoming "W9 SELF membership check" with: endpoint 52 is covered (its `DEV_STANDUP_MINE_READ` resolver calls `requireMember` before setting `ownerId`, so a removed Developer gets 404; route test in `src/be/api/test/dev-routes.test.ts`). When W16 builds 53 and 54 (`SELF` on a standup id), their resolvers must check the caller's current membership of the standup's project the same way, not only that they own the row.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W9 | Developer upload, summaries, standup | Done | [spec](../../specs/2026-11-08-w9-dev-slice-design.md) (approved 2026-11-08, amended 2026-11-09) | [plan](../../plans/2026-11-09-w9-dev-slice/plan.md) (approved 2026-11-09) | PR #29 merged 2026-11-13; S20/S18 wiring in W19; SELF membership for 52 verified (PR #38); guide confirmed 2026-11-13 | Documented 2026-11-13 |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-13 | W9 integration-test follow-ups (Upcoming row "W9 integration test follow-ups"): the E47 lock tests poll `pg_stat_activity` for a lock wait instead of sleeping 300 ms, and on failure wait for the write and the archive to settle before cleanup. Tests only. Checks: `dev-integration.test.ts` 19/19 on Postgres (0 skipped) on three runs; typecheck green | W9 | this commit |
| 2026-11-13 | Verified the Upcoming "W9 SELF membership check": endpoint 52's resolver already requires current membership (removed Developer → 404). Added a route test with a non-member Developer; it fails when the `requireMember` call is removed from the resolver. 53/54 are W16's (handover). Checks: `dev-routes.test.ts` 27/27 | W9 | `d68c62c` |


## Fold record
Folded 2026-11-13 by Claude Opus 5.5 (with `ws fold`) on `sync/w9-wiring-folds` · merge commit `f045614` · base `d452926`

At fold, with ludannnn's yes: the W9 row carried its spec and plan links; both handovers applied by hand (Upcoming "W9 SELF membership check" replaced by the W16 note, "W9 integration test follow-ups" removed).

Sessions discarded at fold: none

| Provisional | Permanent |
|---|---|

