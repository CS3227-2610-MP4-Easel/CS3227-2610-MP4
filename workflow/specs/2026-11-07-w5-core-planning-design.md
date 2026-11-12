# W5 Core Planning Design

- **Status:** Approved (operator, 2026-11-08)
- **Format:** v2
- **Risk tier:** High - W5 enforces project tenancy and role ownership while mutating shared planning data.
- **Workstream:** W5 | **Plan:** —
- **Constraints consulted:** `AD-02`, `AD-07`, `AD-09`, `AD-12`, `AD-13`, `AD-14`, `AD-36`, `AD-47`, `AD-62`, `AD-65`, `A-02`, `A-03`, `A-06`, `A-13`; guardrails `AD-55`, typed-SQL and relation-filter constraints; `C48`, `C49`, `C51`; W1 foundation/review-repairs contracts; W4 auth conventions; W6 AI-context conventions.

## 1. Problem

The repository has the Prisma schema, filtered request-facing client, frozen `Core` type, policy map, and API authorization seams, but no `src/be/core` package. `src/be/api/src/deps.ts` still supplies fail-closed `requireMember` and `resolveResource` placeholders, so project-scoped routes cannot authorize or resolve owned resources. W6 is merged and cannot register its core membership seam or four `core.*` context sources until W5 supplies them.

W5 must provide the project, membership, checkpoint, epic, task, task-event, progress, and velocity behavior described by the normative contracts. It serves PMs, Dev Leads, and Developers through the policy-map gate. A caller-supplied project id never establishes ownership; every returned or mutated row is resolved from storage, scoped to a member project, and checked against the project and role rules.

## 2. Goals

**Functional**

- **F1 Core package and frozen seam** - Provide `@agile/core` with `requireMember`, `assertWritable`, `progress`, `velocity`, `applyPlan`, and `applyReplan` matching `contracts.md` §5.4. Accept: the package type-checks against the frozen `Core` interface without changing that interface.
- **F2 Membership authorization** - `requireMember(userId, projectId)` succeeds only for an existing member of an active project and throws a fresh `NotMember` for a missing, non-member, or archived project. For an archived write target, the API may distinguish a member from a non-member through the core's internal membership probe: members receive 409 `CONFLICT_STATE`, non-members receive 404 `NOT_FOUND`. Accept: no non-member can learn whether an archived project exists.
- **F3 Project and membership reads/writes** - Implement endpoints 5, 6, 7, 9, and 10 with the exact request and response schemas in `contracts.md`; endpoint 10 lowercases email before lookup and enforces PM → `DEV_LEAD`, `DEV_LEAD` → `DEVELOPER`. Accept: creator membership, project pages, project details, member lists, and add-member responses match the contract.
- **F4 Checkpoints** - Implement endpoints 12 and 13. Accept: reads are ordered by `targetDate`; creation rejects archived projects and stores the project id from the route scope.
- **F5 Epics** - Implement endpoints 16 and 17. Accept: pages are ordered by `position`, include live task counts and points totals, and reject a checkpoint from another project with 422 `VALIDATION_FAILED`.
- **F6 Tasks and status events** - Implement endpoints 20 through 24. Accept: task relationships are project-checked; creation writes a `CREATED` event; updates write only the specified change events; status and block changes write the exact events in the architecture state table.
- **F7 Resolver registry and API wiring** - Replace API placeholders with core-owned resolvers for project, membership, checkpoint, epic, task, and task-event operations; register `core` and W5's four source ids at the composition root. Accept: a full API boot with W7-W9 modules observes the core and all ten `SOURCE_IDS` from W6, while W5 alone registers exactly its four ids; `core` has no import of `@agile/ai-context`.
- **F8 Apply seams** - `applyPlan` and `applyReplan` validate strict payloads, ignore client project ids, re-check project membership and writability, re-check every referenced id and assignee, and write task events in the caller's transaction. Accept: an invalid or stale apply performs no partial write.

**Non-functional**

- **N1 Tenancy** - All ordinary reads use the filtered client and all child relations are project-scoped by composite keys or explicit service checks. Accept: a cross-project id, archived project, or soft-deleted row never appears in a response or mutation.
- **N2 Concurrency** - Mutable updates use atomic `version` compare-and-increment; every mutation uses one `RepeatableRead` transaction and retries at most twice for serialization/deadlock errors using `inMutationTransaction`. Accept: concurrent writers produce one success and one 409 `CONFLICT_VERSION`, with no lost update or partial event.
- **N3 Boundary discipline** - `src/be/api` performs no table query, `src/be/core` owns only core tables, and no request-facing module uses raw SQL or maintenance access. Accept: import-boundary and source-scan tests pass.
- **N4 Deterministic derived values** - Progress and velocity are computed from live core rows, not stored copies or model output. Accept: the formulas in architecture §11 produce the same result for the same database snapshot.

## 3. Non-goals

- Endpoint 8 project update, endpoint 11 member removal, endpoints 14-15 checkpoint mutation, endpoints 18-19 epic mutation, endpoint 25 task deletion, endpoint 26 task-event listing, endpoints 27-33 sprint behavior, and endpoint 33 progress route registration are later slices; W5 supplies the core functions and resolver seams they consume.
- AI prompts, gateway calls, proposals, sessions, role-feature routes, and context assembly are not implemented here; W5 only registers the four core context sources required by W6 (`AD-25`, `C61`).
- No Prisma schema or migration change is planned; all W5 entities and constraints already exist in `src/be/db/prisma/schema.prisma` and the initial migration.
- No UI changes, seed data, deployment settings, or archived-data maintenance access.

## 4. Design

### 4.1 Approach

Use one `src/be/core` workspace package (`@agile/core`) for behavior over `Project`, `ProjectMember`, `Checkpoint`, `Epic`, `Task`, and `TaskEvent`. Export typed domain operations and resolver adapters; keep the API package as composition and HTTP translation only. The API composition root injects the core into authorization and registers the W6 sources, preserving the dependency direction `ai-context → core → db` and `roles → ai-context`. Rejected alternatives are recorded in §8.

### 4.2 Data model

The existing models are authoritative. `Project` is ACTIVE or ARCHIVED; archived projects are read-only and invisible to ordinary filtered reads. `Checkpoint`, `Epic`, and `Task` are soft-deletable and carry `version`; `Epic` optionally references one checkpoint through `(projectId, checkpointId)`; `Task` references an epic, optional sprint, and optional member assignee through composite project-aware foreign keys. `TaskEvent` is append-only and records task, project, actor, event type, from value, to value, and UTC time. `ProjectMember` is keyed by `(projectId, userId)`.

No migration, seed regeneration, or rollback transform is required. If implementation discovers schema drift, it stops and amends the spec rather than altering an existing migration. Every mutation either commits all row and event changes or rolls back all of them.

State rules are fixed: task status may move between any two distinct contract statuses, including the initial unstarted status; entering the terminal done status sets `doneAt`, leaving it clears `doneAt`; blocked is independent and requires a non-empty reason; a task in a CLOSED sprint is fully frozen and no task mutation is accepted. Progress counts live tasks with points, counts unestimated live tasks separately, and uses zero percent when total points are zero. `percent` is `0` when `pointsTotal` is zero, otherwise `pointsDone / pointsTotal * 100` with no additional rounding. Velocity rows are `{ sprintId, name, completedPoints }` for closed sprints, newest `endDate` first and `sprintId` ascending as the tie-breaker.

### 4.3 Interfaces

| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors (condition -> type/message) | Notes |
|---|---|---|---|---|---|
| `requireMember(userId, projectId)` | API gate and AI context | UUIDs | `Promise<void>` | missing, non-member, or archived -> fresh `NotMember` | active-project membership only; no transaction required |
| `assertWritable(projectId)` | every core mutation and apply seam | any project UUID | `Promise<void>` | missing -> `NOT_FOUND`; archived -> `CONFLICT_STATE` | reads project state through the approved core/db seam before the write |
| `resolveResource(operationId, request, tx?)` | API authorization | operation id plus parsed route request | `Promise<ResolvedResource \| null>` | malformed path id, missing, non-visible, soft-deleted, or archived read target -> `null`; archived write target -> `{ state: "ARCHIVED" }` | never throws `NOT_FOUND`; derives all scope fields from storage |
| `POST /api/pm/projects` | registered PM | `{ name: 1..200, brief?: null or <=4000 }`, strict keys | 201 `Project` | schema -> 422 `VALIDATION_FAILED`; storage failure -> 500 | one `RepeatableRead` transaction creates ACTIVE project and creator membership; creator is `addedBy` |
| `GET /api/projects` | any registered role, member projects | `page` integer 0+, `size` integer 1..100, defaults 0/20, optional `status` `ACTIVE`/`ARCHIVED` | 200 `{ items, page, size, total }` of `ProjectDetail` | invalid query -> 422 `VALIDATION_FAILED` | newest `createdAt` first, `id` descending tie-breaker; archived rows remain excluded by filtered visibility |
| `GET /api/projects/{projectId}` | any registered member | UUID path | 200 `ProjectDetail` | hidden/non-member/archived -> 404 `NOT_FOUND` | includes computed progress |
| `GET /api/projects/{projectId}/members` | any registered member | UUID path | 200 `Member[]` | hidden/non-member/archived -> 404 `NOT_FOUND` | `addedAt` ascending, `userId` ascending tie-breaker; no email or Firebase id |
| `POST /api/projects/{projectId}/members` | PM or Dev Lead member, permitted adder | `{ email: valid email }`, trim then lowercase before lookup | 201 `Member`; repeated existing member returns 200 same body | unregistered target or role not addable -> 422 `VALIDATION_FAILED`; hidden project -> 404 | PM may add only `DEV_LEAD`; Dev Lead may add only `DEVELOPER`; target role comes from `users`; one transaction and unique-race re-read |
| `GET /api/projects/{id}/checkpoints` | any registered member | UUID path | 200 `Checkpoint[]` | hidden/non-member/archived -> 404 `NOT_FOUND` | `targetDate` ascending, `id` ascending tie-breaker |
| `POST /api/projects/{id}/checkpoints` | PM or Dev Lead member | `{ name: 1..200, targetDate: valid YYYY-MM-DD }`, strict keys | 201 `Checkpoint` | schema -> 422 `VALIDATION_FAILED`; archived -> 409 `CONFLICT_STATE` | one transaction inserts one live checkpoint |
| `GET /api/projects/{id}/epics` | any registered member | `page`/`size` defaults 0/20, size max 100 | 200 page of `Epic` | hidden/non-member/archived -> 404 `NOT_FOUND` | `position` ascending, `id` ascending tie-breaker; live task count and points total are computed from live tasks |
| `POST /api/projects/{id}/epics` | PM or Dev Lead member | `{ title: 1..200, description?: null or <=4000, checkpointId?: UUID or null }`, strict keys | 201 `Epic` | checkpoint missing/deleted/cross-project -> 422 `VALIDATION_FAILED`; archived -> 409 `CONFLICT_STATE` | one transaction locks the project row before choosing the next position; composite FK is authoritative |
| `GET /api/projects/{id}/tasks` | any registered member | optional UUID filters `epicId`, `sprintId`, `assigneeId`; optional enum `status`, boolean `blocked`; `page`/`size` defaults 0/20, size max 100 | 200 page of `Task` | hidden/non-member/archived -> 404; invalid or cross-project filter -> 422 `VALIDATION_FAILED` | `createdAt` descending, `id` descending tie-breaker; filters are combined with AND |
| `POST /api/projects/{id}/tasks` | PM or Dev Lead member | `epicId` UUID, title 1..200, nullable description <=4000, acceptance criteria 0..12 × 300, story points null or 1/2/3/5/8/13, optional member `assigneeId`; strict keys | 201 `Task` | epic/assignee missing, deleted, or outside project -> 422 `VALIDATION_FAILED`; archived -> 409 `CONFLICT_STATE` | one transaction; starts in the contract's unstarted status and unblocked; writes `CREATED` event in same transaction |
| `GET /api/tasks/{id}` | any registered member | UUID path | 200 `Task` | hidden/cross-project/deleted/archived -> 404 `NOT_FOUND` | resource resolver supplies project and assignee |
| `PATCH /api/tasks/{id}` | PM or Dev Lead member | strict partial allowlist `{ title?, description?, acceptanceCriteria?, storyPoints?, epicId?, assigneeId?, sprintId?, version }`; `version` required; status/block fields forbidden | 200 `Task` | stale version -> 409 `CONFLICT_VERSION`; invalid relation -> 422 `VALIDATION_FAILED`; CLOSED sprint -> 409 `CONFLICT_STATE` | one transaction; omitted fields preserve; null allowed only for description, assignee, sprint; change events are emitted in field order: points, assignee, sprint |
| `POST /api/tasks/{id}/status` | Dev Lead member or assigned Developer | `{ status, version, blocked?, blockedReason? }`; strict keys; omitted blocked fields preserve current values; `blocked=true` requires non-empty reason; `blocked=false` clears reason | 200 `Task` | stale version -> 409 `CONFLICT_VERSION`; blocked without reason or reason without a block change -> 422 `VALIDATION_FAILED`; CLOSED sprint -> 409 `CONFLICT_STATE` | one transaction; status event precedes block event; no-op preserves version and emits no event |
| `progress(projectId)` | core consumers after policy membership | active project UUID | `{ pointsTotal, pointsDone, percent, unestimatedTasks }` | missing, non-member, or archived -> `NOT_FOUND` | filtered-client live tasks only; write callers invoke `assertWritable` separately |
| `velocity(projectId, n)` | core and future lead consumers after policy membership | active project UUID; `n` integer 1..100 | `{ sprintId, name, completedPoints }[]` | missing, non-member, or archived -> `NOT_FOUND`; invalid `n` -> `RangeError("INVALID_VELOCITY_LIMIT")` | filtered-client closed sprints only; no more than `n` rows |
| `applyPlan(tx, projectId, plan, actorId)` | proposals approval, actor must be PM | strict: max 50 checkpoints; max 50 epics; max 50 tasks per epic; names/titles 1..200; descriptions 0..4000; checkpoint dates valid calendar dates; acceptance criteria 0..12 × 300; story points null or 1/2/3/5/8/13; optional assignee UUID; any embedded project id is ignored | `void` | malformed -> `VALIDATION_FAILED`; actor not PM -> `FORBIDDEN_ROLE`; invalid/stale relation or archived project -> `CONFLICT_STATE` | caller supplies a `RepeatableRead` transaction run through `inMutationTransaction`; creates checkpoints/epics/tasks and one `CREATED` event per task; proposal row lock prevents replay |
| `applyReplan(tx, projectId, suggestions, actorId)` | Dev Lead approval, actor must be Dev Lead | max 100 strict suggestions: `MOVE_CHECKPOINT_DATE { id, checkpointId, newTargetDate, rationale<=300 }`; `MOVE_EPIC_TO_CHECKPOINT { id, epicId, checkpointId|null, rationale<=300 }`; `REASSIGN_TASK { id, taskId, assigneeId, rationale<=300 }`; no expected-version field exists in the frozen suggestion shape | `void` | malformed -> `VALIDATION_FAILED`; actor not Dev Lead -> `FORBIDDEN_ROLE`; target deleted, moved, closed, or no longer in project -> `CONFLICT_STATE` | caller supplies a `RepeatableRead` transaction run through `inMutationTransaction`; task reassignments emit `ASSIGNEE_CHANGED`; all changes roll back together |
| Core context sources | W6 `assembleWith` | frozen source args; target project and caller supplied by W6 | rows with `projectId`, `ref`, `ownerId`, `text` | source failure is surfaced to W6; no error details in rows | W5 registers exactly four ids: `core.projectBrief`, `core.checkpoints`, `core.taskEvents`, `core.blockedTasks`; all use filtered reads, active target project, storage-derived ownership, and fixed ordering/limits from W6 |

**Resolver registry.** `createCoreResourceResolvers(db)` returns the frozen `ResourceResolverRegistry` for these operation ids: `PROJECT_LIST` returns an active member `PROJECT_SET`; `PROJECT_READ`, `PM_PROJECT_UPDATE`, and `PROJECT_MEMBER_LIST` resolve `PROJECT`; `PROJECT_MEMBER_ADD` resolves `PROJECT` plus the target user's storage-derived `targetRole`; `PROJECT_MEMBER_REMOVE` resolves `MEMBERSHIP` plus target role; `CHECKPOINT_LIST`, `CHECKPOINT_CREATE`, `EPIC_LIST`, `EPIC_CREATE`, `TASK_LIST`, `TASK_CREATE`, `TASK_READ`, `TASK_UPDATE`, and `TASK_STATUS_UPDATE` resolve their named core resource; `TASK_EVENT_LIST` resolves its task-event project. Core-owned resolvers return `null` for malformed, missing, soft-deleted, hidden, or archived read targets. For an existing archived write target they return the resource with `state: "ARCHIVED"`; the API authorization middleware returns 409 before membership evaluation. The policy map remains unchanged.
The constructor dependencies are explicit: `projectDb` is the filtered request-facing client; `lookupUserByEmail(email)` and `lookupUserRole(userId)` are auth-owned functions supplied by composition; sprint state is read directly because `Sprint` is core-owned. No core function reads the `users` table through a second client.

The HTTP-facing core service methods take `{ userId, role }` from the authorized principal and reject a missing or mismatched actor with `FORBIDDEN_ROLE`; they call `requireMember` and `assertWritable` inside their mutation transaction. Project creation is PM-only; checkpoint, epic, and task creation/update are PM or Dev Lead; task status is Dev Lead or assigned Developer. This internal actor contract is separate from the frozen cross-module `Core` interface and prevents direct service calls from bypassing the policy gate.

**Authorization precedence.** The API resolves the resource after token and registered-user checks. A malformed protected request without a valid token is 401; a wrong role is 403. If the resolver returns an archived write target, authorization calls the internal membership probe without the active-project visibility filter: a member gets 409 `CONFLICT_STATE`, and a non-member gets 404 `NOT_FOUND`. All other missing, soft-deleted, archived-read, or non-member resources are 404; only then does the handler parse its body/query and execute. A malformed path id is therefore 404 from resource resolution; malformed query/body input is 422 after authorization. Direct core calls use the domain errors in the table.

**Mutation boundaries.** Project creation, member add, checkpoint create, epic create, task create, task patch, and task status update each run as one `inMutationTransaction` transaction. A task row and every event from that request commit together. Member add re-reads the existing composite key after a unique race and returns 200. Epic creation locks the project row before calculating `max(position)+1`. A project archive race is resolved by the mutation transaction's final active-state check; if the project is archived before commit, the transaction rolls back with `CONFLICT_STATE`. `inMutationTransaction` retries at most twice for `P2034` or `40001`; it never retries validation, authorization, or unique-key errors.

**Task events.** The actor is the authenticated principal's `userId`; `from` and `to` are the canonical enum or scalar string values, and `at` is the database UTC timestamp. A task PATCH may change only the listed fields; status, blocked, and blockedReason belong only to the status endpoint. A status request with both a status and block change writes `STATUS_CHANGED` first, then `BLOCKED` or `UNBLOCKED`; a reason-only change is rejected. A same-value request is a no-op and does not increment `version`. Existing `TaskEventType` has no event for title, description, acceptance-criteria, or epic changes; those fields are intentionally not evented by W5. Events are the complete audit trail for event-bearing task fields, not a general audit log; W5 adds no audit table for project, membership, checkpoint, or epic changes, and authorization logs contain only operation id, outcome, request id, and resource id.

**Context source contracts.** `core.projectBrief` returns at most one target-project `PROJECT` row, max 4300 characters, with `text = brief` and no row when brief is null or empty. `core.checkpoints` returns at most 50 target-project `CHECKPOINT` rows, max 300 characters each, with `text = targetDate + ": " + name`, ordered by target date then id. `core.taskEvents` returns at most 200 target-project rows owned by the caller, max 400 characters each, with `text = at.toISOString() + " " + type + " " + (from ?? "") + " -> " + (to ?? "")`, newest event time then event id. `core.blockedTasks` returns at most 50 target-project `TASK` rows assigned to the caller, max 800 characters each, with `text = title + ": " + blockedReason`, newest task creation time then task id. An out-of-scope caller produces an empty result after `requireMember`; an unexpected database error throws `CORE_SOURCE_FAILED:<sourceId>`. All four use filtered reads, derive `projectId`, `ownerId`, and text from stored rows, and return `trusted: false` through W6's allow-list; W6 performs defense-in-depth row checks.

### 4.4 UI

None: W10 owns the UI. W5 exposes the HTTP response shapes and error codes consumed by the existing screens.

### 4.5 Conventions

- All authorization goes through the policy map; handlers do not check roles (`AD-55`).
- API resource ownership is resolved by the owning core module, never from a client project id; missing or out-of-scope resources return 404 without existence confirmation.
- Request-facing reads use the filtered client. Core never imports `maintenance.ts`, uses raw SQL, or relies on unvalidated relation filters to hide archived related rows.
- `requireMember` lives in `core` despite the narrative architecture table listing it under `auth` (`C48`, `C49`, W6 SD11). `core` must not import `@agile/ai-context`.

### 4.6 Sequencing constraints

The planner must create the `@agile/core` package and its exports before API dependency wiring or W6 source registration. Resolver adapters and route handlers share the operation-id policy map; the policy map itself is frozen and must not be changed. Any task that edits `src/be/api/src/deps.ts` or `src/be/api/src/routes/index.ts` must preserve W4 auth wiring and W6 registration. No implementation task may change the Prisma schema without a spec amendment.

## 5. Edge cases

| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F2, N1 | Caller is not a member, or an archived project is read | `requireMember` throws `NotMember`; API returns 404 `NOT_FOUND`; no source or handler runs | core/API |
| E2 | F3 | PM creates a project | Project and creator membership commit together; membership `addedBy` equals creator | integration |
| E3 | F3 | Add-member email has uppercase characters | Lookup uses lowercase email; stored user identity is unchanged | unit/API |
| E4 | F3 | Target user is missing or has an unaddable role | Return 422 `VALIDATION_FAILED`; no membership row is written | API/integration |
| E5 | F3 | Add an already-existing member | Return 200 with the existing `Member`; do not duplicate the composite key | integration |
| E6 | F3, N1 | Resolver receives a child id from another project | Resolver returns `null`; API returns 404 `NOT_FOUND`; never return the child or run the handler | authorization |
| E7 | F4-F6 | Member mutation targets an existing archived project | Internal membership probe succeeds; API returns 409 `CONFLICT_STATE` before body handling; no row or event changes | integration |
| E8 | F5 | Epic checkpoint belongs to another project | Return 422 `VALIDATION_FAILED`; no epic is written | integration |
| E9 | F6 | Task epic or assignee belongs to another project | Return 422 `VALIDATION_FAILED`; no task or event is written | integration |
| E10 | F6 | Task is created without points and later assigned to a sprint | Reject with 422 `VALIDATION_FAILED` | unit/integration |
| E11 | F6 | Blocked task has null or empty reason | Reject with 422 `VALIDATION_FAILED` | unit |
| E12 | F6 | Task status changes to DONE then reopens | Set `doneAt` on DONE; clear it on reopen; write one status event each time | integration |
| E13 | F6 | Block flag changes without status change | Write `BLOCKED` or `UNBLOCKED` only; preserve status | integration |
| E14 | F6 | Any task mutation targets a task in a CLOSED sprint | Return 409 `CONFLICT_STATE`; no task or event changes, including title, description, block, points, sprint, status, or assignment | integration |
| E15 | F6, N2 | Two requests use the same task version | Exactly one succeeds; the other returns 409 `CONFLICT_VERSION`; no event is duplicated | concurrency |
| E16 | F6 | A patch leaves a field unchanged | Do not emit its corresponding change event | unit/integration |
| E17 | F5-F6 | Soft-deleted child is queried | Filtered client returns no row; a targeted endpoint returns 404 `NOT_FOUND`, and a list omits the row | integration |
| E18 | F3-F6 | Invalid pagination, enum, query UUID, unknown key, or server-managed field in query/body | Return `{ error: { code: "VALIDATION_FAILED", message: "The request body is not valid.", details: [{ field, message }], requestId } }` with 422 before mutation | API |
| E19 | F7 | Core or one of the four W5 source ids is not registered at boot | Boot test fails; production composition does not silently start with a missing source. Full boot also requires the ten W6 ids: `core.projectBrief`, `core.checkpoints`, `core.taskEvents`, `core.blockedTasks`, `pm.similarItems`, `lead.facts`, `lead.changes`, `lead.previousDigest`, `dev.activityItems`, `dev.itemSummaries` | boot |
| E20 | F8, N2 | Apply payload contains cross-project ids or invalid assignee | Supplied transaction rolls back all changes and events; `CONFLICT_STATE` is returned by the approving route | integration |
| E21 | N3 | API or core attempts raw SQL/maintenance access | Source/import-boundary test fails; request path has no access | static |
| E22 | N4 | Project has no estimated points | Progress returns `pointsTotal=0`, `pointsDone=0`, `percent=0`, and the exact unestimated count | unit |
| E23 | F1 | Consumer imports `Core` from the frozen contracts package | `@agile/core` exposes an assignable implementation without changing the frozen interface or adding a second incompatible signature | typecheck |
| E24 | F8 | Same proposal approval is replayed after the first approval | Proposal row lock sees terminal `APPROVED`; caller returns the stored approval result and does not call `applyPlan` or duplicate rows | integration |
| E25 | F8, N2 | Apply contains malformed shape, wrong actor role, stale relation, or archived project | `VALIDATION_FAILED`, `FORBIDDEN_ROLE`, or `CONFLICT_STATE` respectively; supplied transaction rolls back; no partial row or event remains | integration |
| E26 | F6, N2 | Event insert fails after task update or both status and block change are requested | Entire transaction rolls back; status, block state, version, and all events remain unchanged; on success event order is status then block | integration |
| E27 | F3, N2 | Two add-member requests race for the same target | One inserts; the other re-reads and returns 200 with the same member; exactly one membership row exists | concurrency |
| E28 | F5, N2 | Two epic creates race for the next position | Project-row serialization gives distinct positions; both commits contain one live epic | concurrency |
| E29 | F6 | Task PATCH supplies status or blocked fields, or status call supplies only a reason | Strict schema rejects with 422 `VALIDATION_FAILED`; no version or event changes | API |
| E30 | F6 | Task PATCH references a deleted/cross-project epic, sprint, or assignee | Return 422 `VALIDATION_FAILED`; no task or event changes | integration |
| E31 | F7 | A context source receives a non-member, archived, or wrong-project request | Source returns no rows or its fixed failure; it never returns data outside the active target and caller scope | source |
| E32 | F7 | A context source returns more than its max rows or an oversized text row | Source truncates its result to the fixed limit before returning; W6 rejects any remaining contract violation | source |
| E33 | N4 | Progress is read during a committed multi-row mutation | The read sees one database snapshot: before or after the transaction, never a partial state | integration |
| E34 | F3-F6 | Non-member probes an archived mutation target | Internal membership probe fails; API returns 404 `NOT_FOUND`, identical to a missing project | authorization |
| E35 | F3-F6 | Malformed path UUID reaches a resolver | Resolver returns `null`; API returns 404 `NOT_FOUND`; malformed query/body values remain 422 | authorization |
| E36 | F8 | Re-plan target changes after proposal creation | Missing/deleted/moved target or changed project membership returns `CONFLICT_STATE`; no suggestion is applied; no version field is inferred | integration |
| E37 | F6 | Direct core service call has no actor or wrong role | Service returns `FORBIDDEN_ROLE`; no membership, project, task, or event write occurs | unit |
| E38 | F7 | Source renders stored text beyond its contract limit | Source emits only rows whose exact renderer is within its fixed max; it omits an over-limit row rather than truncating stored text | source |

### What could corrupt data

- A cross-project child or assignee could be attached to a task; composite foreign keys and service-level checks reject it (E8-E10, E20).
- A stale task update could overwrite newer data or duplicate an event; atomic version checks reject the loser (E15-E16).
- An archived project could receive a write; `assertWritable` rejects it before mutation (E7, E14).
- A partial plan or re-plan apply could leave some rows committed; the supplied transaction rolls back all rows and events (E20).
- A missing policy or resolver could expose a resource; boot, parity, and import-boundary tests fail closed (E19, E21).

## 6. Security

Every listed endpoint requires a registered Firebase principal before schema parsing; the policy map enforces the role and predicate, and core enforces project membership and writable state. Project, child, member, assignee, and target-role values come from storage. Inputs are strict schemas with the contract limits; email is normalized before lookup; no request text, token, or secret is logged. Core sources return only rows within the requested project and caller ownership scope, and W6 performs the final context checks.

| Operation group | Principal / authorization | Tenancy and validation | Evidence |
|---|---|---|---|
| Project list/detail/member reads | registered principal; `MEMBER` or `MEMBER_PROJECTS` policy | active member projects only; UUID and pagination schemas; archived/hidden -> 404 | E1, E6, E17, E18 |
| Project/checkpoint/epic/task creates | registered PM or Dev Lead; policy role plus `MEMBER` | active project; strict lengths, enums, UUIDs, composite relations; `assertWritable` in transaction | E7-E10, E18 |
| Task patch | registered PM or Dev Lead; `MEMBER` | task project, live relations, version, fully frozen CLOSED sprint | E14-E16, E29-E30 |
| Task status | registered Dev Lead member or assigned Developer; `MEMBER_OR_ASSIGNEE` | task project, status/block schema, version, fully frozen CLOSED sprint | E12-E16, E29 |
| Apply seams | proposals caller with actor id; core re-checks PM for plan or Dev Lead for re-plan and membership | supplied transaction, strict payloads, every target id and assignee in project, writable state | E20, E24-E26 |
| Core context sources | W6-authorized caller; source receives frozen caller and target | filtered client, active target, own rows where allow-list says `own`, fixed row/text caps | E31-E32 |

Public API validation errors use the existing error envelope: `VALIDATION_FAILED` 422 with the fixed message and field details; authorization errors never include whether a hidden resource exists. Core domain errors are converted by the owning route; core does not log payloads.

Threats and mitigations:

| Actor / abuse | Mitigation | Evidence |
|---|---|---|
| Non-member guesses project or child UUID | filtered reads, `requireMember`, composite project keys, 404 without confirmation | E1, E6, E17 |
| Caller submits another project's epic, checkpoint, sprint, or assignee | explicit relation checks plus composite foreign keys | E8-E10, E20 |
| PM or Dev Lead adds a user outside the role hierarchy | target role is resolved from the registered user; `ADDER` rejects mismatch | E4 |
| Concurrent writer overwrites task or duplicates events | atomic version update and one mutation transaction | E15, E16 |
| Caller writes archived data | `assertWritable` before every mutation, including apply seams | E7, E14, E20 |
| API bypasses policy or core table ownership | route registration parity, import boundary, and boot tests | E19, E21 |
| Malicious stored text reaches an AI prompt as trusted data | core sources are untrusted except the structured facts source owned by W8; W5 sources never call the gateway | E19 plus W6 source tests |
| Replayed approval duplicates tasks or events | proposal row lock and terminal-state check make the second request return the stored result | E24 |
| Context source leaks a non-member's task event or blocked task | storage-derived ownership, filtered reads, and fixed source scopes reject it | E31 |

## 7. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|

None.

## 8. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | W5 is one `@agile/core` package; API only composes it and `core` does not import AI context | Preserves A-03 and C51 package boundaries. Rejected: putting membership in `auth` or letting API query tables, which contradicts C48/C49 and the import boundary | Codex recommendation, operator said “Proceed” |
| SD2 | W5 implements endpoints 5-7, 9-10, 12-13, 16-17, and 20-24; it supplies resolver seams for later core endpoints without implementing those routes | Matches the slicing table and keeps sprint, delete, and later mutation surfaces in their assigned slices. Rejected: pulling all 5-33 endpoints into W5, which would expand the Tier 1 slice beyond its recorded boundary | Codex recommendation |
| SD3 | No schema migration is part of W5 | W1 already created the complete core schema and composite constraints. Rejected: changing schema to simplify service checks, which would require a separate migration gate | Codex recommendation |
| SD4 | `requireMember` treats archived projects as `NotMember`; API archived writes use an internal membership probe so members receive `CONFLICT_STATE` and non-members receive indistinguishable `NOT_FOUND` | Preserves W6's frozen membership contract and removes an archived-project existence oracle. Rejected: returning 409 before membership for every caller | Existing C48/C49 and W6 SD11 |
| SD5 | W5's four context sources are the only source registrations owned by W5; the full ten-source boot check belongs to composition after W7-W9 load | Prevents W5 from registering another workstream's tables while making the W6 handover testable | W6 source registry |
| SD6 | Existing task-event enum is not expanded; non-evented task fields are not claimed as audited | Avoids an unplanned schema migration and preserves the frozen event vocabulary. Rejected: inventing an `EPIC_CHANGED` or general audit event without a schema decision | Existing schema and architecture §11 |

## 9. Review record

Lenses: Implementer, Tester / QA, Attacker / abuser, Maintainer | Rounds: 2 | Rejected findings: Round 1 findings were fixed in §§4.3, 5, and 6: archived precedence, source ownership, resolver mapping, transaction boundaries, apply payloads, task events, and replay/concurrency cases. Round 2 reported no remaining issues after the final amendments.
