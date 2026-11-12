# Branch State — w9-self-membership

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w9-self-membership (from `INT` at `d452926`)
- **Base:** d452926
- **Owner:** ludannnn (Developer member)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-13 by Claude Opus 5.5 — SELF membership check verified for 52

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** Small: settle the STATE Upcoming row "W9 SELF membership check" (handed over from w1) by checking endpoint 52 and adding a route-level test.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [ ] Gate 3: owner review, then push and open the PR into `development`.
- [ ] **Handover:** replace STATE Upcoming "W9 SELF membership check" with: endpoint 52 is covered (its `DEV_STANDUP_MINE_READ` resolver calls `requireMember` before setting `ownerId`, so a removed Developer gets 404; route test in `src/be/api/test/dev-routes.test.ts`). When W16 builds 53 and 54 (`SELF` on a standup id), their resolvers must check the caller's current membership of the standup's project the same way, not only that they own the row.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W9 | Developer upload, summaries, standup | Done | — | — | SELF membership check verified for 52; 53/54 are W16 | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-13 | Verified the Upcoming "W9 SELF membership check": endpoint 52's resolver already requires current membership (removed Developer → 404). Added a route test with a non-member Developer; it fails when the `requireMember` call is removed from the resolver. 53/54 are W16's (handover). Checks: `dev-routes.test.ts` 27/27 | W9 | this commit |
