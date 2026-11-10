# W7c Story Points 1-20 and Plan-Wide Expansion Design

- **Status:** Approved (Xiao-Congchen, 2026-11-10)
- **Amended 2026-11-11:** see branch state C~5 and C~9.
- **Format:** v2
- **Risk tier:** Medium - changes three contracts (story points on `Task` and `PlanEpic`, new endpoint 61, the gateway's per-feature limits) and stores model output in domain rows; Attacker lens added because untrusted text now crosses from one epic into another epic's prompt.
- **Workstream:** W7c (PM follow-up of W7 and W7b; touches W2, W5 and W6 files) | **Plan:** not written yet
- **Constraints consulted:** AD-12 (reversed here, SD1), AD-10, AD-11, AD-25, AD-59, AD-61, AD-69 (freeze 10 Nov); contracts.md §3.1, §3.4, §5.3; C20, C48, C59; W7 spec SD3, SD6, SD10; W7b spec §4.2 (claim watermark), §4.3 (check order), SD8; guardrails Known Gaps "AI session caps and the spend cap are soft", "A few users can use up the global AI windows", "AI context checks rows, not sources", "Nested writes require explicit authorization".

## 1. Problem
**Points today.** `storyPoints` is the union 1, 2, 3, 5, 8, 13 in: `contracts/src/schemas.ts` (`TaskSchema`, `planTask`, the task body schema), `contracts/src/openapi-schemas.ts` (`TASK_CREATE` as an enum; `TASK_UPDATE` as a bare integer), `core/src/apply.ts`, `core/src/plan-input.ts`, `api/src/routes/planning.ts`, `pm/src/schemas.ts` (`POINTS`, `points`), the types in `proposals/src/expand-store.ts` and `pm/src/plan-flow.ts`, the rule text in `pm/src/sections.ts`, and the front end (`live/live-plan.tsx`, `live/forms.tsx` list and hint, `live/task-drawer.tsx` select). AD-12 and contracts.md state it. The column `tasks.story_points` is a nullable INTEGER with no check constraint (init migration), so the database already holds any integer. **Desired:** any whole number 1 to 20 (SD1).

**Expansion today.** "Confirm and Expand Epics" calls endpoint 37 once per epic. Each call (`buildExpandSections`) sends the approach, the assembled context and that one epic, so tasks overlap or contradict across epics. Regenerate (39) uses the same prompt. **Desired:** one endpoint that expands every unexpanded epic in one model call so the plan flows; endpoints 37 and 39 also see the rest of the plan.

Affected: the PM (plan quality) and every role that reads or sets points.

## 2. Goals
**Functional** (dependencies first)
- F1 Story points are a whole number 1 to 20 wherever a task or plan task carries them - Accept: 1 and 20 pass; 0, 21, -1, 1.5, "5", "20", true, an integer above 2,147,483,647 and (where required) null or a missing field fail with 422 on endpoints 21, 23, 38 and on approve; existing rows are unchanged.
- F2 The reversal is recorded - Accept: the decision log marks AD-12 superseded by a new decision; contracts.md, the architecture error example and every FE control and hint say 1 to 20; E7 finds no old list outside the superseded entry.
- F3 Gateway limits are settable per feature and PM_PLAN_EXPAND gets 2x the measured need (§4.1) - Accept: PM_PLAN_EXPAND has attempt timeout 54,000 ms, deadline 54,000 ms, call lease 75,000 ms, max output 4,200 tokens, max prompt 7,000 tokens; every other feature keeps today's attempt timeout, deadline, lease and tokens (a test pins them).
- F4 Endpoint 61 expands every PENDING, FAILED or expired-lease epic of a pending proposal in one model call - Accept: three PENDING epics in mock mode give one `run` call and three DONE epics with the parsed tasks.
- F5 The bulk prompt carries the approach, the epics to write, and the already-DONE epics with their tasks - Accept: the sections hold every target index and title, and every DONE epic's index and title; DONE task titles appear as the trim level allows (§4.3); an answer that names a non-target index or omits a target fails the whole call.
- F6 Endpoints 37 and 39 send the rest of the plan - Accept: `other-epics` lists every other epic by index with its tasks when it has any, and never the epic being written.
- F7 Every PM prompt demands a JSON-only answer - Accept: the outline, single expand and bulk `output-format` texts each contain "Answer with one JSON object and no other text" and "no markdown fences".
- F8 The UI uses these - Accept (manual, the front end has no test runner): "Confirm and Expand Epics" and "Retry failed epics" send one request to 61; per-epic Expand and Retry send one to 37; Regenerate one to 39; every points control is a number field limited to 1 to 20.

- F9 On both plan review steps, show epics grouped in the displayed checkpoint order, with unassigned epics last; preserve original epic order within each group. Unknown checkpoint references also go last. This is display-only and does not change epic indexes or stored order. Accept: changing a checkpoint assignment moves the epic to its displayed group after save.

**Non-functional**
- N1 No model call runs inside a database transaction; 61 makes exactly one `run` call, or none when no epic is a target - Accept: call-count assertions.
- N2 A 10-epic plan finishes inside the new limits - Accept: measured worst 26,850 ms and 2,086 output tokens (§4.1) with a unit test that the configured limits are at least twice those figures.
- N3 Claims and stores keep the W7b lock order (proposal row first, epic rows ascending) - Accept: barrier tests (E26, E27) finish without deadlock.
- N4 The API route allows the new deadline - Accept: `maxDuration = 60` is exported from the API catch-all route and exceeds the 54,000 ms deadline (AD-59). The 60 s ceiling for this Vercel project is not verified (SD9).
- N5 Prompt size is bounded by construction - Accept: for 10 epics of 8 tasks with every field at maximum length, the 61, 37 and 39 prompts estimate at most 7,000 tokens with the AI-context sections included, and `truncated` is false with every section present.

## 3. Non-goals
- A new `Feature` enum value, migration or session mapping - the bulk call reuses PM_PLAN_EXPAND (SD3).
- Chatting with the model or sending text to regenerate - AD-61 (A-07).
- Streaming, partial results, provider `response_format` JSON mode, a per-feature `minRetryMs`.
- Changing velocity, progress or forecast formulas (they sum points in `core/src/derived.ts` and `core/src/projects.ts`) or backfilling existing rows.
- Dev Lead re-plan, sprint planning, W15 usage views.

## 4. Design
### 4.1 Approach
A shared `StoryPointsSchema` (whole number 1 to 20, message "Must be a whole number from 1 to 20.") in `@agile/contracts` replaces every copy; core, pm, api and proposals already depend on `@agile/contracts`. Endpoint 61 claims every target epic in one transaction, makes one `PM_PLAN_EXPAND` call with a bulk prompt, then stores all returned epics in one transaction. Endpoints 37 and 39 keep one call per epic but send the rest of the plan. The gateway gains optional per-feature `attemptTimeoutMs`, `deadlineMs` and `leaseMs`, set only for PM_PLAN_EXPAND.

**Measurement (2026-11-10, live SoCLaaS, llama3.1:8b, 10 epics from the outline for "a library application to support the reservation, borrowing and return of books"):**

| Call | Time (ms) | Prompt tokens | Output tokens | Result |
|---|---|---|---|---|
| Outline | 10,047 | 379 | 800 | 10 epics |
| Single epic expand (today) | 5,450 | 430 | 392 | 3 tasks |
| Bulk, first prompt, 3 runs | 21,231 / 18,339 / 12,306 | 1,012-1,026 | 1,708 / 1,470 / 977 | 21-25 tasks; run 3 left `storyPoints` out of most tasks |
| Bulk, final prompt (§4.5), 4 runs | 26,850 / 21,465 / 23,716 / 19,126 | 1,038-1,052 | 2,086 / 1,660 / 1,842 / 1,464 | 21-23 tasks; no missing or out-of-range points |

Worst observed: 26,850 ms and 2,086 output tokens. 2x gives 53,700 ms (set to 54,000) and 4,172 tokens (set to 4,200). The prompt limit is 7,000, set by the arithmetic of §4.3, not by 2x of 1,052 (which is below today's 4,000). The model wrote 2 to 3 tasks per epic although 3 to 6 were asked, so the schema accepts 1 to 8 tasks per epic (SD8). Today's limits (20,000 ms attempt, 1,500 tokens) would have failed 5 of the 7 bulk runs on time and 4 on length.

**Gateway effects.** A timeout never retries; a 429 (after 2,000 ms) or a 5xx or network error retries once when `deadline - elapsed - wait >= minRetryMs` (8,000, stays global), and the retry gets the time left, so the total never exceeds 54,000 ms. The spend reservation of PM_PLAN_EXPAND rises from 125 to 266 µ$ per call (7,000 x 20,000 + 4,200 x 30,000 per million), far below the 20,000,000 µ$ cap. A timeout counts as a failure for the shared breaker (accepted: five consecutive failures open it for 60 s, as built).

### 4.2 Data model
No schema change, migration or seed change: `tasks.story_points` and the JSON `tasks` of `proposal_epics` already hold any integer. Existing rows stay valid. **Rollback:** after any task or plan task holds a value outside 1, 2, 3, 5, 8, 13, code rollback makes the old strict `Task` and `PlanProposal` schemas reject that row, which breaks the proposal view and approve for it. There is no cap script; before a rollback the PM edits such values through endpoint 23 or 38. Recorded as a Known Gap at the fold (E6).

**Bulk claim.** Under the proposal lock, targets are the epics with status PENDING, FAILED, or IN_PROGRESS with an expired lease, ascending by index. Each becomes IN_PROGRESS with `leaseExpiresAt = now + 75,000 ms` (was 60,000, `EXPAND_LEASE_MS`) and a distinct version: the first is `1 + max(watermark, all epic versions)`, each next adds 1, and `payload.epicVersionWatermark` is set to the last, all in one transaction. If the last version would exceed 2,147,483,646, nothing is written and the answer is 409 `CONFLICT_STATE`, before any model call.

**Bulk store.** One transaction under the proposal lock, epic rows locked ascending. A target is written only while still IN_PROGRESS at its claimed version: tasks as parsed, DONE, error null, lease null, version +1. A row whose claim was lost (edited, deleted, shifted, reclaimed) is skipped and left exactly as it is. `flagged` is raised when at least one row is written and the result is flagged. If no row was written, or the proposal is no longer PENDING, the transaction answers 409 `CONFLICT_STATE`, writes nothing and the spent call stays spent. The proposal `version` does not change. The logged outcome includes the counts written and skipped; the response is the fresh view, so the UI derives which epics are not ready.

**Bulk failure.** A gateway failure, an invalid answer, or a thrown error marks every target still claimed at its claimed version FAILED with the error code endpoint 37 records for that cause (`INTERNAL` for a thrown store error); rows whose claim was lost are left alone. The HTTP error is the one endpoint 37 returns; the UI re-reads the proposal (endpoint 35).

### 4.3 Interfaces
| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors (condition -> type/message) | Notes |
|---|---|---|---|---|---|
| 61 `POST /api/pm/proposals/{proposalId}/expand` | PM, member, the proposal's creator | body `{ version }` strict, positive integer, max 1,024 bytes | 200 `PlanProposal` (fresh view) | order inside the lock: 413, 404 (unknown, other creator, archived project), 409 `CONFLICT_STATE` unless PENDING, 409 `CONFLICT_VERSION`, 409 `CONFLICT_STATE` when any epic is live IN_PROGRESS, then no targets gives 200 and stops; 422 `VALIDATION_FAILED` for the body; model errors mapped as endpoint 37 (422 blocked input, 422 `REQUEST_REFUSED`, 429 `AI_BUSY` and `RATE_LIMITED`, 503 `AI_UNAVAILABLE` and `AI_DISABLED`) | one `run` call; with no target no call and no session check; proposal `version` unchanged; operation id `PM_PROPOSAL_EXPAND_ALL`, policy key `endpoint-61`, roles PM, predicate MEMBER |
| 37, 39 | unchanged | unchanged | unchanged | unchanged | prompt gains `other-epics` (F6) |
| 21, 23 | unchanged | `storyPoints` null or whole number 1-20 | unchanged | 422 `VALIDATION_FAILED`, field `storyPoints`, message above | event and sprint rules unchanged (a sprint needs points) |
| 38, 40 | unchanged | every task's `storyPoints` whole number 1-20 and required | unchanged | as above; approve keeps 409 on `INVALID_PLAN` | `PlanInputSchema` uses the shared schema |

**Seams** (copy into task files). `ProposalsApi` gains `claimPlanEpics({ proposalId, actorId, version, now? })` returning `{ kind: "NONE"; proposal: PlanProposal } | { kind: "CLAIMED"; projectId; sessionId; approach; targets: { index; title; description; checkpointName; claimedVersion }[]; done: PlanContextEpic[] }`; `storePlanEpics({ proposalId, results: { index; claimedVersion; tasks: EpicTask[] }[]; flagged })` returning `{ stored; skipped }` (throws `ProposalError("CONFLICT_STATE")` when `stored` is 0); `failPlanEpics({ proposalId, claims: { index; claimedVersion }[]; error })` returning the number marked. `PlanContextEpic` = `{ index; title; description; checkpointName; tasks: EpicTask[] | null }`. The `CLAIMED` result of `claimEpic` gains `others: PlanContextEpic[]` (every other epic, ascending, read inside the claim transaction). `EpicTask.storyPoints` is `number` in both mirrors (`expand-store.ts`, `plan-flow.ts`). `PlanFlow` gains `expandAll({ caller, proposalId, version })`.

**Output schemas (pm).** Single: `{ tasks: Task[1..8] }` as today with points 1-20. Bulk, built per call by `bulkOutputSchema(targetIndexes)`: `{ epics: [{ index, tasks: Task[1..8] }] }` with exactly the target indexes, each once, any order. `Task` = `{ title 1-200, description 1-1000, acceptanceCriteria 1-6 strings of 1-300, storyPoints }`; `storyPoints` is required and never null.

**Prompt layout.** Budgets are token caps counted on the rendered section (wrapper included). Constants live in `PM_PROMPT`.
- Bulk: static `rules` 600, static `output-format` 500, then the assembled context sections (800 + 300 + 400, from `allow-list.ts`; the query is the target titles joined by a space, cut to 1,000 code points), then untrusted `approach` 400, `epics` 1,400, `done-epics` 1,800 (omitted when no epic is DONE). Single (37, 39): `rules` 600, `output-format` 500, context, `approach` 400, `epic` 600 (title and description as today), `other-epics` 2,600.
- Worst case, tokens: bulk 1,100 + 1,500 + 400 + 1,400 + 1,800 = 6,200; single 1,100 + 1,500 + 400 + 600 + 2,600 = 6,200; the security suffix adds about 70; the limit is 7,000 (N5).
- **Field rules, every interpolated text:** line breaks, carriage returns and tabs become one space and runs of spaces collapse (so no field can start a line or forge a label); an epic's title is cut to 120 code points, its description to 200, its checkpoint name to 80; a task title to 100 (60 at level 0) and a criterion to 100. A `epics` block is `index: N`, `title: T`, `description: D`, `checkpoint: C or none`, blocks separated by one blank line; ten blocks are at most about 1,140 tokens.
- **Trim levels** (one renderer, used for `done-epics` and `other-epics`): level 2 = the block of `epics` plus `tasks:` and per task `- title (P points): criterion; criterion` (at most 2 criteria); level 1 = per task `- title (P points)`; level 0 = `index:` and `title:` only plus per task `- title (P points)`; an epic without tasks prints `tasks: none`. The renderer takes the first level whose wrapped text fits the section budget; level 0 of nine epics of eight tasks is about 1,530 tokens, so one always fits.
- Every dynamic section is `trusted: false`.

### 4.4 UI
- **Outline step:** "Confirm and Expand Epics" sends one request to 61, shows "Expanding all epics. This can take up to a minute." and disables every other control until the answer. A page reload re-reads the proposal (epics left IN_PROGRESS show "Expanding" until their lease ends, then Retry).
- **Tasks step:** "Retry failed epics" (shown while any epic is not DONE) sends one request to 61; per-epic Expand and Retry send one to 37; Regenerate one to 39. When 61 returns 200 but some target is not DONE, the page says how many epics could not be saved because they changed meanwhile.
- **Points:** every points control (`live-plan.tsx`, `live/forms.tsx` list and hint, `live/task-drawer.tsx` select) is `type=number`, step 1, min 1, max 20 (empty means none where points are optional); a new plan task defaults to 3; invalid input shows "Whole number from 1 to 20." and blocks Save; the form hint reads "1 to 20, or none".
- **Errors:** a failed bulk call shows the server message and leaves FAILED epics with Retry and Edit.

### 4.5 Conventions
- **JSON-only prompts.** Each PM `output-format` begins "Answer with one JSON object and no other text: no markdown fences, no comments, no trailing commas." then gives the shape. The outline text changes too (it lacks the fence clause today).
- **Bulk `rules`** (static): "Task: write the tasks of every epic in the epics section in one pass, so the whole plan flows logically." / "Work through the epics in order. An epic may build on the tasks of earlier epics. Never repeat work that another epic already covers: each piece of work is a task in exactly one epic. Epics in the done-epics section are already written: do not repeat or change them." / "Limits: 3 to 6 tasks per epic; titles up to 200 characters, descriptions up to 1000; 1 to 4 acceptance criteria per task, each up to 300 characters." / "Story points are whole numbers from 1 to 20 that estimate effort; use small numbers for small tasks. Do not invent dates." plus the three common rules. **Bulk `output-format`:** the JSON-only sentence, the shape `{"epics": [{"index": number, "tasks": [{"title": string, "description": string, "acceptanceCriteria": [string], "storyPoints": number}]}]}`, "Include one entry for every epic in the epics section, in the same order, with its index." and "Every task has all four fields. storyPoints is a whole number from 1 to 20 on every task, never missing and never null." The prompt targets (3 to 6 tasks, 1 to 4 criteria) are deliberately narrower than the schema (1 to 8, 1 to 6). The single expand rules keep their limits and change the points sentence to "Story points are whole numbers from 1 to 20 that estimate effort." and add "The other-epics section lists the rest of the plan: do not repeat its tasks, and make these tasks fit with them." A unit test asserts every static text fits its budget (`assertStaticSectionsFit`).
- **Mock.** The PM_PLAN_EXPAND mock takes the call; a call with a section named `epics` is bulk and returns one entry of three tasks (points 3, 5, 2) per line matching `^index: \d+$` in that section; any other call returns today's answer with points 3, 5, 2.
- **Gateway config.** `FeatureConfig` gains optional `attemptTimeoutMs`, `deadlineMs`, `leaseMs`; `gateway.ts` uses them over `LIMITS` when set (attempt, deadline, and the `IN_FLIGHT` lease at the `llmCall` insert). PM_PLAN_EXPAND: `maxTokens` 4,200, `maxPromptTokens` 7,000, `attemptTimeoutMs` 54,000, `deadlineMs` 54,000, `leaseMs` 75,000.
- **Route.** `export const maxDuration = 60` in `src/fe/app/api/[[...route]]/route.ts`. A function killed at 60 s leaves its epics IN_PROGRESS until the 75 s lease ends, so a retry waits up to 15 s more (accepted, E31).

### 4.6 Sequencing constraints
- `StoryPointsSchema` and the contracts, openapi and policy changes (`contracts/src/policy.ts`, `openapi-schemas.ts`, `api/test/policy.test.ts` counts 60 to 61, contracts.md §3.4) come before every package that imports them and before the route for 61.
- Gateway per-feature limits come before the pm and proposals changes. `pm/src/sections.ts` and `pm/src/plan-flow.ts` are edited by the prompt tasks only; the types of `plan-flow.ts` and `proposals/src/expand-store.ts` change together (the source scan forbids importing between them). The resolver for 61 goes in `api/src/core-composition.ts`; W5's `core/src/resolvers.ts` is not edited.
- Docs (decision log, contracts.md, architecture error example) change in the same change as the schema.
- AD-11 sign-offs are recorded as Handover in the branch state: W2 owner (per-feature limits and lease), W5 owner (points range on task create and patch).

## 5. Edge cases
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1 | `storyPoints` 0, -1, -0, 21, 1.5, "5", "20", true, 2,147,483,648 on 21, 23, 38 | 422 `VALIDATION_FAILED`, field `storyPoints`, message "Must be a whole number from 1 to 20."; nothing changes | route |
| E2 | F1 | 1, 20, `20.0` and `1e1` on 21, 23, 38 | accepted as the integers 1, 20, 20, 10 | route |
| E3 | F1 | null or missing points on 38 tasks and on approve; null on 21 and 23 | 422 on 38 and approve; accepted on 21 and 23 (unestimated) | route |
| E4 | F1 | A plan task with 0 or 21 reaches approve | 409 `CONFLICT_STATE` (`INVALID_PLAN`) as today | integration |
| E5 | F1 | Tasks with 4, 6, 7, 9, 10, 15, 20 points, some DONE; and old rows with 1, 2, 3, 5, 8, 13 | progress and unestimated count equal the sums; old rows read as before; a task with 17 can join a sprint, one without points cannot | integration |
| E6 | F1 | Current `Task`, `PlanEpic` and `PlanProposal` schemas parse 17 and 20 | parse succeeds | unit |
| E7 | F2 | Search `src/**` and `docs/**` (tests, seeds and `workflow/` excluded) for `1\W{1,3}2\W{1,3}3\W{1,3}5\W{1,3}8\W{1,3}13` and `literal\(13\)` | only the superseded AD-12 entry matches | unit |
| E8 | F3 | Attempt, deadline, lease and tokens of every feature other than PM_PLAN_EXPAND | equal today's values (20,000, 25,000, 60,000, config tokens) | unit |
| E9 | F3 | PM_PLAN_EXPAND: provider takes 50,000 ms; takes 54,001 ms; 5xx at 10,000 ms; 429 at 1,000 ms | OK; one attempt then `AI_UNAVAILABLE`; one retry with 44,000 ms left; one retry after 2,000 ms with 51,000 ms left; fake clock | unit |
| E10 | F4 | 61 on 3 PENDING epics, mock mode | one `run` call; three DONE; proposal `version` and session unchanged | integration |
| E11 | F5 | 61 with 2 DONE and 2 PENDING epics; and with none DONE | DONE rows untouched and absent from `epics`; `done-epics` lists them; with none DONE the section is absent | integration |
| E12 | F4 | 61 when every epic is DONE; when a session is closed and no target exists | 200 with the fresh view, no model call or session check; the lock may update proposal `updatedAt`, while all other persisted proposal fields, session and epic data remain unchanged | integration |
| E13 | F4 | 61 while one epic is live IN_PROGRESS and the rest PENDING; live IN_PROGRESS beside only DONE epics | 409 `CONFLICT_STATE`, no call, nothing claimed (live check before the empty-target 200) | integration |
| E14 | F4 | An expired-lease epic and a FAILED epic | both are targets and finish DONE | integration |
| E15 | F4 | Stale `version`; proposal not PENDING; replay of the old `version` after an edit | 409 `CONFLICT_VERSION`; 409 `CONFLICT_STATE`; 409 `CONFLICT_VERSION`; no call | integration |
| E16 | F5 | Answer: a target missing, repeated, a non-target index (including a DONE epic's), non-integer `index`, an epic with 0 or 9 tasks, a task with `storyPoints` missing or null | gateway failure; every claimed target FAILED; all-or-nothing is intended (SD8) | unit |
| E17 | F5 | Answer: every epic has 1 task; every epic has 8 | both accepted and stored with no warning | unit |
| E18 | F5 | One of three claims lost by an edit while the call runs | the edited epic keeps its edit, status and version; the other two are stored (+1); `flagged` raised if flagged; logged written 2, skipped 1 | integration |
| E19 | F5 | A claimed epic deleted, or shifted by a delete and an add, while the call runs | its old claim is skipped; no task lands on another epic; remaining rows stored | integration |
| E20 | F5 | Every claim lost, or proposal rejected during the call | 409 `CONFLICT_STATE`; nothing written; `flagged` not kept | integration |
| E21 | F5 | Gateway failure: `AI_BUSY`, `RATE_LIMITED`, `AI_UNAVAILABLE`, `AI_DISABLED`, `REQUEST_REFUSED`, blocked input; and a thrown error | targets FAILED with the code (`INTERNAL` for thrown); HTTP status as endpoint 37 gives; a later 61 retries them | integration |
| E22 | F5 | Failure while one claim was lost by an edit | the edited epic is not marked FAILED | integration |
| E23 | F6 | Expand epic 2 of 4 (37), and regenerate it (39), when epic 0 has tasks and epic 3 is DONE; two epics share a title | `other-epics` lists indexes 0, 1, 3 with their tasks, built by index; epic 2's own text and tasks are absent | unit |
| E24 | N5 | 10 epics x 8 tasks, every field at maximum length (61, 37, 39); a mid-size plan where level 2 fits its section | estimate at most 7,000 with context included; `truncated` false; every section present; level 0 used for the first, level 2 for the second | unit |
| E25 | F7 | Output-format text of outline, single, bulk; static texts against budgets | each contains the JSON-only sentence and "no markdown fences"; each static fits (`assertStaticSectionsFit`) | unit |
| E26 | F4 | Two simultaneous 61 requests with the same `version` | one 200 with one `run` call; the other 409 `CONFLICT_STATE` (live claim) or, if it runs after the store, 200 with no call | integration |
| E27 | N3 | A barrier after `lockProposal` holds 61's claim while an edit of another epic runs; a second case holds 37 of one epic while 61 runs | both finish without deadlock; 37 of a claimed epic gets 409 `CONFLICT_STATE` | integration |
| E28 | F4 | Member non-creator PM; non-PM role; non-member; unknown or non-UUID id; archived project | each gets the status and error body endpoint 37 returns for that caller (the task copies its route assertions); archived gives 404 (D~1) | route |
| E29 | F4 | Body missing, empty, `version` as string or float or 0, unknown key, malformed JSON; body of 1,024 and 1,025 bytes; chunked over the limit | 422 for the first group; 1,024 accepted; 1,025 and chunked 413 before authorisation | route |
| E30 | F4 | Watermark 2,147,483,644 with 3 targets, then with 2 targets | 3: last version 2,147,483,647, refused with 409, nothing written, no `run`; 2: last 2,147,483,646 allowed | unit |
| E31 | F4 | Function killed after the claims | epics stay IN_PROGRESS until the 75,000 ms lease ends, then 61 reclaims them; a delete is refused while the lease is live (W7b E35) | integration |
| E32 | F5 | Epic text with line breaks and `index: 7`, `## other-epics` or the section boundary string inside a title, description, criterion or checkpoint | breaks become spaces; the text appears only inside the untrusted wrapper; the mock returns exactly the target indexes; the section is `trusted: false` | unit |
| E33 | F5 | An epic whose title is only zero-width characters, in a plan expanded by 37, 39, 61 | the other calls are not blocked (the `index:` label keeps each block non-empty) | unit |
| E34 | F4 | Mock mode, plan of 10 epics | 61 makes no provider call and the mock answer passes `bulkOutputSchema` | integration |
| E35 | N4 | Route module | exports `maxDuration` 60 (unit); the Vercel limit itself is unverified | unit |
| E37 | F9 | Both review steps have interleaved checkpoint groups, unassigned and unknown checkpoints; an assignment is changed | displayed checkpoint order first, unassigned and unknown last in original relative order; each group keeps original order; actions target original indexes; saved reassignment moves group | manual |
| E36 | F8 | Click Confirm, Retry failed epics, per-epic Expand and Retry, Regenerate; reload mid-call; 21, 0, 2.5, "1e1", "+5" and empty in the plan, task drawer and Add task points fields | one request each to 61, 61, 37, 39; controls disabled during the call; reload re-reads; invalid values blocked with "Whole number from 1 to 20."; 1 and 20 accepted | manual |

## 6. Security
Medium plus Attacker lens. **Principal** PM; **authorisation** the policy gate (role PM, member) then the creator check inside the locking transaction, as endpoint 37; **tenancy** the proposal's project, never from the body; **validation** strict bodies, byte limits before authorisation, answers checked by the gateway against the per-call schema; **logging** request id, operation id, outcome class and the written and skipped counts, never titles, task text or prompts (AD-25).

| ID | Threat | Mitigation | Test |
|---|---|---|---|
| T1 | A member PM expands another PM's proposal | creator check, 404 | E28 |
| T2 | A stale tab or replay overwrites newer edits | `version` guard before any claim; per-row claim check at store; a replay after a failure can retrigger a call, limited only by the gateway windows (accepted) | E15, E18 |
| T3 | Text in one epic steers the model while it writes others; forged labels | every dynamic section untrusted and wrapped; breaks collapsed; answer schema-checked, size-bounded and human-reviewed before approve (the floor is the wrapper, AD-25) | E32, E16 |
| T4 | A forged or shifted index writes tasks onto the wrong epic | targets fixed server-side; answer must match them; claim versions skip shifted rows | E16, E19 |
| T5 | Repeated clicks or several proposals drain the AI budget | one call per 61; a live claim makes a second 61 on that proposal 409; the per-user and global windows and the breaker apply; several proposals at once are bounded only by those windows (soft caps, as accepted in guardrails) | E26 |
| T6 | A killed function leaves leases; a second call starts after expiry | lease 75,000 ms above the 54,000 ms deadline; live lease blocks 61, 37, 39 and deletes; a call whose function died is paid for once more on retry (accepted) | E13, E31 |
| T7 | Out-of-range or non-integer points corrupt sums | one shared schema on every entry; integers only | E1, E5 |
| T8 | A longer deadline lets slow upstream calls hold functions | per-feature, PM_PLAN_EXPAND only; `maxDuration` 60; reservation 266 µ$ | E8, E9, E35 |
| T9 | Proposal-level edits during the call (approach, another epic) make stored tasks stale | accepted: the PM reviews before approve; edits to an epic skip its store | E18 |

## 7. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|
| (none) | | | |

## 8. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Reverse AD-12: points are whole numbers 1 to 20 | the operator's call (branch state C~3). Rejected: keeping the scale | operator |
| SD2 | One model call writes all epics' tasks | the operator's call after the options; measured worst case 26.9 s needs longer limits. Rejected: chained per-epic calls that each see earlier tasks | operator |
| SD3 | Reuse PM_PLAN_EXPAND; no new Feature value | avoids an enum migration and a session mapping; the mock tells the calls apart by section name. Rejected: `PM_PLAN_EXPAND_ALL` | AI default |
| SD4 | Limits 2x the worst measured: 54,000 ms and 4,200 tokens; prompt 7,000; lease 75,000 ms; all per feature | the operator's 2x rule; prompt sized by §4.3; lease must outlive the deadline and must not change other features. Rejected: raising the global `LIMITS` | operator |
| SD5 | Endpoints 37 and 39 send the rest of the plan with tasks, trimmed by levels | the operator chose "all other epics and tasks"; the levels keep the prompt inside the limit | operator |
| SD6 | New endpoint 61 with `{ version }`; targets are PENDING, FAILED and expired-lease epics; DONE epics are context | retry is the same call; a stale tab cannot spend a call. Rejected: an index-less 37 | AI default |
| SD7 | A failed bulk call marks every claimed target FAILED; a lost claim skips only that epic on store or failure | one-click retry; hand edits are never overwritten | AI default |
| SD8 | The schema accepts 1 to 8 tasks per epic though the prompt asks for 3 to 6; a missing epic or task field fails the whole call | measured: the model returned 2 to 3 per epic; accepting partial answers would hide missing epics. Rejected: per-epic partial acceptance (needs a lenient gateway schema) | AI default |
| SD9 | Both timeouts 54,000 ms; `maxDuration` 60 | a timeout never retries and a fast failure retries inside the deadline; Hobby's non-Fluid ceiling is 60 s, not verified for this project (W13 handover) | AI default |
| SD10 | One shared `StoryPointsSchema` in contracts | seven copies drifted under AD-12; core, pm, api, proposals already import contracts | AI default |
| SD11 | No backfill, no migration, no rollback script | the column accepts any integer; rollback needs a manual cap (§4.2) | AI default |
| SD12 | Prompt text is flattened to single lines and cut per field (§4.3) | stops forged labels and bounds the prompt by construction | Attacker lens |

## 9. Review record
F9 amendment reviewed 2026-11-11 by Implementer and Tester: no blocking findings. Lenses: Implementer, Tester, Attacker (untrusted text across epics, ownership, races, spend) | Rounds: 1 | Round 1 found 7 blocking (2 Implementer, 5 Tester) and 35 judgement or minor items; all folded: prompt arithmetic with context sections (§4.3), gateway retry wording and per-feature lease (§4.1, §4.5), named seams (§4.3), missing points copies (§1), bulk store and failure rules (§4.2), many E rows. Rejected findings: Attacker A1 (one bad epic blocks the rest) - blocked input means empty after sanitising and each block carries an `index:` label, covered by E33; Tester Q16 asking for a CI test of the measured latency - replaced by the limits-versus-measurement unit test in N2; Attacker A7 option to compare the proposal `version` at store - kept as accepted (T9).
