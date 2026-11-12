# Branch State — w7-implement-pm-plan-flow

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7-implement-pm-plan-flow (from `INT` at `7caa23d`)
- **Base:** 3519ff07
- **Owner:** Xiao-Congchen (PM)
- **Status:** Approved — work merged; fold pending
- **Approved:** Operator reports the PRs approved and merged into development
- **Last updated:** 2026-11-13 by Codex — reconciled merged W7 and W7b PRs; fold pending.

**Untouched:** Conventions (Architecture Now blocks for pm, core and proposals are written at the fold; see Close-out)

---

**Scope and fold boundary.** This record covers W7 backend plan flow (endpoints 34, 35, 37, 40, 41; PR #31, merge `487cafe`) and W7b backend plan editing (endpoints 36, 38, 39, 58–60; PR #32, merge `385cda8`). Both are on `development` through separate PR branches; this original branch tip is not itself an ancestor of `development`. Fold only W7/W7b material attributable to those PRs, reconciling shared files and handovers against current `development`. W7c UI (PR #33), W5, W8, W9, W12 and other pending workstreams have their own boundaries and must not be marked folded by this record. The integration-only `codex/w7-pm-plan-flow` and `codex/w7b-plan-editing` branch states may contain overlapping references; reconcile them to avoid duplicate decisions, handovers or ledger entries. No fold has been performed or approved here.
---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|


**Remaining**

- [ ] Obtain the owner’s explicit approval before folding W7/W7b into project state; use the current development tree and the scope boundary above.

- [x] W7 spec approved at Gate 1 (2026-11-07).
- [x] W7 plan approved at Gate 2 (2026-11-07): 11 tasks, 6 waves, all reviewed full.
- [x] Build T1-T11 (plan close-out lint clean).
- [x] Gate 3 and merge: operator reports approval; W7 merged via PR #31 and W7b via PR #32.
- [ ] **Handover W2 owner (Developer):** spec SD3 changes `Sessions.assertUsable` (a `PM_PLAN_OUTLINE` session also admits `PM_PLAN_EXPAND`) and amends contracts §5.3; their agreement is recorded in T1 (AD-11, as C59); not yet obtained.
- [x] **W5 (Dev Lead) integrated 2026-11-08:** `origin/w5-core-planning` (PR 23, not yet merged to `INT`) is merged into this branch; W5 supplies `requireMember`, `Core.assertWritable` and a `PM_PLAN_CREATE` project resolver that reads `id`; W7 registers the four proposal resolvers in `core-composition.ts`; both `applyPlan` implementations exist (see Known Gaps). PR 23 is now merged to development.
- [x] W5's owner estimate: no longer needed, W5 is in PR 23.
- [x] **W7b branch review and merge:** operator reports approval; PR #32 merged. D~10 retains the historical suite failures.
- [ ] **Fold reconciliation:** check each existing STATE.md Upcoming item against merged W7/W7b evidence before resolving or retaining it: W6 sources and `assembleWith` (`pm.similarItems`, titles only, at most 5, filtered by member projects); W3 section rules, blocked-input handling (`BLOCKED_INPUT` to 422 `VALIDATION_FAILED`, `REQUEST_REFUSED` to 422) and output schemas without URLs or angle brackets; W2 mock responses, static sections and `assertStaticSectionsFit`; W7 proposal resolvers.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W7 | PM plan flow (proposals, pm) | Done | [spec](../../specs/2026-11-07-w7-pm-plan-flow-design.md) | [plan](../../plans/2026-11-07-w7-pm-plan-flow/plan.md) | PR #31 merged; project-state fold pending | out of date: pm, core, proposals |
| W7b | PM plan editing (endpoints 36, 38, 39, 58-60; carved from W16) | Done | [spec](../../specs/2026-11-09-w7b-pm-plan-editing-design.md) | [plan](../../plans/2026-11-09-w7b-pm-plan-editing/plan.md) | PR #32 merged; project-state fold pending; D~10 | out of date: pm, proposals, contracts |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-13 | Operator reports approval and merge; identified W7 PR #31 and W7b PR #32 on development, separated W7c and other pending folds, and recorded fold boundary. | W7/W7b | 487cafe, 385cda8 |
| 2026-11-11 | Merged development 3519ff07; regenerated lockfile against merged manifests; typecheck, lint and contract tests pass. Full suite: 506 pass, 18 fail, 125 skip with placeholder DB target; rerun with correct configuration and investigate failures. Draft PR #30; owner review remains. W7c and UI integration continue on w7-link-ui. | W7/W7b | e756143 |
| 2026-11-09 | W7b T1 contracts, policy, OpenAPI and documentation implemented; focused and contract tests pass; review placement finding fixed | W7b | 1bdeca0, c304835 |
| 2026-11-09 | W7b T2 editing store implemented; review fixed strict-parse storage and deterministic lock races; 11 edit integration tests pass | W7b | 9bc5ec2, 8a5ed46 |
| 2026-11-09 | W7b T5 approval outcome and replay implemented; 21 database tests pass; review clean | W7b | f3c4564 |
| 2026-11-09 | W7b T6 proposal listing implemented; seven tests pass, full page uses eight queries; review clean | W7b | cb389e9 |
| 2026-11-09 | T3 first pass committed; review found D~5. Spec and plan amendment later approved under C~7; first suite run had unexplained failure D~4, rerun passed | W7b | 9e30264 |
| 2026-11-09 | W7b T4 watermark, regeneration claims and precheck implemented; 60 serial database tests pass; full review clean | W7b | a95127e |
| 2026-11-09 | W7b T3 collision repair complete; 62 serial database tests pass and full review clean | W7b | cae6634 |
| 2026-11-09 | W7b T7 PM flows implemented; 49 PM tests pass; review race fixed with 31 affected tests passing | W7b | fda7e9e, 5da505a |
| 2026-11-09 | W7b T8 routes and real database E2E implemented; full review clean; full suite failures tracked D~10 | W7b | b6ee74c |
| 2026-11-09 | Close-out: full branch review clean, coverage gaps addressed including 30 HTTP approvals; final suite 721/728 passes, D~10; typecheck, lint, schema and contracts pass | W7b | 82dbcba |
| 2026-11-09 | Reran the seven failing cases serially at operator request: two pass, five fail; see D~10 | W7b | working tree |
| 2026-11-07 | Branch created from `development` at `7caa23d`; branch state written | W7 | this commit |
| 2026-11-07 | Fast-forwarded to `INT` `faa1c08` (PR #21 folded W2, W3, W4, W6, W12 into `STATE.md`); no overlap, Base moved; dependency status recorded (W5 still Not started) | W7 | this commit |
| 2026-11-07 | W7 spec written (Big, High tier; 56 edge cases, 12 threats) and reviewed by Implementer, Tester, Maintainer and Attacker lenses; findings folded; lint clean | W7 | this commit |
| 2026-11-07 | W7 spec approved by the operator at Gate 1; `lint.mjs spec --approved` passes | W7 | this commit |
| 2026-11-07 | Wave 1 built and reviewed (full, three lenses each): T2 scaffolded the core, proposals and pm workspaces; T3 added strict plan body schemas and made the approve response three counts; T1 added the session feature map, contract and AD-28 text. Fix rounds: tighter T3 tests, version and idea bounds; T1 closed/idle/foreign session tests and an own-keys-only map lookup. Rejected: lone-surrogate and control-character rules on the idea (the spec does not ask; the gateway sanitiser handles them); an EXPAND-session self-map test (it correctly fails). Learned: 
pm install removes the generated Prisma client, so 	sc -b fails until `prisma:generate` runs (now in the plan's Shared context) | W7 | this commit |
| 2026-11-07 | Wave 2 built: T4 `applyPlan` (12 database tests incl. a real lock barrier), T5 proposals create/view/resolvers (7 database tests), T8 `pm.similarItems` and settings, T9 output schemas, sections and mocks. Run against a local Postgres in Docker (`w7-pg`; variables in untracked `.ws/w7.env`). Whole suite: 497 tests, 493 pass, 4 fail - all in `tests/process-security/agent-hook.test.ts` (F8 shell-write mediation, unrelated to W7; not compared with the base branch). The real database also found the session-rule regression (C~3) that skipped tests had hidden | W7 | this commit |
| 2026-11-08 | Merged `origin/w5-core-planning` (PR 23) after Gate 3. Conflicts resolved by union in `api` and `core` package files, `routes/index.ts` and `core/src/index.ts`; `package-lock.json` taken from W5 and re-installed. Added the four proposal resolvers to W5's `core-composition.ts` (`PM_PROPOSAL_READ`, `PM_EPIC_EXPAND`, `PM_PROPOSAL_APPROVE`, `PM_PROPOSAL_REJECT`) and `@agile/proposals` to the api package; new test `pm-composition.test.ts`. Typecheck, lint and contract pass; suite 674 tests, 667 pass. Failing: 4 F8 agent-hook tests (as before), E9/E29 (Windows CRLF migration checksum), and E5 and E35 timing tests that pass alone. Live run on SoCLaaS before the merge: see Known Gaps | W7 | this commit |
| 2026-11-09 | W7b spec drafted (Medium, Attacker lens added): the PM edits generated checkpoints, epics and tasks (add, change, delete), regenerates one epic, lists proposals; adds endpoints 58-60 and widens 38 and 39 to answer the proposal. Reviewed by Implementer, Tester and Attacker lenses (round 1: 12 blocking, 31 judgement findings, all folded; 60 edge cases, 11 threats); lint clean. Awaiting Gate 1 | W7b | this commit |
| 2026-11-09 | W7b spec approved by the operator at Gate 1, with one change: editing an epic's title or description keeps its tasks and status (the contract's reset to PENDING is removed); the UI reminds the PM to create a new epic for substantial changes. `lint.mjs spec --approved` passes | W7b | this commit |
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
- **Who asked:** found while running W2's integration tests on a local Postgres in Docker: sessions-integration.test.ts E26 opens a `PM_PLAN_EXPAND` session and regenerates it; the first rule from SD3 (`row.feature === (SESSION_FEATURE[feature] ?? feature)`) made that session unusable for its own feature. The operator asked for the local database; the AI amended the rule.
- **Decision:** `assertUsable` passes when `row.feature === feature` or `row.feature === SESSION_FEATURE[feature]` (own keys only). An outline session admits expand calls; an expand session still rejects outline calls (E2).
- **Why:** keeps every existing W2 behaviour and adds only the new case. Rejected: changing W2's E26 test to open an outline session (hides the regression). The earlier Tester-lens suggestion to cover the self case was wrongly rejected on 2026-11-07 and is now accepted.
- **Follow-up:** the spec hash in the plan is restamped (`112dc7d0a8c1`); T1 gets a second fix round.

### C~4 — Fewer reviews and combined dispatch for the rest of the W7 build

- **Date:** 2026-11-07.
- **Who asked:** the operator, mid-build: only run review agents for non-trivial work and combine a few tests together; the spec was already reviewed thoroughly, so reviewing and implementing every task separately is not needed.
- **Decision:** from T5 the per-task review level is lowered (T5, T6, T7, T10, T11 `light`; T8, T9 `none`). T6+T7 and T8+T9 each go to one implementer. One combined light review runs after T7 and one after T11. The whole-branch `code-review` at close-out stays. T1-T4 keep their `full` reviews.
- **Why:** the first four tasks' reviews found no blocking problem and cost about five subagent runs each; the real regression (the session rule) was found by running the tests against a real database, not by a reviewer.
- **Rejected:** keeping `full` on every task as planned; skipping the close-out review.

### C~5 — W7's `applyPlan` is the one the PM approve flow uses

- **Date:** 2026-11-08.
- **Who asked:** the operator, after the W5 merge showed two implementations.
- **Decision:** the PM runtime keeps W7's `applyPlan` (client-generated ids, `createMany`, counts, `INVALID_PLAN`). W5's `createApply().applyPlan` stays registered as `Core.applyPlan` and is not used by this flow. No W5 file was changed.
- **Why:** approve needs the created counts and W7's error mapping; W5's version returns nothing.
- **Rejected:** switching `decide.ts` to W5's version; editing W5's `core.ts` to expose W7's.

### C~7 — Durable claim watermark

- **Date and who:** 2026-11-09; operator approved the reviewed amendment after T3 review found a stale claim collision.
- **Decision:** Persist a proposal-level watermark for claim and deletion allocations, reserve completion headroom, and run T4 before repairing T3. A version above only the current maximum was rejected because later deletes and appends can reuse old values.

### C~6 — W7b: the PM can edit every generated item; chat refinement stays out

- **Date:** 2026-11-09.
- **Who asked:** the operator (PM), after asking which PM endpoints were missing: "conversations can be kept out for now, but all generated epics, checkpoints and tasks must be editable by the PM during the planning with AI stage". Answers to two scope questions: editing includes add and remove; endpoints 36 (list) and 39 (regenerate) are built in the same work.
- **Decision:** a new workstream W7b on this branch builds endpoints 38, 36, 39 and three new ones (58 checkpoints, 59 add epic, 60 delete epic). Tasks are edited by sending an epic's whole task list. Edits answer `PlanProposal` and are guarded by the proposal `version`. The contract list grows from 57 to 60 endpoints.
- **Why:** the plan the AI produces is a draft; without edits the PM must reject and regenerate everything. Rejected: edit-only; a model conversation (AD-61, A-07; future spec); per-entity endpoints; one replace-everything endpoint.
- **Follow-up:** the other owners agree to the three new endpoints (AD-11); W5's `policy.test.ts` count and contracts.md §3.4 are amended in the build.
- **Gate 1 (2026-11-09):** the operator approved the spec and its decisions SD1-SD12 and changed SD10: a title or description edit does not clear an epic's tasks; the UI reminds the PM to create a new epic instead for substantial changes. Why: the operator wants edits to be cheap and non-destructive. Rejected: clearing the tasks.

---

## 5. Close-out

**Built.** Endpoints 34, 35, 37, 40, 41 (`@agile/pm` routes and flow, `@agile/proposals` store and resolvers, `@agile/core` `applyPlan`, API routes, W2 session feature map, contract schemas). Verified against a local Postgres 16 in Docker (`w7-pg`, variables in untracked `.ws/w7.env`): full suite 565 tests, 561 pass, 4 fail, 0 skipped. The 4 failures are `tests/process-security/agent-hook.test.ts` (F8 shell-write mediation); no file they depend on differs from the base commit, but they were not run on the base branch. One run also showed a gateway test (`run-integration` E25) fail once under parallel load; it passed alone three times and in two later full runs.

**Historical close-out (before the PR merges).** The Developer (W2 owner) has not agreed to the `Sessions` change (AD-11). After the W5 merge (2026-11-08) the endpoints are wired to W5's composition, but not yet called over HTTP with real authentication. The whole-branch `code-review` reported 10 findings (none blocking). Fixed (commits 2ecaa2d, c26a5c3): approve replay without a stored count recounts from the stored rows; the proposal view reads in parallel and returns nothing for a viewer who is not a member of the proposal's project; the lock-wait test helpers wait only on the holder's backend; the body-limit and policy-key helpers are shared by the auth and pm routes; the pm runtime reuses one database client across failed builds and registers the similar-items source with a plain flag; a doubled blank line. Left on purpose: the placeholder resolvers (W5 owns them; Known Gap) and the top-50-by-id cut before ranking (accepted by spec SD5; Known Gap).

### Known Gaps (new)

- **PM similar-item retrieval is keyword matching, not full-text search** - up to 8 keywords from the idea, `contains` on titles through the filtered client, at most 50 candidates per table in id order before ranking (spec SD5; contracts §5.2 and AD-28 amended in T1).

- **Two `applyPlan` implementations in `@agile/core`** - W5's `createApply().applyPlan` (registered as `Core.applyPlan`, returns nothing, error `VALIDATION_FAILED`) and W7's `applyPlan` (client-generated ids, `createMany`, returns counts, errors `INVALID_PLAN`). The PM runtime uses W7's. They should be merged into one by the two owners.
- **Not run against the real composition** - the proposal resolvers are tested with a stub database (`pm-composition.test.ts`); no test starts the app with Firebase settings, so the five endpoints have not been called over HTTP with real authentication.
- **Retrieval candidates are the first 50 per table by id, ranked afterwards** - with more than 50 keyword matches in a table the best-ranked items may be missed (spec SD5).
- **The configured outline model times out on the live service** - a live run on SoCLaaS (2026-11-08, mock off) failed `PM_PLAN_OUTLINE` with `AI_UNAVAILABLE` (503): `qwen3.5:9b` took 58 s cold and about 17 s warm for a two-token reply, against the gateway's 25 s attempt deadline. With `LLM_MODEL_PM_PLAN_OUTLINE=llama3.1:8b` the whole flow worked (outline 6.9 s, six expansions 4 to 9 s, approve created 8 checkpoints, 6 epics and 25 tasks, no retries or flags). Not run live: retrieval with real items, injection text, the HTTP routes. Plan quality seen: tasks repeat across epics (for example a security task in four of six) and checkpoints are about two months apart.

### Deviations (new)

- **D~11 Date-only checkpoint update** — E16 coverage found date-only edits update epic timestamps because the required lockEpic takes a row lock by updating updatedAt. Business fields and versions remain unchanged; test covers them. Timestamp side effect retained to honor locking contract.

- **D~10 T8 full suite failures** — final discover-tests run: 728 total, 721 pass, 7 fail, 0 skipped. W7b tests passed; failures were transaction-marker start timeout, sanitizer timing, W13 migration checksum mismatch, and four agent-hook F8 tests. The operator requested a targeted rerun: transaction-marker and sanitizer passed; migration checksum and all four agent-hook tests still failed (2/7 pass, 5/7 fail, 0 skipped). Earlier W7b lock timeouts prompted fixture isolation and longer test-only deadlines (c6fae04); exact original cause unproven.

- **D~9 Malformed JSON response** — T8 reports task E7 expects 422 while existing endpoint 34 returns 400 BAD_REQUEST; spec E7 explicitly requires 422 on W7b routes; its claim that endpoint 34 already does so is incorrect. Implement scoped mapping and retain existing endpoint behavior.

- **D~8 Regenerate precheck/claim race** — T7 review found EXPAND-mode claim did not atomically recheck the original proposal version; deletion could shift an epic between precheck and claim. Corrected under F1; 31 affected integration tests pass and review is clean (5da505a).

- **D~7 T4 full proposal suite timeouts** — four of 60 database tests timed out under parallel load; serial rerun passed 59/60; existing decide E48 race selected approve instead of reject; second serial run passed 60/60 with no skips; intermittent E48 remains a known test concern.

- **D~6 T4 return type seam** — failEpic now returns boolean but the PM plan-flow mirror still says void. T4 updates that type only to keep its build green; T7 retains behavior changes.

- **D~5 Stale expansion claim can match a shifted epic** — review found that incrementing shifted versions can collide with an expired claim at the destination index, permitting tasks to land on the wrong epic. T3 mandates version +1, which cannot prevent the collision. Draft amendment uses a persistent proposal watermark for claim and delete allocations, reserves completion headroom, and adds collision and boundary tests. T4 precedes the T3 repair. Reviewed and approved by the operator 2026-11-09 (C~7); fixed in cae6634 with collision and boundary tests.

- **D~4 T3 proposal suite failure** — one of 57 tests failed; details were truncated. Rerun passed 57/57 with no skips; original failure remains unidentified.

- **D~1 Archived project answers 404, not 409, on endpoints 35, 37, 40, 41** - the filtered client hides every row of an archived project, so the proposal is not found (spec SD17; architecture §8 says 409).
- **D~2 The session rule changed after the first database run** - the first formula made a `PM_PLAN_EXPAND` session unusable for its own feature and broke W2's E26 test; fixed and recorded as C~3.
- **D~3 `plan-flow.ts` mirrors types and recognises `ProposalError` by name** - the W6 source scan forbids workspace imports other than contracts, ai-context and the gateway in a file that calls `run`.

### Handover (for `STATE.md` Upcoming at the fold)

- **W7b owners:** Dev Lead and Developer sign off endpoints 58–60 and changed 38/39 responses (AD-11); update architecture text saying 57 endpoints; UI reminds PM to create a new epic for substantial changes; creator-only editing differs from member-wide approval/rejection. Guide out of date: pm, proposals, contracts.

- **W2 owner (Developer):** agree to the `Sessions.assertUsable` change (a session admits its own feature and the one mapped by `SESSION_FEATURE`; contracts §5.3 amended).
- **W5 owner (Dev Lead):** PR #23 merged; agree with W7 on one `applyPlan` (see Known Gaps).
- **W2 owner (Developer), model config:** decide the `PM_PLAN_OUTLINE` model or deadline: `qwen3.5:9b` does not answer within the 25 s attempt deadline on SoCLaaS (see Known Gaps). Either set the feature to `llama3.1:8b` in `FEATURES` or allow a longer deadline for it; the environment override `LLM_MODEL_PM_PLAN_OUTLINE` works in the meantime.
- **W13:** `PM_SIMILAR_ITEMS` (`on`/`off`, default `on`) and the seed data that gives retrieval something to find.
- **Architecture Now blocks:** write `pm`, `core` and `proposals` area files from the built code at the fold.
