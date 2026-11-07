# Branch State — w7-implement-pm-plan-flow

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7-implement-pm-plan-flow (from `INT` at `7caa23d`)
- **Base:** faa1c08
- **Owner:** Xiao-Congchen (PM)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-07 by Claude Sonnet 5.5 — W7 spec drafted, lint clean, one review round folded; awaiting Gate 1

**Untouched:** Architecture, Conventions, Known Gaps, Deviations (the spec lists the entries to write at the fold: a Known Gap for keyword retrieval, a Deviation for archived-project 404, and pm/core architecture Now blocks once code exists)

---

**Scope.** W7 PM plan flow (proposals, pm): the PM's AI feature that turns a brief into a plan proposal, behind the gateway. Per STATE.md §3 it builds after W2, W3, W5 and W6. W2, W3 and W6 are Done on `INT` (folded 2026-11-07, `faa1c08`); **W5 (Dev Lead's core planning, which owns `requireMember`) is Not started** and gates W7's build, though not its spec. Feature freeze is end of 10 Nov (AD-69). The older `w7-pm-plan-flow` branch carried the experiment framework (W~1, merged as PR #19) and never started W7 itself.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-07 | Claude Sonnet 5.5 | W7 | Active | Spec written and reviewed (Implementer, Tester, Maintainer, Attacker); lint clean | Plan approved (Gate 2, 2026-11-07). Execute `workflow/plans/2026-11-07-w7-pm-plan-flow/plan.md` with `executing-plans-lite-v2`, starting with wave 1 (T1, T2, T3); T1 has a `GATE:` step for the Developer's agreement to the `Sessions` change | 2026-11-07 |

**Remaining**

- [x] W7 spec approved at Gate 1 (2026-11-07).
- [x] W7 plan approved at Gate 2 (2026-11-07): 11 tasks, 6 waves, all reviewed full.
- [ ] Build (T1-T11); branch review, Gate 3.
- [ ] **Handover W2 owner (Developer):** spec SD3 changes `Sessions.assertUsable` (a `PM_PLAN_OUTLINE` session also admits `PM_PLAN_EXPAND`) and amends contracts §5.3; their agreement is recorded in T1 (AD-11, as C59); not yet obtained.
- [ ] **Handover W5 owner (Dev Lead):** W7 creates `src/be/core` with only `applyPlan`, `PlanInputSchema`, `countPlan`; W5 merges its exports; W5 locks the project row (`update` of `updated_at`) before epic inserts, adds `Core.assertWritable`, registers `proposalResolvers`, and its project resolver reads path parameter `id` for endpoint 34.
- [ ] Ask W5's owner (Dev Lead) for a delivery estimate (already open in STATE.md Upcoming); W7's build and its membership checks need W5's `requireMember`. Before then, build against the frozen contracts and the W6 testing seams.
- [ ] Carry STATE.md Upcoming items addressed to W7 into the spec: W6 sources and `assembleWith` (`pm.similarItems`, titles only, at most 5, filtered by member projects); W3 section rules, blocked-input handling (`BLOCKED_INPUT` to 422 `VALIDATION_FAILED`, `REQUEST_REFUSED` to 422) and output schemas without URLs or angle brackets; W2 mock responses, static sections and `assertStaticSectionsFit`; W7 proposal resolvers.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W7 | PM plan flow (proposals, pm) | Planned | [spec](../../specs/2026-11-07-w7-pm-plan-flow-design.md) | [plan](../../plans/2026-11-07-w7-pm-plan-flow/plan.md) | Plan approved; T1-T3 (wave 1) next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-07 | Branch created from `development` at `7caa23d`; branch state written | W7 | this commit |
| 2026-11-07 | Fast-forwarded to `INT` `faa1c08` (PR #21 folded W2, W3, W4, W6, W12 into `STATE.md`); no overlap, Base moved; dependency status recorded (W5 still Not started) | W7 | this commit |
| 2026-11-07 | W7 spec written (Big, High tier; 56 edge cases, 12 threats) and reviewed by Implementer, Tester, Maintainer and Attacker lenses; findings folded; lint clean | W7 | this commit |
| 2026-11-07 | W7 spec approved by the operator at Gate 1; `lint.mjs spec --approved` passes | W7 | this commit |
| 2026-11-07 | W7 plan written (11 tasks, 6 waves), reviewed by an Implementer-lens reviewer, approved at Gate 2; `lint.mjs plan --approved` passes | W7 | this commit |

---

## 4. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — W7 scope: backend only, W7 builds `applyPlan`, one session per plan

- **Date:** 2026-11-07.
- **Who asked:** the operator (PM), answering three questions while the W7 spec was written.
- **Decision:** (1) W7 covers endpoints 34, 35, 37, 40, 41 in the backend only; the New Plan screen is wired later. (2) W7 builds `applyPlan`, `PlanInputSchema` and `countPlan` in a new `src/be/core`; W5 builds the rest of core. (3) A plan keeps one session: W2 maps `PM_PLAN_EXPAND` to the `PM_PLAN_OUTLINE` session feature.
- **Why:** slicing lists `core` as a W7 area and approve must be testable end to end; the architecture says one session per plan. Rejected: the screen in W7; waiting for W5 with a fake; a second `PM_PLAN_EXPAND` session per plan (two sessions per plan, 10 plans a day).
- **Follow-up:** the Developer (W2 owner) signs off on the `Sessions` change before Gate 2 (AD-11).

### C~2 — Similar-item retrieval by keyword match

- **Date:** 2026-11-07.
- **Who asked:** the AI proposed it; the operator asked what retrieval is for and about pros and cons, then approved the spec including it at Gate 1.
- **Decision (spec SD5):** keyword match (A) rather than Postgres full-text through a new `@agile/db` function (B). The filtered client has no raw SQL and typed SQL is disabled. Contracts §5.3 and AD-28's wording would be amended, and a Known Gap recorded at the fold.
- **Why:** no new SQL surface or migration before the 10 Nov freeze. Rejected: B; Prisma `fullTextSearch` preview.
- **Status:** confirmed at Gate 1.
