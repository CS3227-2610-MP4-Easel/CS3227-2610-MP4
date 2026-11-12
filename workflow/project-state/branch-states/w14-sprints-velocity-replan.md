# Branch State — w14-sprints-velocity-replan

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w14-sprints-velocity-replan (from W8 at `6db7a0021c75c83fe89739961a9bdfac3f6607d9`)
- **Base:** 2c5dd9f0b1c8f23610af5b6638818110f3bc5b02
- **Owner:** operator / repository owner
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-13 by Codex — completed backlog sprint, refresh and filter fixes

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
| S1 | 2026-11-12 | Codex | W14 | Active | Backlog sprint display, sidebar refresh and controls | Await owner review of the backlog follow-up commit | 2026-11-13 |

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
| W14 | Sprints, velocity and re-plan | Building | [spec](../../specs/2026-11-12-w14-sprints-velocity-replan-design.md) | [plan](../../plans/2026-11-12-w14-sprints-velocity-replan/plan.md) | T6 complete; close-out checks next | — |

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
| 2026-11-13 | T4 accepted after handover lint, typecheck and diff verification; T5 started for API routes and composition | W14 | commit `25e3521` |
| 2026-11-13 | Started attacker review of final T2/T3 transaction, lock, authorization, replay, bounds and tenancy behavior; review is read-only for source and task files | W14 | review |
| 2026-11-13 | Started read-only attacker review of T4 for proposal-table access, transaction boundary leaks, session ownership and lock order | W14 | review |
| 2026-11-13 | T4 attacker review found public session closes outside the transaction on degraded and rollback paths, cache-order risk for late ProposalService injection, and no real E27 race test; direct lead proposal-table access was removed | W14 | review; fix before acceptance |
| 2026-11-13 | T4 tester review found E25 covered, but E27 race/rollback coverage is absent and session cleanup remains outside the transaction; no source, test or task files edited | W14 | review |
| 2026-11-13 | T5 registered endpoints 27–33 and 46–48, composed SprintService/ProposalService with lead runtime, extended scoped resolvers, and added route/security/OpenAPI tests | W14 | commit `f2d52a8`; handover `T5.json` |
| 2026-11-13 | Fixed T4 review blockers: degraded sessions close through the transaction client, failed persistence no longer mutates sessions after rollback, cached lead runtimes accept late ProposalService wiring safely, and rollback/E27 barrier coverage now tracks digest/proposal/session state | W14 | commit `745e889`; handover `T4.json` |
| 2026-11-13 | Tightened E27 race fixture to model both admitted sessions and assert the losing transaction leaves session outcomes unchanged | W14 | T4 test follow-up |
| 2026-11-13 | Read-only attacker review of T5 commit f2d52a8 found route contract and observability blockers; no source or test files edited | W14 | review |
| 2026-11-13 | T5 implementer review passed composition, route registration, typecheck and current OpenAPI tests but found spec-contract gaps in proposal filtering, mutation bounds, proposal responses and endpoint-48 error status; no source edits made | W14 | review; lesson L~1 |
| 2026-11-13 | Applied T5 contract and security fixes: proposal status filtering, non-empty approval, optimistic PATCH/delete bounds, session outcomes, member-gated rejection, mutation audit records, deleted-sprint resolution and composition-root-only source-scan exemption; full test suite passes | W14 | working tree; final review |
| 2026-11-13 | Completed T6 live frontend sprint/progress/proposal clients, strict request-body serialization, paged response types and typed suggestion-ID error details; fixture W10 helpers remain unchanged | W14 | commit `002528e`; handover `T6.json` |
| 2026-11-13 | Operator reported the Sprints page still displayed fixture data; added a shared live Sprints loader for UUID project routes, live velocity, paged sprint rows and versioned start/delete actions without fixture task rows | W14 | T6 consumer correction |
| 2026-11-13 | T6 consumer correction verified with frontend typecheck, 234 frontend tests and diff check; live start/delete refresh the server-backed page | W14 | T6 close-out |
| 2026-11-13 | Operator requested the close-sprint modal be live too; started wiring active-sprint/task reads, carry-over choices and endpoint-31 submission for live project routes | W14 | T6 follow-up |
| 2026-11-13 | Completed live close modal, sprint edit form and live task sprint filtering; endpoint 31 carries unfinished tasks to Backlog or another planned sprint, endpoint 29 uses the current sprint version, and endpoint 32 remains versioned | W14 | T6 follow-up |
| 2026-11-13 | Verified sprint action follow-up with frontend typecheck, 234 frontend tests and diff check | W14 | T6 close-out |
| 2026-11-13 | Checked the live close button: it submits endpoint 31 with sprint version and carry-over choices; corrected the pre-load state so the disabled button says “Loading active sprint…” instead of implying no active sprint | W14 | T6 button check |
| 2026-11-13 | Re-verified with frontend typecheck, 234 frontend tests and diff check | W14 | T6 button check |
| 2026-11-13 | Reproduced the live close-modal error: task loading used endpoint-20 size 1000, exceeding the API bound and producing 422 `VALIDATION_FAILED`; reduced the request to size 100 and verified the live modal now shows three unfinished tasks and an enabled close button | W14 | T6 live-site verification |
| 2026-11-13 | Re-verified with live browser UI, frontend typecheck, 234 frontend tests and diff check; close action was intentionally not submitted | W14 | T6 live-site verification |
| 2026-11-13 | Operator reported missing sprint tasks, static chevrons and unstyled live statuses; added per-sprint live task reads, real expand/collapse controls, live task links and StatusChip mapping for TODO, IN_PROGRESS, IN_REVIEW and DONE | W14 | T6 UI follow-up |
| 2026-11-13 | Verified live browser rendering: active sprint expanded with three task rows and styled chips; closed sprints collapsed and expandable; typecheck, 234 frontend tests and diff check pass | W14 | T6 UI follow-up |
| 2026-11-13 | Operator reported UUID assignees on the live backlog; loaded project members with backlog data and rendered matched display names with initials, preserving Unassigned and a safe Unknown member fallback | W14 | T6 UI follow-up |
| 2026-11-13 | Verified live browser backlog shows names instead of UUIDs; frontend typecheck, 234 frontend tests and diff check pass | W14 | T6 UI follow-up |
| 2026-11-13 | Rendered the latest digest's overload rows on initial live Health load when caller facts have no cross-project overload, preserving the approved endpoint-42 versus digest contract; added regression coverage | W14 | T6 UI follow-up |
| 2026-11-13 | Resolved live task assignee IDs through project members in the task sidebar and sprint task rows, rendering mockup-style initials and display names with Unassigned/Unknown fallbacks | W14 | T6 UI follow-up |
| 2026-11-13 | Verified live Health, Sprints and Board task sidebar in the browser; frontend typecheck, 235 frontend tests and diff check pass | W14 | T6 UI follow-up |
| 2026-11-13 | Committed the live Health, backlog, sprint-task and task-sidebar assignee fixes as `b063925` | W14 | T6 close-out |
| 2026-11-13 | Operator reported missing backlog sprint labels, stale backlog after task block/unblock, and non-functional search/filter controls; started the smallest live-backlog correction | W14 | T6 UI follow-up |
| 2026-11-13 | Added live backlog sprint lookup with `Sprint <number>` labels, functional title search and Unscheduled/Unassigned/No estimate filters, and a refresh listener for task sidebar mutations | W14 | T6 UI follow-up |
| 2026-11-13 | Removed duplicate generated backlog controls, added live regression coverage, and verified typecheck, 236 frontend tests, diff check and live browser rendering | W14 | T6 UI follow-up |

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

## Lessons

### L~1 — Review route contracts against the approved spec, not only generated schemas

- **Date:** 2026-11-12
- **Cause:** T5 tests compared routes to current schemas but omitted the spec's status filter, non-empty suggestion selection, session outcome fields, and endpoint-48 owner conflict status.
- **Rule:** Every route review must exercise optional filters, non-empty bounds, response fields, and exact error precedence.
- **Scope:** role:implementer
- **Found by:** T5 implementer review of f2d52a8
