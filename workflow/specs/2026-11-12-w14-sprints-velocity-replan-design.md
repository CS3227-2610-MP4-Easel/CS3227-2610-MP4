# W14 Design — Sprints, Velocity and Re-plan

- **Status:** Draft
- **Format:** v2
- **Risk tier:** High — multi-user state transitions, role-gated mutations, and transactional task movement
- **Workstream:** W14
- **Plan:** —
- **Constraints consulted:** AD-06, AD-07, AD-09, AD-10, AD-12, AD-22, AD-35, AD-36, AD-40, AD-45, AD-49, AD-55; A-02, A-06, A-13, A-14, A-19; C20, C48, C49

## 1. Problem

The W5 core package supplies planning entities and the frozen `Core` seam, and W8 supplies
Dev Lead facts, digest and re-plan proposal behavior. The `proposals` owner of `ai_proposals`
and its claim/apply protocol is not yet exposed for W14 transport. The W14 HTTP surface is not yet
implemented: endpoints 27–32 must manage sprint state and endpoint 33 must expose progress;
endpoints 46–48 must list, approve and reject Dev Lead re-plan proposals. Without these
operations, teams cannot close sprint history, compute velocity, or apply the bounded
re-planning suggestions already represented by the architecture and contracts.

W14 must keep table ownership in `core` for projects, sprints, tasks and task events, and in
`lead` for re-plan proposals and digest-related behavior. Derived progress, velocity and
forecast values remain code-computed; the model may explain or suggest changes but may not
compute or directly apply them (AD-12, AD-22).

## 2. Goals

- **F1 List sprints:** Endpoint 27 returns a bounded page of live, project-scoped sprints ordered by `startDate ASC, id ASC` and excludes soft-deleted rows. **Accept:** a member receives only the target project's visible page with exact `page`, `size` and `total` metadata.
- **F2 Create a planned sprint:** Endpoint 28 validates name and inclusive dates, rejects reversed or overlapping dates, requires an active project member with `LEAD` role, and returns 201. **Accept:** valid input creates exactly one PLANNED sprint; invalid input creates none.
- **F3 Edit a planned sprint:** Endpoint 29 accepts name/date changes with optimistic versioning and rejects every non-PLANNED sprint with `CONFLICT_STATE`. **Accept:** a matching version updates once and a stale version leaves the row unchanged.
- **F4 Start one planned sprint:** Endpoint 30 atomically transitions one sprint to ACTIVE and rejects a project with another ACTIVE sprint. **Accept:** at most one ACTIVE sprint commits per project.
- **F5 Close an active sprint:** Endpoint 31 atomically records completed points, moves every non-DONE task to the requested backlog or planned sprint, writes `SPRINT_CHANGED` events, and transitions the sprint to CLOSED. **Accept:** a successful close changes all required rows and events together; any validation failure changes none.
- **F6 Delete a planned sprint:** Endpoint 32 soft-deletes only a PLANNED sprint and moves its tasks to the backlog in one transaction. **Accept:** deleted sprint tasks have `sprintId=null` and no active sprint row is deleted.
- **F7 Expose project progress and velocity:** Endpoint 33 returns exact live progress and closed-sprint velocity using the contract shape and AD-12 formulas. **Accept:** fixtures with zero, unestimated, DONE and closed-sprint tasks return the exact derived values.
- **F8 List Dev Lead re-plan proposals:** Endpoint 46 returns the caller's member-project proposals with optional status filtering and pagination, newest first. **Accept:** no proposal outside the caller's active member projects is returned.
- **F9 Approve selected suggestions:** Endpoint 47 atomically applies the requested suggestion subset after rechecking project scope, current state, assignee membership, role and writability; stale suggestions cause 409 with no partial apply. **Accept:** all selected suggestions apply or none do.
- **F10 Reject a pending proposal:** Endpoint 48 transitions a pending proposal to REJECTED with optimistic versioning and closes its session as REJECTED. **Accept:** repeated or stale rejection returns 409 and does not alter the committed result.
- **N1 Preserve tenancy and authorization:** Every route passes through the policy map and resolves resources through the owning module; no handler performs an ad hoc role check. **Accept:** route and source-scan tests prove role and project boundaries.
- **N2 Preserve transaction safety:** Sprint close, sprint delete and approved re-plan are all-or-nothing transactions with retry-safe state checks. **Accept:** injected write failures leave all affected rows at their prior state.
- **N3 Bound request and query work:** List endpoints use the existing page/size bounds; mutations cap arrays and strings at the frozen contract limits. **Accept:** oversized requests fail before a write or unbounded read.
- **N4 Keep modules testable:** `core` contains sprint and derived-value rules; `lead` contains re-plan proposal behavior; API code only parses, composes and maps errors. **Accept:** module and contract checks pass without cross-owner table imports.
- **N5 Preserve request observability:** W14 errors and mutation outcomes carry the existing request id, operation, status and stable code without sensitive payloads. **Accept:** route tests and captured logs show request correlation and no credentials, tokens, prompts, proposal payloads or user text.

## 3. Non-goals

- Changing the Prisma entity model or adding a new W14 table; existing `sprints`, `tasks`,
  `task_events` and `ai_proposals` contracts are sufficient unless implementation evidence
  proves otherwise.
- Changing story-point values, task statuses, sprint statuses, date semantics, or forecast
  formulas (AD-12, AD-45, A-19).
- Allowing PM or Developer sprint mutations; the policy map remains authoritative (AD-55).
- Letting the LLM calculate velocity, progress, forecast dates, or apply suggestions directly.
- Adding background jobs, schedulers, queues, or automatic sprint closure (AD-06).
- Adding new screens or changing the W10 navigation; W14 defines backend contracts consumed by
  the existing shell.

## 4. Design

### 4.1 Approach

The chosen approach is the architecture-aligned split approved by the operator on 2026-11-12:

- `core` owns sprint CRUD, sprint lifecycle transactions, progress, velocity and task movement.
- `proposals` owns `ai_proposals`, proposal state transitions, row locking and session closure.
- `lead` owns facts/digest routes and is the role-facing façade that delegates re-plan operations
  to `proposals` and `core`.
- `src/be/api` registers routes and composes the injected `core` and `lead` services.
- The policy map performs route-level role and ownership gating; domain services enforce
  project membership, writability, resource scope and mutation invariants.

W14 adds a narrow `SprintService` owned by `core`; it does not widen the frozen `Core` object
contract. Rejected: a new W14 coordinator package, because it would duplicate the established
module boundaries; letting `lead` own proposal rows, because architecture §4 assigns `ai_proposals`
to `proposals`; extending unrelated W5/W8 files without a domain split, because it would mix table
ownership and make transaction tests ambiguous.

### 4.2 Data model

No new logical entities or schema fields are introduced. W14 requires no migration, backfill or
seed change; rollback is code rollback to the previous route/service implementation because all
W14 writes use existing columns and transactions. Deployment verification runs the existing
contract, Prisma and integration checks against the same schema. Recovery uses the project's
existing manual DB restore process; W14 introduces no restore target.

- `Sprint`: existing `id`, `projectId`, `name`, inclusive `startDate`/`endDate`, `status`,
  nullable `completedPoints`, timestamps, version and soft-delete marker. Legal transitions:
  `PLANNED → ACTIVE → CLOSED`; `PLANNED → deleted`. No other transition is legal.
- `Task`: existing `sprintId`, `status`, `storyPoints`, version and project-scoped relations.
  A task in a CLOSED sprint cannot change sprint, points or status (A-14).
- `TaskEvent`: append-only events written in the same transaction as task movement.
- `ReplanProposal`: existing `REPLAN` proposal rows and suggestion payloads owned by `proposals`.
  Lifecycle is `PENDING → APPROVED`, `PENDING → REJECTED`, or `PENDING → SUPERSEDED`; terminal
  states do not change. A newer pending REPLAN for the same project supersedes the previous pending
  REPLAN, and archiving the project supersedes its pending proposals.

No migration, backfill, seed regeneration or rollback procedure is required by the design.

### 4.3 Interfaces

| Operation | Caller and input | Output | Errors and transaction |
|---|---|---|---|
| `GET /api/projects/{id}/sprints` | Any authenticated member; `page` defaults 0 and `size` defaults 20, size 1–100 | 200 page `{ items: Sprint[], page, size, total }` ordered by `startDate ASC, id ASC` | 404 for hidden/missing/non-member project; invalid page/size -> 422; read-only |
| `POST /api/projects/{id}/sprints` | LEAD member; `{ name: 1..200, startDate: date, endDate: date }` | 201 PLANNED sprint | 422 invalid date/overlap; 404 hidden project; insert transaction |
| `PATCH /api/sprints/{id}` | LEAD member; at least one of name/dates plus positive `version` | 200 sprint | stale version -> 409 `CONFLICT_VERSION`; non-PLANNED/archived -> 409 `CONFLICT_STATE`; invalid/overlap -> 422; update transaction excludes the current sprint from overlap checks |
| `POST /api/sprints/{id}/start` | LEAD member; `{ version }` | 200 ACTIVE sprint | stale version -> 409 `CONFLICT_VERSION`; non-PLANNED, archived or existing ACTIVE sprint -> 409 `CONFLICT_STATE`; transaction locks project/sprint state |
| `POST /api/sprints/{id}/close` | LEAD member; `{ version, carryOver: [{ taskId: UUID, to: "BACKLOG" or plannedSprintId: UUID }] }`, one entry for each non-DONE task | 200 CLOSED sprint | stale version -> 409 `CONFLICT_VERSION`; non-ACTIVE/archived/race -> 409 `CONFLICT_STATE`; missing/duplicate/invalid carry-over or invalid target -> 422; one transaction for points, task moves, events and close |
| `DELETE /api/sprints/{id}?version=` | LEAD member | 204 | stale version -> 409 `CONFLICT_VERSION`; non-PLANNED/archived -> 409 `CONFLICT_STATE`; one transaction soft-deletes sprint, clears task sprint ids and writes events |
| `GET /api/projects/{id}/progress` | Any authenticated member | 200 `{ pointsTotal, pointsDone, percent, unestimatedTasks, velocity[] }` | 404 hidden/missing/non-member project; read-only snapshot |
| `GET /api/lead/projects/{id}/proposals` | LEAD member of the path project; optional status/page/size | 200 page `{ items, page, size, total }` of REPLAN proposals ordered `createdAt DESC, id DESC` | 404 hidden/missing/non-member project; invalid status/page/size -> 422; read-only |
| `POST /api/lead/proposals/{id}/approve` | LEAD member; `{ version, suggestionIds: UUID[] }`, non-empty unique list max 100 | 200 `{ proposalId, status: APPROVED, applied: UUID[] }` | hidden/missing/soft-deleted -> 404 `NOT_FOUND`; stale version -> 409 `CONFLICT_VERSION`; non-pending, wrong project, archived project or mutation conflict -> 409 `CONFLICT_STATE`; one proposals/domain transaction, no partial apply |
| `POST /api/lead/proposals/{id}/reject` | LEAD member; `{ version }` | 200 `ReplanProposal` with REJECTED status | hidden/missing/soft-deleted -> 404 `NOT_FOUND`; stale version -> 409 `CONFLICT_VERSION`; non-pending/archived -> 409 `CONFLICT_STATE`; proposals transaction updates proposal, then idempotently closes session |

`SprintService` exposes sprint lifecycle operations; the frozen `Core` object remains unchanged.
`Core.progress(projectId)` returns live task totals. `Core.velocity(projectId, n)` returns the
newest `n` closed sprints ordered by `endDate DESC, id ASC`; endpoint 33 passes `n=3`, matching
AD-40. `Core` uses
the existing project-scoped filtered client and does not expose rows from another project.

Progress formulas are exact: `pointsTotal` sums live tasks with points; `pointsDone` sums DONE
tasks with points; `percent` is 0 when total is 0, otherwise `pointsDone / pointsTotal` (for
example, 1 of 4 returns 0.25);
unestimated tasks count live tasks without points; closed sprint velocity is stored
`completedPoints`. When the last three closed sprints have average velocity zero, projected
completion is null; a checkpoint with remaining points is `UNKNOWN`, while a checkpoint with zero
remaining points is `ON_TRACK`.

Sprint create, edit, close and delete lock the project row before checking dates or task membership,
so overlap checks and sprint-task snapshots serialize with W5 task-assignment mutations. Sprint
close computes `completedPoints` from DONE tasks in that sprint, validates one carry-over
entry for every non-DONE task, permits only BACKLOG or a PLANNED sprint in the same project,
clears or changes `sprintId`, emits one `SPRINT_CHANGED` event per moved task with exact actor,
project, from and to values, and then marks the sprint CLOSED. Delete emits the same event for
each task moved to BACKLOG. A repeated close fails with `CONFLICT_STATE`.

Re-plan approval is owned by `proposals`: its row is locked first, status/version/session are
rechecked, and selected IDs must belong to the proposal, be unique, and still fit the path project.
The closed suggestion union is the existing `MOVE_CHECKPOINT_DATE`, `MOVE_EPIC_TO_CHECKPOINT`,
and `REASSIGN_TASK` schema. `Core.applyReplan` performs the domain mutations inside the same
transaction and locks or conditionally updates every referenced row before each write. If any
selected suggestion is stale, nothing is applied and the response identifies the conflicting
suggestions. The response `applied[]` preserves the request's `suggestionIds` order. Successful approval marks the proposal APPROVED in the same transaction as the core
mutation. Because the frozen `Sessions.close` interface accepts no transaction handle, the
proposal transaction commits first and then `proposals` calls idempotent `Sessions.close` with the
approving actor; a retry of the already-approved request repeats only the session close and returns
the same approval result. Rejection follows the same post-commit session-close rule. A project lock
serializes REPLAN creation/supersession with approval/rejection, so a pending proposal cannot be
approved after a newer REPLAN has superseded it.

The owning service contracts are:

- `SprintService.list(projectId: UUID, query: { page: int, size: int }): Promise<Page<Sprint>>`;
  `create(actorId: UUID, projectId: UUID, input: SprintCreate): Promise<Sprint>`;
  `patch(actorId: UUID, sprintId: UUID, input: SprintPatch): Promise<Sprint>`;
  `start(actorId: UUID, sprintId: UUID, version: positive int): Promise<Sprint>`;
  `close(actorId: UUID, sprintId: UUID, input: SprintClose): Promise<Sprint>`; and
  `remove(actorId: UUID, sprintId: UUID, version: positive int): Promise<void>`. It owns all
  project-row locks and returns `NOT_FOUND`, `CONFLICT_VERSION`, `CONFLICT_STATE` or
  `VALIDATION_FAILED` domain errors.
- `ProposalService.list(actorId: UUID, projectId: UUID, query: { status?: ProposalStatus,
  page: int, size: int }): Promise<Page<ReplanProposal>>`;
  `approve(actorId: UUID, proposalId: UUID, input: { version: positive int,
  suggestionIds: UUID[] }): Promise<ReplanApproval>`; and
  `reject(actorId: UUID, proposalId: UUID, version: positive int): Promise<ReplanProposal>`.
  It owns proposal resource resolution, `kind = REPLAN` filtering, project scoping, state/version
  transitions, supersession and session closure; it delegates only domain changes to
  `Core.applyReplan`.
- API composition injects `SprintService` into the core route group and `ProposalService` into the
  lead route group. `lead` supplies facts/digest generation but does not query `ai_proposals` or
  resolve proposal ownership.

All existing core task status, task assignment and sprint-affecting mutation transactions use the
same project-row lock before reading or writing sprint membership. Sprint close additionally
rechecks task versions and statuses after the lock; close-vs-task, start-vs-start and
create/edit-vs-create/edit races therefore produce one committed winner and a stable conflict.

### 4.4 UI

None: W14 adds backend endpoints and services only. Existing W10 screens may consume the
contracts later without changing the W14 backend semantics.

### 4.5 Conventions

- Route authorization remains policy-map-only (AD-55).
- Nested resource ids are checked against the owning project inside the mutation transaction
  (A-06 and the guardrail on nested writes).
- Archived projects are readable only where the existing resolver permits them and are never
  writable; every W14 mutation calls `assertWritable`.
- API error mapping uses the repository's existing typed error mapper; domain errors do not
  leak database messages.

### 4.6 Sequencing constraints

- The API composition root must register core and lead services before W14 routes are reachable.
- Resource resolution and policy-map entries must exist before route handler tests can pass.
- Sprint close and re-plan approval must remain transactional after route composition.
- The scoped C~1 contract amendment requires the shared Sprint page schema, route query parser,
  OpenAPI response and frontend client type to agree on `{ items, page, size, total }`.

## 5. Edge cases

| ID | Req | Scenario | Expected behaviour | Test layer |
|---|---|---|---|---|
| E1 | F2 | End date precedes start date | 422 and no row | core/API |
| E2 | F2,F3 | Dates overlap another live project sprint, including boundary date | 422 and no mutation | core |
| E3 | F3,F4,F6 | Mutation targets ACTIVE, CLOSED or deleted sprint | 409 `CONFLICT_STATE` and no mutation | core/API |
| E4 | F4 | Two starts race for the same project | At most one ACTIVE sprint commits; loser gets 409 | integration |
| E5 | F5 | Close omits a non-DONE task | 422 and sprint/tasks/events remain unchanged | core |
| E6 | F5 | Carry-over target is foreign/deleted/ACTIVE/CLOSED, or a target is not PLANNED/BACKLOG | 422 `VALIDATION_FAILED` for malformed/foreign target; 409 `CONFLICT_STATE` for deleted/ACTIVE/CLOSED target; rollback all changes | core |
| E7 | F5 | Task is DONE but has a carry-over entry | Reject the extra entry with 422 | core |
| E8 | F5 | Close is retried after commit | 409 because sprint is CLOSED; no duplicate events | integration |
| E9 | F6 | Planned sprint has assigned tasks | Soft-delete sprint and clear all task sprint ids atomically | core |
| E10 | F7 | No points or no closed sprints | Zero totals/percent and empty velocity; no divide-by-zero | core |
| E11 | F7 | Equal sprint end dates | Stable id tie-breaker produces deterministic order | core |
| E12 | F8 | Status filter is invalid or project is not caller-visible | 422 for invalid filter or 404 for hidden project | API |
| E13 | F9 | Selected suggestion is duplicated, foreign or stale | 422 `VALIDATION_FAILED` for duplicate/malformed ids; 404 `NOT_FOUND` for hidden proposal; 409 `CONFLICT_STATE` for stale/foreign target; no suggestion is applied | proposals/core |
| E14 | F9 | Re-plan approval races with task, checkpoint, epic, assignee or membership mutation | 409 and no partial mutation; every referenced row is rechecked under the transaction lock | integration |
| E15 | F10 | Proposal is already approved/rejected | 409 and session/proposal state is unchanged | lead |
| E16 | N1 | Developer or PM calls a LEAD-only mutation | Policy map returns forbidden before domain mutation | API/security |
| E17 | N1 | Caller changes ids to another member project | Resource resolution or domain scope check rejects it | security |
| E21 | F1 | Project contains deleted and live sprints across multiple pages | Endpoint 27 returns only live rows with stable page metadata and no duplicates/omissions | core/API |

### What could corrupt data

| ID | Req | Scenario | Expected behaviour | Test layer |
|---|---|---|---|---|
| E18 | N2 | Event insertion fails during close | Entire transaction rolls back, including sprint status and task moves | integration |
| E19 | N3 | Suggestion list exceeds 100 ids or page size exceeds 100 | Schema rejects before mutation | API |
| E20 | N4 | W14 route imports a foreign module's tables | Contract/source-scan test fails; implementation must use owner service | contract |
| E22 | F7 | Four tasks have one point done | Progress percent is exactly 0.25, not 25 | core/API |
| E23 | N2 | Delete or approve fails after a child write | Sprint/proposal, task, event, version and session rows are unchanged | integration |
| E24 | N5 | A mutation returns a conflict | Response and log carry request id, status and stable code but no sensitive payload | API/security |
| E25 | F7 | Three closed sprints have zero completed points | Projected dates are null and risk is UNKNOWN for remaining work | lead |

## 6. Security

Every operation requires an authenticated principal. Endpoint 27 and 33 use the policy map's
member predicate. Endpoints 28–32 and 46–48 use the policy map's `LEAD; member` predicate;
handlers do not duplicate role checks. Resource resolution must derive the project from the
owned sprint or proposal rather than trusting a caller-supplied project id.

`core` verifies project membership and writability inside every mutation transaction, scopes all
foreign ids by `projectId`, validates assignees and target sprints, and writes task events in
the same transaction. `lead` verifies proposal ownership and selected suggestion membership
before delegating to `Core.applyReplan`. Error responses do not reveal whether a hidden project
or child resource exists.

All mutation logs carry the request id, route operation, status and stable error code only; they
never contain credentials, tokens, prompts, proposal payloads or user text. Threats covered are cross-project suggestion injection, replayed close/approve requests, stale
version races, duplicate event creation, archived-project writes, role confusion, and oversized
mutation arrays. Tests must demonstrate rejection and rollback for each.

## 7. Open questions

None. The existing frozen `Core` signatures remain unchanged; W14 adds a separate `SprintService`
owned by `core`, while `proposals` owns proposal lifecycle and delegates domain mutation to
`Core.applyReplan`.

## 8. Decisions made here

| ID | Decision | Why / rejected | Asked by |
|---|---|---|---|
| SD1 | W14 uses the architecture-aligned split: `core` owns sprint lifecycle and derived values; `proposals` owns re-plan proposal lifecycle; `lead` is the role-facing façade; API composes them. | Operator approved the architecture-aligned approach on 2026-11-12. The review clarified that proposal rows and claim/apply belong to `proposals`; a separate `SprintService` preserves the frozen `Core` interface. Rejected a new coordinator package and mixed edits to W5/W8 files because they duplicate or blur table ownership. | operator, 2026-11-12 |

## 9. Review record

Draft pending required Implementer, Tester/QA, Attacker and Maintainer review. Attacker and
Maintainer lenses are required because W14 changes role-gated mutations, tenancy checks,
transactions and task history.
