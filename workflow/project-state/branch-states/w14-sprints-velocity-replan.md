# Branch State — w14-sprints-velocity-replan

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w14-sprints-velocity-replan (from W8 at `6db7a0021c75c83fe89739961a9bdfac3f6607d9`)
- **Base:** 2c5dd9f0b1c8f23610af5b6638818110f3bc5b02
- **Owner:** operator / repository owner
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-13 by Codex — T2/T3 accepted after final review; T4 dispatched

**Untouched:** Architecture, Conventions, Known Gaps, Deviations

---

**Scope.** W14 Sprints, velocity and re-plan: endpoints 27–32 and 46–48, building on the W8 Dev Lead facts/digest branch and its W5 base.

---

## 1. How to Resume

**Setup**

```bash
cd /Users/trevortan/.codex/worktrees/w14-sprints-velocity-replan/CS3227-2610-MP4
```

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-12 | Codex | W14 | Active | Orchestrating T4 lead digest persistence through ProposalService | Validate T4 handover and review its atomic transaction integration | 2026-11-13 |

Session status: `Active` · `Paused` · `Blocked — needs human`.

**Remaining**

- [x] Draft, review and obtain Gate 1 approval for the W14 design spec.
- [x] Produce and review the implementation plan after spec approval.
- [x] **Q~1:** Resolved by C~1: reverse C20 narrowly for W14 endpoint 27 and add bounded pagination.
- [x] **Q~2:** Keep the existing 0–100 progress contract used by W8 and `ProgressSchema` (C~2).
- [x] **Q~3:** Add a transaction-aware gateway session-close seam (C~3).
- [x] **Q~4:** Restrict endpoint 48 rejection to the proposal session owner (C~4).
- [x] **Q~5:** Move `ai_proposals` validation/status access out of `Core.applyReplan` into `proposals` (C~5).
- [x] **Q~6:** Use project-first, proposal-second lock ordering and validate current suggestion state rather than claim snapshot-version detection (C~6).
- [x] **Q~7:** Persist approved suggestion IDs in the existing proposal JSON payload for idempotent replay, and define the exact transaction-aware session gateway (C~7).
- [x] **Q~8:** Add explicit proposal creation/supersession, session binding, carry-over/page bounds, and exact conflict details to make the W8-to-W14 seam implementable (C~8).

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W14 | Sprints, velocity and re-plan | Building | [spec](../../specs/2026-11-12-w14-sprints-velocity-replan-design.md) | [plan](../../plans/2026-11-12-w14-sprints-velocity-replan/plan.md) | T4 in progress: atomic lead digest persistence | — |

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-12 | Created isolated W14 worktree and branch from W8 tip `6db7a00`; verified W5 base is present | W14 | this commit |
| 2026-11-12 | Operator approved the architecture-aligned split: `core` owns sprint/progress/velocity and `lead` owns forecast/re-plan | W14 | this commit |
| 2026-11-12 | Operator approved C~1: reverse C20 narrowly for W14 endpoint 27 and add bounded pagination | W14 | this commit |
| 2026-11-12 | Merged `origin/development` at `2c5dd9f`, including W8 PR #28, with no conflicts | W14 | merge commit |
| 2026-11-12 | Amended W14 after review: endpoint-27 pagination, proposal service ownership, shared locks, session closure, exact errors and zero-velocity behavior | W14 | this commit |
| 2026-11-12 | Final review found blockers: existing 0–100 progress behavior, proposal-table access in `Core.applyReplan`, and unresolved session/authorization atomicity | W14 | this commit |
| 2026-11-12 | Second review pass required persisted approval replay, explicit proposal creation/supersession, exact session binding, bounded carry-over/page inputs, and conflict details; spec amended accordingly | W14 | this commit |
| 2026-11-12 | Gate 1 approved by operator; six-task W14 plan created, linted with 0 errors/0 warnings, and revised after plan review | W14 | this commit |
| 2026-11-13 | Merged Gate 3-approved `dev-lead-pages-wiring` at `d5f3fda`; W14 plan must reuse its proposals, API composition, and frontend client seams | W14 | merge commit `fe8af2e` |
| 2026-11-13 | Amended W14 tasks T3–T6 to reuse merged proposals/API/frontend seams; plan lint remains 0 errors/0 warnings | W14 | this commit |
| 2026-11-13 | Current-state review corrected transaction-session injection, lead atomic persistence order, API service composition, route factory names, and distinct live frontend helper/type contracts; plan lint remains 0 errors/0 warnings | W14 | this commit |
| 2026-11-13 | Reviewed merged W7 UI scope: PM plan flow/history plus shared backlog/project wiring; W7 did not own Dev Lead health or W14 sprint/re-plan pages | W14 | this commit |
| 2026-11-13 | Audited role wiring: board/backlog and member/checkpoint data have live seams, but PM/Developer overview and sprint screens still use fixture paths; W14 remains the owner of live sprint/re-plan wiring | W14 | this commit |
| 2026-11-13 | Operator approved the six-task W14 implementation plan at Gate 2; execution begins with T1 | W14 | this commit |
| 2026-11-13 | T1 completed shared W14 contracts; T2 and T3 started after T1 handover | W14 | commits `4bea8a2`, `29e8dea` |
| 2026-11-13 | Tester review of diff `416b4fb..HEAD` found T2/T3 assigned edge cases without corresponding race, rollback, authorization and lifecycle tests; no source or test edits made | W14 | review |
| 2026-11-13 | Added focused T2 rollback/race/lifecycle/close-validation/pagination/progress tests and made planned-sprint deletion clear assigned tasks atomically | W14 | T2 review follow-up |
| 2026-11-13 | Replaced serialized E4 coverage with a barrier-controlled race and added direct E21, velocity ordering, progress, and 1000-item bound assertions | W14 | T2 second-review follow-up |
| 2026-11-13 | Final T2 review requested true zero-progress/unestimated, newest-three/deleted velocity, and no-mutation overlap assertions; follow-up in progress | W14 | T2 final-review follow-up |
| 2026-11-13 | Added all-unestimated zero-progress, real newest-three/deleted velocity, and overlap no-mutation assertions; focused tests, typecheck and diff check pass | W14 | commit `d09dd4d`, handover T2 |
| 2026-11-13 | T2 and T3 final reviews accepted after substantive race, rollback, conflict, tenancy and session-adapter coverage; T4 started | W14 | review action |
| 2026-11-13 | Started attacker review of final T2/T3 transaction, lock, authorization, replay, bounds and tenancy behavior; review is read-only for source and task files | W14 | review |

## 4. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | 2026-11-12 | Reverse C20 narrowly for W14 endpoint 27: add standard bounded pagination rather than preserve the unpaginated sprint list. | Operator chose this after review identified unbounded read/response work; all other existing contracts remain governed by C20. | W14 spec Gate 1 preparation |
| C~2 | 2026-11-12 | Preserve progress as 0–100 percentage points. | Operator accepted the existing `ProgressSchema`, `core` implementation and W8 consumers; changing to a ratio would require a project-wide contract migration. | W14 spec review |
| C~3 | 2026-11-12 | Add an internal transaction-aware session-close seam for proposal approval/rejection. | Operator chose atomic proposal/domain/session outcomes over post-commit retry divergence. | W14 spec review |
| C~4 | 2026-11-12 | Restrict W14 proposal rejection to the proposal session owner. | Preserves the existing `Sessions.close` authorization model; expanding it to every project Dev Lead would widen permissions. | W14 spec review |
| C~5 | 2026-11-12 | Refactor `Core.applyReplan` to mutate only core domain tables; `proposals` owns `ai_proposals` lifecycle and validation. | Preserves architecture table ownership and prevents core from reading proposal tables. | W14 spec review |
| C~6 | 2026-11-12 | Serialize REPLAN operations project-first then proposal-second, and validate current target state without claiming historical snapshot-version detection. | Prevents lock inversion/deadlock; the frozen suggestion schema has no expected-version token. | W14 spec review |
| C~7 | 2026-11-12 | Persist immutable `appliedSuggestionIds` in the existing proposal JSON payload and define an exact transaction-aware session-close gateway. | Needed for idempotent approved replay and atomic proposal/domain/session outcomes without a new table or Prisma column; post-commit close was rejected. | W14 second review |
| C~8 | 2026-11-12 | Make proposal creation/supersession, session binding, source-task equality, page/carry-over limits and conflict details explicit. | Removes implementation discretion at the W8-to-W14 boundary and bounds untrusted request work. | W14 second review |
