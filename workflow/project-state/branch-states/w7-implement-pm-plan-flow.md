# Branch State — w7-implement-pm-plan-flow

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7-implement-pm-plan-flow (from `INT` at `7caa23d`)
- **Base:** faa1c08
- **Owner:** Xiao-Congchen (PM)
- **Status:** In review
- **Approved:** —
- **Last updated:** 2026-11-08 by Claude Sonnet 5.5 — W7 built (T1-T11), verified, whole-branch code review reported; awaiting Gate 3

**Untouched:** Conventions (Architecture Now blocks for pm, core and proposals are written at the fold; see Close-out)

---

**Scope.** W7 PM plan flow (proposals, pm): the PM's AI feature that turns a brief into a plan proposal, behind the gateway. Per STATE.md §3 it builds after W2, W3, W5 and W6. W2, W3 and W6 are Done on `INT` (folded 2026-11-07, `faa1c08`); **W5 (Dev Lead's core planning, which owns `requireMember`) is Not started** and gates W7's build, though not its spec. Feature freeze is end of 10 Nov (AD-69). The older `w7-pm-plan-flow` branch carried the experiment framework (W~1, merged as PR #19) and never started W7 itself.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|

**Remaining**

- [x] W7 spec approved at Gate 1 (2026-11-07).
- [x] W7 plan approved at Gate 2 (2026-11-07): 11 tasks, 6 waves, all reviewed full.
- [x] Build T1-T11 (plan close-out lint clean).
- [ ] Gate 3: the operator reviews the branch; then ask whether to push and open the PR (nothing pushed).
- [ ] **Handover W2 owner (Developer):** spec SD3 changes `Sessions.assertUsable` (a `PM_PLAN_OUTLINE` session also admits `PM_PLAN_EXPAND`) and amends contracts §5.3; their agreement is recorded in T1 (AD-11, as C59); not yet obtained.
- [ ] **Handover W5 owner (Dev Lead):** W7 creates `src/be/core` with only `applyPlan`, `PlanInputSchema`, `countPlan`; W5 merges its exports; W5 locks the project row (`update` of `updated_at`) before epic inserts, adds `Core.assertWritable`, registers `proposalResolvers`, and its project resolver reads path parameter `id` for endpoint 34.
- [ ] Ask W5's owner (Dev Lead) for a delivery estimate (already open in STATE.md Upcoming); W7's build and its membership checks need W5's `requireMember`. Before then, build against the frozen contracts and the W6 testing seams.
- [ ] Carry STATE.md Upcoming items addressed to W7 into the spec: W6 sources and `assembleWith` (`pm.similarItems`, titles only, at most 5, filtered by member projects); W3 section rules, blocked-input handling (`BLOCKED_INPUT` to 422 `VALIDATION_FAILED`, `REQUEST_REFUSED` to 422) and output schemas without URLs or angle brackets; W2 mock responses, static sections and `assertStaticSectionsFit`; W7 proposal resolvers.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W7 | PM plan flow (proposals, pm) | In review | [spec](../../specs/2026-11-07-w7-pm-plan-flow-design.md) | [plan](../../plans/2026-11-07-w7-pm-plan-flow/plan.md) | T1-T11 done; 563 tests, 559 pass, 4 unrelated agent-hook failures | out of date: pm, core, proposals |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-07 | Branch created from `development` at `7caa23d`; branch state written | W7 | this commit |
| 2026-11-07 | Fast-forwarded to `INT` `faa1c08` (PR #21 folded W2, W3, W4, W6, W12 into `STATE.md`); no overlap, Base moved; dependency status recorded (W5 still Not started) | W7 | this commit |
| 2026-11-07 | W7 spec written (Big, High tier; 56 edge cases, 12 threats) and reviewed by Implementer, Tester, Maintainer and Attacker lenses; findings folded; lint clean | W7 | this commit |
| 2026-11-07 | W7 spec approved by the operator at Gate 1; `lint.mjs spec --approved` passes | W7 | this commit |
| 2026-11-07 | Wave 1 built and reviewed (full, three lenses each): T2 scaffolded the core, proposals and pm workspaces; T3 added strict plan body schemas and made the approve response three counts; T1 added the session feature map, contract and AD-28 text. Fix rounds: tighter T3 tests, version and idea bounds; T1 closed/idle/foreign session tests and an own-keys-only map lookup. Rejected: lone-surrogate and control-character rules on the idea (the spec does not ask; the gateway sanitiser handles them); an EXPAND-session self-map test (it correctly fails). Learned: 
pm install removes the generated Prisma client, so 	sc -b fails until `prisma:generate` runs (now in the plan's Shared context) | W7 | this commit |
| 2026-11-07 | Wave 2 built: T4 `applyPlan` (12 database tests incl. a real lock barrier), T5 proposals create/view/resolvers (7 database tests), T8 `pm.similarItems` and settings, T9 output schemas, sections and mocks. Run against a local Postgres in Docker (`w7-pg`, port 5433; variables in untracked `.ws/w7.env`). Whole suite: 497 tests, 493 pass, 4 fail - all in `tests/process-security/agent-hook.test.ts` (F8 shell-write mediation, unrelated to W7; not compared with the base branch). The real database also found the session-rule regression (C~3) that skipped tests had hidden | W7 | this commit |
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

### C~3 — The session rule also admits a call of the session's own feature (spec SD3 amended)

- **Date:** 2026-11-07.
- **Who asked:** found while running W2's integration tests on a local Postgres (Docker, port 5433): sessions-integration.test.ts E26 opens a `PM_PLAN_EXPAND` session and regenerates it; the first rule from SD3 (`row.feature === (SESSION_FEATURE[feature] ?? feature)`) made that session unusable for its own feature. The operator asked for the local database; the AI amended the rule.
- **Decision:** `assertUsable` passes when `row.feature === feature` or `row.feature === SESSION_FEATURE[feature]` (own keys only). An outline session admits expand calls; an expand session still rejects outline calls (E2).
- **Why:** keeps every existing W2 behaviour and adds only the new case. Rejected: changing W2's E26 test to open an outline session (hides the regression). The earlier Tester-lens suggestion to cover the self case was wrongly rejected on 2026-11-07 and is now accepted.
- **Follow-up:** the spec hash in the plan is restamped (`112dc7d0a8c1`); T1 gets a second fix round.

### C~4 — Fewer reviews and combined dispatch for the rest of the W7 build

- **Date:** 2026-11-07.
- **Who asked:** the operator, mid-build: only run review agents for non-trivial work and combine a few tests together; the spec was already reviewed thoroughly, so reviewing and implementing every task separately is not needed.
- **Decision:** from T5 the per-task review level is lowered (T5, T6, T7, T10, T11 `light`; T8, T9 `none`). T6+T7 and T8+T9 each go to one implementer. One combined light review runs after T7 and one after T11. The whole-branch `code-review` at close-out stays. T1-T4 keep their `full` reviews.
- **Why:** the first four tasks' reviews found no blocking problem and cost about five subagent runs each; the real regression (the session rule) was found by running the tests against a real database, not by a reviewer.
- **Rejected:** keeping `full` on every task as planned; skipping the close-out review.

---

## 5. Close-out

**Built.** Endpoints 34, 35, 37, 40, 41 (`@agile/pm` routes and flow, `@agile/proposals` store and resolvers, `@agile/core` `applyPlan`, API routes, W2 session feature map, contract schemas). Verified against a local Postgres 16 in Docker (`w7-pg`, port 5433, variables in untracked `.ws/w7.env`): full suite 563 tests, 559 pass, 4 fail, 0 skipped. The 4 failures are `tests/process-security/agent-hook.test.ts` (F8 shell-write mediation); no file they depend on differs from the base commit, but they were not run on the base branch. One run also showed a gateway test (`run-integration` E25) fail once under parallel load; it passed alone three times and in two later full runs.

**Not done / not verified.** Nothing pushed. The Developer (W2 owner) has not agreed to the `Sessions` change (AD-11). The PM endpoints cannot be reached in the app until W5 registers the proposal resolvers and a project resolver (the placeholder returns 404). The whole-branch `code-review` reported 10 findings (none blocking, listed in the review output); none has been fixed.

### Known Gaps (new)

- **PM similar-item retrieval is keyword matching, not full-text search** - up to 8 keywords from the idea, `contains` on titles through the filtered client, at most 50 candidates per table in id order before ranking (spec SD5; contracts §5.2 and AD-28 amended in T1).

### Deviations (new)

- **D~1 Archived project answers 404, not 409, on endpoints 35, 37, 40, 41** - the filtered client hides every row of an archived project, so the proposal is not found (spec SD17; architecture §8 says 409).
- **D~2 The session rule changed after the first database run** - the first formula made a `PM_PLAN_EXPAND` session unusable for its own feature and broke W2's E26 test; fixed and recorded as C~3.
- **D~3 `plan-flow.ts` mirrors types and recognises `ProposalError` by name** - the W6 source scan forbids workspace imports other than contracts, ai-context and the gateway in a file that calls `run`.

### Handover (for `STATE.md` Upcoming at the fold)

- **W2 owner (Developer):** agree to the `Sessions.assertUsable` change (a session admits its own feature and the one mapped by `SESSION_FEATURE`; contracts §5.3 amended).
- **W5 owner (Dev Lead):** register `createProposalResolvers(db)` and a project resolver that reads path parameter `id` for endpoint 34; lock the project row (`update` of `updatedAt`) before epic inserts so `position` cannot race `applyPlan`; add `Core.assertWritable`; merge `src/be/core/src/index.ts` exports with W7's `applyPlan`, `PlanInputSchema`, `countPlan`.
- **W13:** `PM_SIMILAR_ITEMS` (`on`/`off`, default `on`) and the seed data that gives retrieval something to find.
- **Architecture Now blocks:** write `pm`, `core` and `proposals` area files from the built code at the fold.
