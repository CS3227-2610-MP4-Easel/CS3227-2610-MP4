# Branch State — w5-core-planning

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w5-core-planning (managed worktree, checked out at `faa1c08`)
- **Base:** faa1c088b2efe7231bc751f9739a90e42e1d793b
- **Owner:** operator / Codex
- **Status:** In review
- **Approved:** Gate 1 spec (operator, 2026-11-08); Gate 2 plan (operator, 2026-11-08)
- **Last updated:** 2026-11-08 by Codex — focused T6 branch-review repairs verified; awaiting Gate 3

**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations

---

**Scope.** W5 Core planning: the `core` domain package, membership and resource-resolution seams, and Tier 1 planning endpoints. The implementation and its contained review repairs are ready for branch review.

---

## 1. How to Resume

**Setup**

```bash
cd /Users/trevortan/.codex/worktrees/w5-core-planning/CS3227-2610-MP4
```

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — |

**Remaining**

- [ ] Obtain Gate 3 branch-review approval before merging W5 to `development`.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W5 | Core planning (projects to tasks) | In review | [spec](../../specs/2026-11-07-w5-core-planning-design.md) | [plan](../../plans/2026-11-08-w5-core-planning/plan.md) | T1–T6 complete; Gate 3 pending | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-08 | Completed focused branch-review repairs: conditional task version writes, live epic/project points, and exact core-source rendering, ordering and standup windows; added regression coverage | W5 | T6 |
| 2026-11-08 | Completed T1: `@agile/core` membership/writability and fail-closed resolver seams; D~1 corrections approved by operator | W5 | 8e36378 |
| 2026-11-08 | Operator approved the two contained T1 resolver corrections after the review-round limit | W5 | D~1 |
| 2026-11-08 | T1's second full-review round still found two resolver defects; execution paused at the review-round limit | W5 | D~1 |
| 2026-11-08 | Operator approved the W5 six-task implementation plan at Gate 2; execution may begin with T1 | W5 | plan |
| 2026-11-08 | Drafted and linted the W5 six-task implementation plan; review round 1 found route injection, auth lookup, frozen resolver-kind, and post-parse ADDER blockers; all were revised and review round 2 found no blockers | W5 | working tree |
| 2026-11-08 | Operator approved the W5 spec at Gate 1; branch `w5-core-planning` was created from `faa1c08` | W5 | working tree |
| 2026-11-08 | Operator renamed the intended branch from `codex/w5-core-planning` to `w5-core-planning`; branch creation was initially blocked by shared read-only `.git` metadata | W5 | working tree |
| 2026-11-07 | Started W5 on a managed worktree from `development` tip `faa1c08`; local branch creation is blocked by shared read-only `.git` metadata | W5 | working tree |
| 2026-11-07 | Drafted and linted the W5 High-tier spec; Implementer, Tester, Attacker, and Maintainer reviews ran for two rounds and blocking findings were fixed, including archive probing, apply transactions, resolver seams, task events, and source serialization | W5 | working tree |

---

## 4. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | 2026-11-07 | W5 uses one `core` package for project, membership, planning-domain, and resolver behavior; `src/be/api` only composes routes and dependencies | Codex recommendation accepted by operator's “Proceed”; preserves table ownership and the frozen `Core` seam | W5 spec SD1 |

## Deviations

| ID | Date | What / consequence | Action needed |
|---|---|---|---|
| D~1 | 2026-11-08 | T1 review round 2 still found `PROJECT_MEMBER_ADD` mapped as `PROJECT` instead of frozen `MEMBERSHIP`, and PROJECT_LIST did not filter archived projects. Both violate the approved T1 contract. | Operator approved contained corrections on 2026-11-08; corrective pass in progress. |

