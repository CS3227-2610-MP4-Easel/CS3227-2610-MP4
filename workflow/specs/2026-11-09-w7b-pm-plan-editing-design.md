# W7b PM Plan Editing Design

- **Status:** Approved (Xiao-Congchen, 2026-11-09)
- **Proposed amendment:** Pending owner approval (D~5): prevent stale claims from matching a different shifted epic.
- **Format:** v2
- **Risk tier:** Medium - new service API on stored proposals, new state transitions and new persisted fields; the contract list grows from 57 to 60 endpoints. Attacker lens added: proposal ownership, untrusted text that is later written to domain rows, index shifts under in-flight model calls, and a race with approve.
- **Workstream:** W7b (the PM part of W16: endpoints 36, 38, 39, plus three new endpoints) | **Plan:** not written yet
- **Constraints consulted:** AD-10, AD-36, AD-41, AD-46, AD-61, A-07; contracts.md §3.4 and §5.3; C20 (contracts stay normative), C48, C51, C59; W7 spec SD3, SD6, SD10, SD17 and Deviation D~1; guardrails Known Gaps "Nested writes require explicit authorization", "Unvalidated relation filters are unsafe", "AI session caps and the spend cap are soft".

## 1. Problem
**Today.** After endpoint 34 the PM can only read (35), expand (37), approve (40) or reject (41) a plan. Nothing the model produced can be changed: checkpoints (`ai_proposals.payload.checkpoints`), epics (`proposal_epics.title/description/checkpoint_name`) and tasks (`proposal_epics.tasks`) are read-only. A bad epic or task can only be fixed by rejecting the whole plan and spending a new session, or by approving it and editing the created rows through the planning CRUD. Endpoints 36, 38 and 39 are in the contract (`policy.ts`) but have no route, and endpoint 38 as written carries only epic fields and returns a `PlanEpic` with no version for the next call.

**Desired.** While a proposal is PENDING, the PM who created it can change every generated checkpoint, epic and task by hand, add or delete checkpoints, epics and tasks, regenerate one epic with the model, and list earlier proposals. Approve then creates exactly what the PM saw at the version they approve. No conversation with the model (non-goal).

## 2. Goals
**Functional** (dependencies first)
- F1 Every change to a pending proposal's content is guarded by the proposal's `version` - Accept: an edit, add, delete or regenerate with a stale version answers 409 `CONFLICT_VERSION` and changes nothing; every successful one raises the proposal `version` by 1.
- F2 Endpoint 58 replaces the checkpoint list - Accept: add, rename, re-date and delete in one call; epics follow renames and lose a deleted checkpoint (E10-E18).
- F3 Endpoint 38 edits one epic's title, description, checkpoint and tasks - Accept: tasks may be added, removed and changed by sending the whole list; the stored tasks equal the parsed request.
- F4 Endpoints 59 and 60 add and delete an epic - Accept: indexes stay contiguous from 0; counts stay within 1-10 epics.
- F5 Endpoint 39 regenerates one expanded epic - Accept: the stored tasks are replaced by a new model result, the session's `regenerate_count` rises by 1 and the proposal `version` rises by 1; the 6th regeneration answers 429.
- F6 Endpoint 36 lists a project's PLAN proposals, newest first - Accept: paged (size at most 20), optional status filter, member PMs only.
- F7 Approve reports the edit - Accept: after any successful edit (not after regenerate alone) the session closes `EDITED`; with none it closes `ACCEPTED` as before; a replay closes nothing.
- F8 Edited plans stay approvable - Accept: for any sequence of successful edits ending with every epic DONE, `PlanInputSchema.safeParse` of the plan assembled from the stored rows succeeds and approve returns 200 (never the 409 that `INVALID_PLAN` maps to).

**Non-functional**
- N1 No model call runs inside a database transaction; endpoint 39 makes exactly one `run` call (zero when it is refused); endpoints 36, 38, 58, 59, 60 make none - Accept: call-count assertions.
- N2 Every writer takes the proposal row lock first and touches epic rows only after it, in ascending index order, holding them to commit - Accept: a barrier test shows an edit and an approve serialise and two concurrent edits to different epics do not deadlock.
- N3 A page of the list endpoint (size 20, each proposal with 10 epics) uses at most 8 database queries - Accept: query-event count in an integration test.
- N4 Every error row of § 4.3 and every threat row of § 6 not marked accepted is covered - Accept: each E and T row names a passing test.

## 3. Non-goals
- Chatting with the model to refine a plan, or sending text to regenerate - AD-61 (A-07: regeneration carries no text); recorded as a future spec.
- Reordering epics or tasks; moving a task to another epic (delete and add instead).
- Editing a plan after approve or reject; editing created rows - W5 CRUD (endpoints 13-25).
- The New Plan screen in `src/fe`; usage views.
- Other endpoints of W16 (8, 11, 14, 15, 18, 19, 25, 26, 43, 53, 54) - left to their owners.
- A creator check on approve and reject (SD11); index-only addressing of endpoint 37 stays as built.
- Any change to `SUPERSEDED` or the Dev Lead re-plan.

## 4. Design
### 4.1 Approach
Extend `@agile/proposals` with an edit store (all writes, no model) and `@agile/pm`'s `PlanFlow` with `regenerateEpic` plus pass-throughs for the edits; routes live in `src/be/api/src/routes/pm.ts`. Every writer uses the SD6 lock pattern of the W7 spec: `lockProposal` first, then decide from the re-read row. Tasks are edited by sending the epic's whole task list, so one call covers add, remove and change of tasks without per-task endpoints; checkpoints likewise are replaced as a list. This keeps the new surface to three endpoints. Liveness of an `IN_PROGRESS` epic is `leaseExpiresAt !== null && leaseExpiresAt >= now` with the flow's injected clock, the same rule as `claimEpic`.

### 4.2 Data model
No schema change, no migration, no seed change (JSON fields and existing columns hold everything). Rollback of the code leaves edited rows valid under the old code, which only reads them.

`ai_proposals.payload` gains `edited: boolean` (absent = false), set to true by every successful edit (endpoints 38, 58, 59, 60; not by regeneration). Edits merge into the existing payload (`approach`, `retrieved`, `applied` survive); `PlanProposalSchema` does not expose `edited`, and it survives approve, which is intended. `ai_proposals.version` rises by 1 on every edit and on every stored regeneration (W7 spec § 4.2 reserved this).

Stored checkpoints stay `{name, targetDate}`; `previousName` is request-only. Stored checkpoints and tasks are the output of the strict parse of the request, never the raw body. Before commit every edit validates the resulting checkpoints and epics with `PlanInputSchema` (a not-DONE epic is checked with one placeholder task), so no edit can leave a plan that approve rejects (F8).

`proposal_epics`: an edit that changes title, description or checkpoint name recomputes `content_hash`. The epic row `version` rises by 1 whenever a write sets `tasks`, changes `title` or `description` to a different value, or changes `expansionStatus`; claims and deletes allocate a version as described below; a write that sets `tasks` or changes the status also sets `lease_expires_at` to null. A change of checkpoint name alone leaves `version` and the lease untouched. This makes a stale in-flight store (guarded by `claimedVersion`) fail. Counts and bounds are those of `PlanInputSchema`: checkpoints 0-8, epics 1-10, tasks per epic 1-8, each task `{title 1-200, description 0-4000, acceptanceCriteria string[] 0-12 each 1-300, storyPoints 1|2|3|5|8|13}` (storyPoints required).

**Claim identity watermark (proposed D~5).** `payload.epicVersionWatermark` is an internal non-negative integer, absent meaning 0, preserved by every payload write and never exposed in `PlanProposal`. Under the proposal lock, every actual claim and every delete allocates `1 + max(watermark, versions of all current epic rows)`; it writes that value to the watermark and the claimed row or every shifted row in the same transaction. If allocation would exceed 2,147,483,646, return `CONFLICT_STATE` and write nothing; this reserves one increment for store or fail. Test allocation at the boundary and refusal above it. A rejected claim or a `DONE` response allocates nothing. This prevents old claims from matching new rows even after earlier deletions and appends. Existing proposals have never supported deletion, so absent watermarks need no migration.

**Expansion states** add one edge: any non-live state -> `DONE` (tasks supplied by hand; `error` cleared). A title or description edit changes no expansion state, tasks or error (SD10, which amends the contract's "a change to title or description resets expansion"). A `DONE` epic regenerates through `IN_PROGRESS` back to `DONE`, or to `FAILED` with its previous tasks kept. A live `IN_PROGRESS` row allows no edit to that epic and no regenerate; delete is refused while any epic of the proposal is live.

### 4.3 Interfaces
Common to endpoints 38, 39, 58, 59, 60: principal PM, member of the proposal's project (policy gate), and the proposal's creator (anyone else: 404 `NOT_FOUND`, as endpoint 37). All bodies and queries are strict (an unknown key gives 422); `version` is a required positive integer (body field, or the query parameter of 60). Check order inside the transaction: proposal lock, then 404 (unknown, other creator, archived project per D~1), then 409 `CONFLICT_STATE` unless the proposal is PENDING, then 409 `CONFLICT_VERSION` when `version` differs from the proposal's, then 422 `VALIDATION_FAILED` for the body (details name the field). 413 `PAYLOAD_TOO_LARGE` comes first, before authorisation. Text matching (`previousName`, `checkpointName`) is exact, case-sensitive and untrimmed; checkpoint-name uniqueness is case-insensitive, as in `PlanInputSchema`. A request whose values equal the stored ones still counts as an edit (`version` +1, `edited` true). Success is **200 `PlanProposal`** (the fresh view with the new `version`), except 59 (201 `PlanProposal`). Transaction: one, proposal lock first. Body limits count raw bytes, so a schema-valid payload of multi-byte characters near the maximum may answer 413.

| # | Endpoint | Body / query | Rules and effects |
|---|---|---|---|
| 38 | `PATCH /api/pm/proposals/{proposalId}/epics/{index}` (body max 262,144 bytes) | `{ title?: 1-200, description?: 0-4000, checkpointName?: string\|null, tasks?: Task[1-8], version }`; at least one of the four fields present (`null` for `checkpointName` is a value), else 422 | `checkpointName` must equal a name in the proposal's checkpoints or be null, else 422. `tasks` present: stored as parsed, expansion `DONE`, error null. `tasks` absent: expansion status, tasks and error stay exactly as they are, whatever else changes (title, description, checkpoint). Live `IN_PROGRESS`: 409 `CONFLICT_STATE`. Index not matching `0\|[1-9][0-9]{0,2}` or past the last epic: 404. |
| 58 | `PATCH /api/pm/proposals/{proposalId}/checkpoints` (max 16,384 bytes) | `{ checkpoints: {name 1-200, targetDate YYYY-MM-DD, previousName?: 1-200}[0-8], version }` | Replaces the list. Names unique ignoring case; `targetDate` a real calendar date; `previousName` must equal a current name exactly and be used at most once, else 422. Epics map from the **old** names simultaneously: an epic's `checkpointName` becomes the `name` of the entry whose `previousName` equals it; else itself if some entry has exactly that name; else null (so `A->B, B->C` sends A epics to B and B epics to C, and a case-only change without `previousName` loses the link). Locks every epic row in ascending order; a live `IN_PROGRESS` epic does not block it (only `checkpointName` and `content_hash` change). |
| 59 | `POST /api/pm/proposals/{proposalId}/epics` (max 32,768 bytes) | `{ title 1-200, description 0-4000, checkpointName: string\|null, version }` | Appends at index = current count, expansion `PENDING`. 422 when the proposal already has 10 epics or the name is unknown. Response 201. |
| 60 | `DELETE /api/pm/proposals/{proposalId}/epics/{index}?version=N` | none | Deletes the row, then re-keys each later row one index down, one at a time in ascending order (never one multi-row decrement: the key is `(proposal_id, index)`); shifted rows keep content, status and tasks and each gets the allocated watermark version described in §4.2. 422 when it is the only epic. 409 `CONFLICT_STATE` when any epic of the proposal is live `IN_PROGRESS` (a live claim must not be shifted or lost); an expired lease does not block. Unknown index: 404. |
| 39 | `POST /api/pm/proposals/{proposalId}/epics/{index}/regenerate` (body `{ version }`, max 1,024 bytes) | `{ version }` | Response 200 `PlanProposal`. Sequence: (1) one short transaction under the proposal lock applies the Common rules and reads the session id, the epic's status and liveness; live `IN_PROGRESS` gives 409. (2) Epic `DONE` only: `sessions.assertUsable` (not usable: 409 `CONFLICT_STATE`, "the AI session expired", never 429), then `sessions.regenerate` (cap 5, then 429 `RATE_LIMITED` with `Retry-After`). (3) `claimEpic` with `mode: "REGENERATE"`, which accepts `DONE`; a claim that loses a race gives 409 and the count stays spent (accepted). (4) One `PM_PLAN_EXPAND` call; the store writes the tasks and raises the proposal `version` by 1 in one transaction; it does not set `edited`. A model failure maps as endpoint 37 (429 `AI_BUSY`, 503) and leaves the epic `FAILED` with its previous tasks kept, so approve gives 409 until it is expanded again. Epic `PENDING` or `FAILED`: behaves exactly as endpoint 37 (no count, no proposal `version` change, still checks `version`). The claim allocates a watermark version; the store raises it by 1. |
| 36 | `GET /api/pm/projects/{id}/proposals?status&page&size` | query schema `PageQuerySchema.extend({ status: PENDING\|APPROVED\|REJECTED\|SUPERSEDED, optional, size max 20 })`, strict (page from 0, size 1-20, default 20) | A `status` outside the four, an unknown key or `size` above 20: 422. Member PMs see every PLAN proposal of the project (REPLAN excluded from items and `total`), `createdAt` then `id` descending, `retrieved` resolved per viewer as endpoint 35. A page past the end gives `items: []` with the real `total`. Queries: membership, count, page of proposals, one epics query for the page, one batched title lookup per source (EPIC, TASK). Response 200 `{ items: PlanProposal[], page, size, total }`. |

**Approve (40) change.** `approveProposal` returns the close outcome with its result: `EDITED` when `payload.edited` (read inside the locked transaction) is true, else `ACCEPTED`, and calls `sessions.close` only on the call that performs the PENDING to APPROVED change. The replay branch returns the stored result and calls nothing. A close failure still never fails the request (existing warning).

### 4.4 UI
None in this spec (non-goal); screens consume the schemas above. When the PM edits the title or description of an expanded epic, they must show a reminder: for a substantial change, create a new epic (endpoint 59) instead of editing the old one, because the existing tasks are kept (SD10).

### 4.5 Conventions
New operation ids `PM_PROPOSAL_CHECKPOINTS_UPDATE` (58), `PM_PROPOSAL_EPIC_CREATE` (59), `PM_PROPOSAL_EPIC_DELETE` (60); policy entries `endpoint-58..60` with roles `["PM"]` and predicate `MEMBER`. The contract's `PlanEpic` responses of 38 and 39 become `PlanProposal` in contracts.md §3.4 and the openapi schemas, and its side effect "a change to title or description resets expansion to PENDING" is removed (SD10); 39 gains a `{ version }` body; the paged list size is capped at 20. The proposal resolver covers 38, 39, 58, 59, 60; 36 uses the project resolver of 34. `policy.test.ts` counts become 60.

### 4.6 Sequencing constraints
- Contract, policy map, operation ids and openapi parity come before routes (every route registers by policy key).
- `core/src/resolvers.ts` is W5-owned: resolve 36 in `api/src/core-composition.ts` as the proposal operations are, without editing W5's file.
- `claimEpic` input gains `mode?: "EXPAND" | "REGENERATE"` (default `"EXPAND"`); only `"REGENERATE"` treats `DONE` as claimable and it keeps the row's tasks until the store. `storeEpic` gains a flag that raises the proposal `version`, set only on the regenerate path. The same fields are added to the mirrored `ProposalsApi` and `ClaimResult` types in `pm/src/plan-flow.ts` (the W6 source scan forbids importing them).
- `ProposalsApi` also gains a pre-check function for endpoint 39 that returns the session id; the pm file that calls `gateway.run` imports no database client.
- `approveProposal` (decide.ts) changes with F7 before the edit endpoints are tested end to end.

## 5. Edge cases
| ID | Req | Scenario | Expected | Layer |
|---|---|---|---|---|
| E1 | F1 | Stale `version` on each of 38, 39, 58, 59, 60 | 409 `CONFLICT_VERSION`, nothing changed, no model call | integration |
| E2 | F1 | Two edits with the same version at once | one 200, the other 409 `CONFLICT_VERSION` | integration |
| E3 | F1 | Any of 38, 39, 58, 59, 60 against APPROVED, REJECTED or SUPERSEDED | 409 `CONFLICT_STATE` | integration |
| E4 | F1 | Another member PM calls each of 38, 39, 58, 59, 60 | 404, nothing changed | route |
| E5 | F1 | A non-PM role, or a caller who is not a member, on 36, 38, 39, 58, 59, 60 | the status endpoint 37 returns today for the same caller | route |
| E6 | F1 | Unknown or non-UUID `proposalId` | the status endpoint 35 returns today | route |
| E7 | F1 | Missing, non-integer or non-positive `version` (body and DELETE query); unknown body key (`assignee`, `id`, `model`); malformed JSON | 422 `VALIDATION_FAILED` (malformed JSON as endpoint 34 answers today); nothing changed | route |
| E8 | F1 | An edit whose values equal the stored ones | 200, `version` +1, `edited` true | integration |
| E9 | F1 | Body at the limit and limit + 1 byte on 38, 39, 58, 59; a chunked body without Content-Length | at the limit accepted; above it 413 with the resolver and database spies at 0 calls | route |
| E10 | F2 | Rename `A` to `B` with `previousName: "A"` | checkpoint `B`; epics that had `A` have `B`; `content_hash` recomputed; `proposal_epics.version` unchanged | integration |
| E11 | F2 | A checkpoint omitted from the new list | epics that referenced it get null | integration |
| E12 | F2 | Names differing only by case; `previousName` unknown, used twice, or matching only ignoring case | 422 | unit |
| E13 | F2 | Empty list | 200; every epic's checkpoint becomes null | integration |
| E14 | F2 | 9 entries, or 31 Feb, or an invalid `targetDate` | 422 | unit |
| E15 | F2 | Swap `A<->B` and chain `A->B, B->C` with `previousName` | epics map from the old names simultaneously | integration |
| E16 | F2 | Only a `targetDate` changed | epics unchanged, `edited` true, `version` +1 | integration |
| E17 | F2 | Entry `a` without `previousName` while the old name is `A` | epics of `A` get null | integration |
| E18 | F2 | 58 while an epic is live `IN_PROGRESS` | 200; epic's `checkpointName` updated; its later store still lands | integration |
| E19 | F3 | `tasks` sent for a PENDING epic | expansion DONE with exactly the parsed tasks | integration |
| E20 | F3 | Title and description changed on a DONE epic, no tasks | tasks kept, status DONE, `content_hash` recomputed, epic `version` +1; approve still works | integration |
| E21 | F3 | Title changed on a FAILED epic, and on an expired-lease `IN_PROGRESS` epic | status, tasks and error unchanged; epic `version` +1 so a stale store is discarded | integration |
| E22 | F3 | Only `checkpointName` changed on a DONE epic | tasks kept, status DONE, epic `version` unchanged | integration |
| E23 | F3 | Title sent equal to the stored title | nothing about the epic changes (proposal `version` +1, `edited` true) | integration |
| E24 | F3 | `tasks: []`, 9 tasks, storyPoints 4 or null, 13 criteria, empty criterion, unknown task key | 422 | unit |
| E25 | F3 | Body with only `version`; `{ version, tasks: null }`; `{ version, title: "" }`; `{ version, checkpointName: null }` | first three 422; the last accepted | unit |
| E26 | F3 | `checkpointName` not in the checkpoint list | 422 | unit |
| E27 | F3 | Index `-1`, `1.5`, `abc`, `01`, `+1`, `1e0`, ` 1`, `1000`, one past the last epic | 404 | route |
| E28 | F3 | Edit while the epic is live; at `leaseExpiresAt == now` and 1 ms after | 409 `CONFLICT_STATE` at equal time; allowed after | integration |
| E29 | F3 | Model call in flight, lease expired, epic edited by hand, then the old call stores or fails | the store and the failure are discarded; the 37 or 39 caller gets 409 `CONFLICT_STATE` | integration |
| E30 | F3 | Checkpoint-only edit, then the old call stores | tasks land; the new checkpoint stays | integration |
| E31 | F4 | Add the 11th epic; delete down to 1 and add back to 10 | 422; the sequence works | unit |
| E32 | F4 | Add an epic with an unknown checkpoint name | 422; a valid add gives 201, index = count, PENDING | integration |
| E33 | F4 | Delete epic 1 of 4, and epic 0 of 10 | later epics re-keyed to 0..n-1, keep content hash, status and tasks, `version` equal to the new watermark, greater than every pre-delete epic version; response proposal `version` = previous + 1; the old version on the next call gets 409 | integration |
| E34 | F4 | Delete the only epic | 422 | unit |
| E35 | F4 | Delete while any epic is live `IN_PROGRESS`; while only an expired one exists | 409, nothing changed; the second deletes | integration |
| E36 | F4 | Delete an unknown index | 404 | route |
| E37 | F4 | Expired-lease epics have different versions; a delete shifts one into another claim's old index, then both old calls store or fail; delete a claimed epic, append and claim a replacement, then the deleted epic's old call stores or fails | all old stores and failures are discarded, including after the former row has disappeared | integration |
| E38 | F5 | Regenerate a DONE epic | tasks replaced; `regenerate_count` +1; proposal `version` +1; epic gets the allocated claim version and rises once on store; `edited` unchanged | integration |
| E39 | F5 | 6th regeneration in one session | 429 `RATE_LIMITED` with `Retry-After`; no model call; count stays 5 | integration |
| E40 | F5 | Regenerate a PENDING or FAILED epic | as endpoint 37; count and proposal `version` unchanged | integration |
| E41 | F5 | Model fails during regenerate | mapped error; epic FAILED with previous tasks kept; count +1; approve 409 | integration |
| E42 | F5 | Regenerate with a stale version | 409 `CONFLICT_VERSION`; no model call; count unchanged | integration |
| E43 | F5 | Regenerate a live `IN_PROGRESS` epic | 409; count unchanged | integration |
| E44 | F5 | Regenerate when the session is closed or idle-expired | 409 `CONFLICT_STATE` ("the AI session expired"), not 429 | integration |
| E45 | F5 | Two simultaneous regenerates of one DONE epic | one 200 and one 409; exactly one model call; count +1 or +2 | integration |
| E46 | F5 | Approve with the version from before a regenerate | 409 `CONFLICT_VERSION` | integration |
| E47 | F5 | Regenerate over hand-edited tasks | replaced by a result that passes the expand schema | integration |
| E48 | F6 | List with `status=PENDING`, page 1, size 1; two proposals with equal `createdAt` | filtered; newest first, ties by `id` descending; `total` counts the filter | integration |
| E49 | F6 | `status=APPROVEDX`, unknown query key, `size=21` | 422 | route |
| E50 | F6 | Page past the end | `items: []`, real `total` | integration |
| E51 | F6 | A REPLAN proposal in the project | not listed, not counted | integration |
| E52 | F6 | Two member PMs list the same proposal | each sees only the `retrieved` titles from their own projects | integration |
| E53 | F6 | Non-member project; archived project | the status endpoint 34 returns today; 404 | route |
| E54 | F7 | Approve after an edit, then replay | session `EDITED`; `sessions.close` called once; replay creates nothing | integration |
| E55 | F7 | Approve after only a regenerate | session `ACCEPTED` | integration |
| E56 | F7 | Approve after an edit with `sessions.close` throwing | 200; warning logged; session left OPEN | integration |
| E57 | F1 | Edit and approve at the same time, each order forced by a barrier held after `lockProposal` | edit first: approve 409 `CONFLICT_VERSION`; approve first: edit 409 `CONFLICT_STATE` | integration |
| E58 | N2 | Two edits to different epics at once; an edit during a store of endpoint 37 | both complete; no deadlock | integration |
| E59 | F8 | Random sequences of edits ending with all epics DONE; a maximum-size ASCII plan | `PlanInputSchema` accepts the assembled plan; approve 200 | integration |
| E60 | F1 | Edit of an archived project's proposal | 404 (D~1) | integration |

## 6. Security
Medium tier plus Attacker lens. Common: principal PM; authorisation = policy gate (role PM, member) then the creator check inside the store, both inside the same transaction as the write; tenancy = the proposal's project; the project id never comes from the body; no field carries an id, assignee or model name (strict schemas, E7); logged: request id, operation id, outcome class (no titles or text).

| ID | Threat | Mitigation | Test |
|---|---|---|---|
| T1 | A member PM edits or regenerates another PM's proposal (IDOR) | creator check; 404 | E4 |
| T2 | A replayed or stale request overwrites newer edits | `version` guard on every change, including 39 | E1, E2, E42 |
| T3 | An edit races with approve and approve creates the old plan | one proposal row lock; PENDING and version re-read after the wait | E57 |
| T4 | An edit, delete or shift lands while a model call is in flight and the old result overwrites another epic | live-lease 409 for edits and any delete; epic `version` bump on tasks or status changes and the durable claim watermark and shifted version discard stale stores across deletes and appends | E28, E29, E35, E37 |
| T5 | Oversized or deeply nested body exhausts memory | per-endpoint byte limits before authorisation; strict schemas | E9 |
| T6 | A regeneration loop or a stale tab drains the shared budget | cap of 5 per session before the model call; version guard before the count; gateway budgets | E39, E42 |
| T7 | Hand-written text carries markup or instructions that later reach other roles' AI contexts | same rule as manual CRUD (endpoints 13, 17, 21): stored as text, no new filter (accepted, same as W5) | accepted |
| T8 | Index confusion after a delete or add leads a client to edit the wrong epic | every change raises the proposal `version`; clients refetch | E33 |
| T9 | Another member PM approves or rejects a proposal while its creator edits | accepted: approve and reject stay member-wide as built (contract: "PM; member"); the version guard makes a stale approve fail; recorded as SD11 | accepted |
| T10 | A list page returns a very large response | size capped at 20; batched queries | E48, N3 |
| T11 | An edit leaves a plan that approve cannot apply (permanent 409) | edits store parsed values and validate the whole plan before commit | E59 |

## 7. Open questions
| Q | Question | Status |
|---|---|---|
| (none) | | |

## 8. Decisions made here
| ID | Decision | Why / rejected | Asked by |
|---|---|---|---|
| SD1 | Operator scope: all generated checkpoints, epics and tasks editable, with add and delete, plus endpoints 36 and 39; chat refinement left out | the operator's brief (2026-11-09). Rejected: edit-only; chat now | operator |
| SD2 | Three new endpoints (58, 59, 60); tasks edited through the epic's task list, checkpoints through the list | fewest endpoints that cover add, change and delete. Rejected: nine per-entity endpoints; one replace-the-whole-plan endpoint (loses per-epic expansion state and races with expansions) | AI default |
| SD3 | Guard every content change with the proposal `version`; every edit and every stored regeneration raises it | one version for the whole draft, so approve creates what the PM saw. Rejected: per-epic versions (the contract's `PlanEpic` has none) | AI default |
| SD4 | Endpoints 38 and 39 answer `PlanProposal` instead of the contract's `PlanEpic`; 39 takes `{ version }` | the client gets the new `version` in one response and a stale tab cannot spend a regeneration. Rejected: `PlanEpic` plus a re-read | AI default |
| SD5 | Regenerate counts only when the epic is DONE; otherwise it behaves as expand | a first expansion is not a regeneration | AI default |
| SD6 | `EDITED` session outcome when any edit happened (not for regenerate alone) | contracts §3.4 row 40 already names it | contracts |
| SD7 | The contract grows to 60 endpoints | needs the other owners' sign-off under AD-11 (additive; 38 and 39 change response shape) | AI default |
| SD8 | Delete is refused while any epic is live `IN_PROGRESS` | a shifted live claim could store tasks onto another epic. Rejected: refusing only the deleted epic; addressing epics by id | Attacker lens |
| SD9 | A failed regenerate keeps the previous tasks and marks the epic `FAILED` | the PM's hand edits are not lost on a model failure; approve stays blocked until the epic is expanded again. Rejected: clearing tasks | Tester lens |
| SD10 | A title or description change on an expanded epic keeps its tasks and status; the UI reminds the PM to create a new epic for a substantial change | the operator's decision (2026-11-09), overriding the contract's "resets expansion to PENDING". Rejected: clearing the tasks; an explicit `discardTasks` flag | operator |
| SD11 | Approve and reject stay member-wide; edits are creator-only | matches the built endpoints and the contract; edits shape the creator's session. Rejected: adding a creator check to 40 and 41 here (changes shipped W7 behaviour) | AI default |
| SD12 | The list size is capped at 20 | each item is a full proposal | Attacker lens |

## 9. Review record
Lenses: Implementer, Tester, Attacker (ownership, untrusted text persisted to domain rows, races). Round 1: 12 blocking and 31 judgement findings, all folded above. Rejected: Attacker J6 option of an explicit `discardTasks` flag (SD10); Attacker J9 option of a creator check on approve and reject (SD11); Implementer J8 (no change needed beyond the stated check order, now in § 4.3).
