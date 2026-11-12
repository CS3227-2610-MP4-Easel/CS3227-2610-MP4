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
`proposals` for re-plan proposal lifecycle, with `lead` retaining digest-related behavior and
the role-facing façade. Derived progress, velocity and
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
- **N3 Bound request and query work:** List endpoints use `page` 0–10,000 and `size` 1–100; sprint-close `carryOver` accepts at most 1,000 entries and mutations cap other arrays and strings at the frozen contract limits. **Accept:** oversized requests fail before a write or unbounded read.
- **N4 Keep modules testable:** `core` contains sprint and derived-value rules; `proposals` contains proposal lifecycle; `lead` contains facts/digest generation and the role-facing façade; API code only parses, composes and maps errors. **Accept:** module and contract checks pass without cross-owner table imports.
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

No new logical entities or schema fields are introduced. W14 requires no migration or seed change; rollback is code rollback because all writes use existing columns and transactions. Deployment verification runs the existing contract, Prisma and integration checks; recovery uses the project's manual DB restore process.

- `Sprint`: existing `id`, `projectId`, `name`, inclusive `startDate`/`endDate`, `status`,
  nullable `completedPoints`, timestamps, version and soft-delete marker. Legal transitions:
  `PLANNED → ACTIVE → CLOSED`; `PLANNED → deleted`. No other transition is legal.
- `Task`: existing `sprintId`, `status`, `storyPoints`, version and project-scoped relations.
  A task in a CLOSED sprint cannot change sprint, points or status (A-14).
- `TaskEvent`: append-only events written in the same transaction as task movement.
- `ReplanProposal`: existing `REPLAN` proposal rows and suggestion payloads owned by `proposals`.
  Lifecycle is `PENDING → APPROVED`, `PENDING → REJECTED`, or `PENDING → SUPERSEDED`; terminal
  states do not change. A newer pending REPLAN for the same project supersedes the previous pending
  REPLAN, and archiving the project supersedes its pending proposals. The JSON `payload` retains
  the original `suggestions` and, after approval, records immutable `appliedSuggestionIds` in the
  request order; this uses the existing payload column and requires no Prisma migration.

### 4.3 Interfaces

| Operation | Caller and input | Output | Errors and transaction |
|---|---|---|---|
| `GET /api/projects/{id}/sprints` | Any authenticated member; `page` defaults 0 and `size` defaults 20, page 0–10,000 and size 1–100 | 200 page `{ items: Sprint[], page, size, total }` ordered by `startDate ASC, id ASC` | 404 for hidden/missing/non-member project; invalid page/size -> 422; read-only |
| `POST /api/projects/{id}/sprints` | LEAD member; `{ name: 1..200, startDate: date, endDate: date }` | 201 PLANNED sprint | 422 invalid date/overlap; 404 hidden project; insert transaction |
| `PATCH /api/sprints/{id}` | LEAD member; at least one of name/dates plus positive `version` | 200 sprint | stale version -> 409 `CONFLICT_VERSION`; non-PLANNED/archived -> 409 `CONFLICT_STATE`; invalid/overlap -> 422; update transaction excludes the current sprint from overlap checks |
| `POST /api/sprints/{id}/start` | LEAD member; `{ version }` | 200 ACTIVE sprint | stale version -> 409 `CONFLICT_VERSION`; non-PLANNED, archived or existing ACTIVE sprint -> 409 `CONFLICT_STATE`; transaction locks project/sprint state |
| `POST /api/sprints/{id}/close` | LEAD member; `{ version, carryOver: [{ taskId: UUID, to: "BACKLOG" or plannedSprintId: UUID }] }`, 0–1,000 entries and exact one entry for each non-DONE task in the source sprint | 200 CLOSED sprint | stale version -> 409 `CONFLICT_VERSION`; non-ACTIVE/archived/race -> 409 `CONFLICT_STATE`; missing/duplicate/foreign/invalid carry-over or invalid target -> 422; one transaction for points, task moves, events and close |
| `DELETE /api/sprints/{id}?version=` | LEAD member | 204 | stale version -> 409 `CONFLICT_VERSION`; non-PLANNED/archived -> 409 `CONFLICT_STATE`; one transaction soft-deletes sprint, clears task sprint ids and writes events |
| `GET /api/projects/{id}/progress` | Any authenticated member | 200 `{ pointsTotal, pointsDone, percent, unestimatedTasks, velocity[] }` | 404 hidden/missing/non-member project; read-only snapshot |
| `GET /api/lead/projects/{id}/proposals` | LEAD member of the path project; optional status/page/size with page 0–10,000 and size 1–100 | 200 page `{ items, page, size, total }` of REPLAN proposals ordered `createdAt DESC, id DESC` | 404 hidden/missing/non-member project; invalid status/page/size -> 422; read-only |
| `POST /api/lead/proposals/{id}/approve` | LEAD member; `{ version, suggestionIds: UUID[] }`, non-empty unique list max 100 | 200 `{ proposalId, status: APPROVED, applied: UUID[], sessionOutcome: ACCEPTED }`; an already APPROVED proposal returns its stored applied set and ignores a different subset | hidden/missing/soft-deleted -> 404 `NOT_FOUND`; stale version on PENDING -> 409 `CONFLICT_VERSION`; REJECTED/SUPERSEDED, wrong project, archived project or mutation conflict -> 409 `CONFLICT_STATE`; one proposals/domain/session transaction, no partial apply |
| `POST /api/lead/proposals/{id}/reject` | LEAD session owner; `{ version }` | 200 `ReplanProposal` with REJECTED status and `sessionOutcome: REJECTED` | hidden/missing/soft-deleted -> 404 `NOT_FOUND`; stale version -> 409 `CONFLICT_VERSION`; non-pending/archived or caller is not the proposal session owner -> 409 `CONFLICT_STATE`; one transaction-aware proposal/session outcome |

`SprintService` exposes sprint lifecycle operations; the frozen `Core` object remains unchanged.
`Core.progress(projectId)` returns live task totals. `Core.velocity(projectId, n)` returns the
newest `n` closed sprints ordered by `endDate DESC, id ASC`; endpoint 33 passes `n=3`, matching
AD-40. `Core` uses
the existing project-scoped filtered client and does not expose rows from another project.

Progress formulas are exact: `pointsTotal` sums live tasks with points; `pointsDone` sums DONE
tasks with points; `percent` is 0 when total is 0, otherwise `(pointsDone / pointsTotal) * 100`
(for example, 1 of 4 returns 25). This preserves the existing `ProgressSchema` and W8
consumer contract, which use percentage points in the range 0–100;
unestimated tasks count live tasks without points; closed sprint velocity is stored
`completedPoints`. When the last three closed sprints have average velocity zero, projected
completion is null; a checkpoint with remaining points is `UNKNOWN`, while a checkpoint with zero
remaining points is `ON_TRACK`.

Sprint create, edit, close and delete lock the project row before checking dates or task membership, so overlap checks and sprint-task snapshots serialize with W5 task-assignment mutations. Sprint close computes `completedPoints` from DONE tasks in that sprint, validates one carry-over
entry for every non-DONE task, permits only BACKLOG or a PLANNED sprint in the same project,
clears or changes `sprintId`, emits one `SPRINT_CHANGED` event per moved task with exact actor,
project, from and to values, and then marks the sprint CLOSED. Delete emits the same event for
each task moved to BACKLOG. A repeated close fails with `CONFLICT_STATE`.

Re-plan approval is owned by `proposals`: the project row is locked first, the proposal row
second, the session row third, and referenced domain rows after that for every REPLAN create,
supersede, approve and reject operation. Status, version, actor authorization and session
ownership are rechecked under those locks. The session must be the proposal's `sessionId`, belong
to the same project, use `LEAD_DIGEST`, match the current environment, be OPEN, and be owned by
the authenticated actor for rejection; a null or mismatched session is `CONFLICT_STATE`. Selected
IDs must belong to the proposal, be unique, and still fit the path project.
The closed suggestion union is the existing `MOVE_CHECKPOINT_DATE`, `MOVE_EPIC_TO_CHECKPOINT`,
and `REASSIGN_TASK` schema. `Core.applyReplan` performs only domain mutations inside the same
transaction and does not read or update `ai_proposals`; `proposals` validates and updates the
proposal row. Core still enforces the frozen apply contract: strict suggestion-schema validation,
project scope, actor role and membership, project writability, referenced-row state and task-event
creation. Proposal-level checks are repeated there for defense in depth, but proposal-table
lifecycle remains exclusively in `proposals`. `Core.applyReplan` is an internal transaction-only
capability and is never route-exposed. If any selected suggestion no longer fits the current
project scope or state, nothing is applied and the response identifies the conflicting suggestions
as `details: { suggestionIds: UUID[] }` in original request order. W14 does not claim
historical snapshot-version detection because the frozen suggestion schema has no expected-version
token. The response `applied[]` preserves the request's `suggestionIds` order. An approval of a
PENDING proposal uses a transaction-aware internal session-close gateway, so proposal status,
domain mutations and session outcome commit atomically. A retry of an already APPROVED request
returns the persisted applied set without inspecting a new subset or requiring the request version;
REJECTED or SUPERSEDED proposals return `CONFLICT_STATE`. Rejection uses the same transaction-aware
gateway and requires the session owner. A project lock serializes REPLAN creation/supersession with
approval/rejection, so a pending proposal cannot be approved after a newer REPLAN has superseded it.

The owning service contracts are:

- `SprintService.list(actorId: UUID, projectId: UUID, query: { page: int, size: int }): Promise<Page<Sprint>>`;
  `create(actorId: UUID, projectId: UUID, input: SprintCreate): Promise<Sprint>`;
  `patch(actorId: UUID, sprintId: UUID, input: SprintPatch): Promise<Sprint>`;
  `start(actorId: UUID, sprintId: UUID, version: positive int): Promise<Sprint>`;
  `close(actorId: UUID, sprintId: UUID, input: SprintClose): Promise<Sprint>`; and
  `remove(actorId: UUID, sprintId: UUID, version: positive int): Promise<void>`. It owns all
  project-row locks and returns `NOT_FOUND`, `CONFLICT_VERSION`, `CONFLICT_STATE` or
  `VALIDATION_FAILED` domain errors.
- `ProposalService.list(actorId: UUID, projectId: UUID, query: { status?: ProposalStatus,
  page: int, size: int }): Promise<Page<ReplanProposal>>`;
  `createReplanInTransaction(tx: DbTransaction, actorId: UUID, projectId: UUID, input: {
  sessionId: UUID, suggestions: Suggestion[], explanation: string, flagged: boolean }):
  Promise<ReplanProposal>`; `createReplan(actorId: UUID, projectId: UUID, input: CreateReplan):
  Promise<ReplanProposal>`; `createReplanInTransaction` locks project then the previous pending
  proposal, marks that proposal SUPERSEDED with version increment and closes its bound OPEN session
  as REJECTED, then inserts the new PENDING proposal; all digest/proposal/session writes commit or
  roll back together. `createReplan` supplies the transaction boundary for callers without an
  existing transaction.
  `approve(actorId: UUID, proposalId: UUID, input: { version: positive int,
  suggestionIds: UUID[] }): Promise<ReplanApproval>`; and
  `reject(actorId: UUID, proposalId: UUID, version: positive int): Promise<ReplanProposal>`.
  It owns proposal resource resolution, `kind = REPLAN` filtering, project scoping, state/version
  transitions, supersession and session closure. Its exact internal gateway is
  `closeInTransaction(tx: DbTransaction, input: { sessionId: UUID, proposalId: UUID,
  projectId: UUID, feature: "LEAD_DIGEST", ownerId: UUID, outcome: "ACCEPTED" | "REJECTED",
  actorId: UUID }): Promise<void>`; it locks and validates the bound session after project/proposal,
  requires OPEN state and matching project/feature/environment, permits only `ownerId` or the
  approving actor, and updates outcome/endedAt exactly once. A missing or null session, mismatched
  binding, wrong actor or already-closed session raises `CONFLICT_STATE` and rolls back the whole
  transaction. It delegates only domain changes to `Core.applyReplan`.
- API composition injects `SprintService` into the core route group and `ProposalService` into the
  lead route group. `lead` supplies facts/digest generation but does not query `ai_proposals` or
  resolve proposal ownership.

All existing core task status, task assignment and sprint-affecting mutation transactions use the same project-row lock before reading or writing sprint membership. Sprint close additionally
rechecks task versions and statuses after the lock; carry-over task IDs must be exactly the live,
non-DONE task set currently assigned to the sprint being closed, with no same-project task from
another sprint accepted. close-vs-task, start-vs-start and create/edit-vs-create/edit races
therefore produce one committed winner and a stable conflict. Sprint mutations and re-plan approval
use the W5 `inMutationTransaction` RepeatableRead helper and its bounded retry policy.

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
- The scoped C~1 contract amendment requires the shared Sprint and Proposal page schemas, route
  query parsers, OpenAPI responses and frontend client types to agree on `{ items, page, size,
  total }`.

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
| E13 | F9 | Selected suggestion is duplicated, foreign or no longer valid in current state | 422 `VALIDATION_FAILED` for duplicate/malformed ids; 404 `NOT_FOUND` for hidden proposal; 409 `CONFLICT_STATE` with `details: { suggestionIds }` in request order for invalid targets; no suggestion is applied | proposals/core |
| E14 | F9 | Re-plan approval races with task, checkpoint, epic, assignee or membership mutation | 409 and no partial mutation; every referenced row is rechecked under the transaction lock | integration |
| E15 | F9,F10 | Proposal is already approved, rejected or superseded | Authorized APPROVED replay returns 200 with the stored applied set and ACCEPTED outcome; REJECTED or SUPERSEDED returns 409 `CONFLICT_STATE`; no new subset or mutation is inspected | proposals |
| E16 | N1 | Developer or PM calls a LEAD-only mutation | Policy map returns forbidden before domain mutation | API/security |
| E17 | N1 | Caller changes ids to another member project | Resource resolution or domain scope check rejects it | security |
| E21 | F1 | Project contains deleted and live sprints across multiple pages | Endpoint 27 returns only live rows with stable per-request page metadata; `page < 0` or `page > 10000` returns 422 | core/API |

### What could corrupt data

| ID | Req | Scenario | Expected behaviour | Test layer |
|---|---|---|---|---|
| E18 | N2 | Event insertion fails during close | Entire transaction rolls back, including sprint status and task moves | integration |
| E19 | N3 | Suggestion list exceeds 100 ids or page size exceeds 100 | Schema rejects before mutation | API |
| E20 | N4 | W14 route imports a foreign module's tables | Contract/source-scan test fails; implementation must use owner service | contract |
| E22 | F7 | Four tasks have one point done | Progress percent is exactly 25, not 0.25 | core/API |
| E26 | F5 | Carry-over contains a same-project task from another sprint or a task outside the project | 422 `VALIDATION_FAILED`; no task, event or sprint row changes | core |
| E27 | F8,F9 | Digest creation races with approval or another digest | Project → proposal → session lock order yields one committed pending proposal; the prior pending proposal is SUPERSEDED and its session REJECTED, or the competing mutation gets 409; digest, proposal and session rows roll back together on failure | integration |
| E23 | N2 | Delete or approve fails after a child write | Sprint/proposal, task, event, version and session rows are unchanged | integration |
| E24 | N5 | A mutation returns a conflict | Response and log carry request id, status and stable code but no sensitive payload | API/security |
| E25 | F7 | Three closed sprints have zero completed points | Projected dates are null and risk is UNKNOWN for remaining work | lead |

## 6. Security

Every operation requires an authenticated principal, and every `actorId` is derived from that
principal rather than request input. Endpoint 27 and 33 use the policy map's member predicate.
Endpoints 28–32 and 46–48 use the policy map's `LEAD; member` predicate; endpoint 48 additionally
requires `ProposalService` to verify `session.id == proposal.sessionId`, session owner equals the
authenticated actor, same project, `LEAD_DIGEST` feature, current environment and OPEN state.
Handlers do not duplicate domain checks. Resource resolution must derive the project from the
owned sprint or proposal rather than trusting a caller-supplied project id.

`core` verifies project membership and writability inside every mutation transaction, scopes foreign ids by `projectId`, validates assignees and target sprints, and writes task events in the same transaction. `lead` generates facts/digests and delegates proposal persistence/lifecycle to `ProposalService`; `proposals` performs proposal/session ownership checks before delegating to `Core.applyReplan`. Error responses do not reveal whether a hidden project or child resource exists.

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
| SD2 | Preserve the existing 0–100 progress contract even though AD-12 prose describes a ratio. | `ProgressSchema`, W8 consumers and current Core behavior already use percentage points; changing the wire value would require a project-wide migration. Record the architecture wording mismatch for the project-state fold. | operator, 2026-11-12 |
| SD3 | Store immutable approved suggestion IDs inside the existing proposal JSON payload and use an exact transaction-aware session gateway. | This preserves idempotent approval replay and atomic proposal/domain/session outcomes without adding a logical entity or Prisma column. Rejected post-commit session close because it permits permanent divergence. | operator, 2026-11-12 |

## 9. Review record

Two review rounds completed with Implementer, Tester/QA, Attacker and Maintainer lenses. Round one
identified progress-scale, proposal ownership, session atomicity, lock ordering and unsupported
snapshot-version claims; operator resolutions C~2–C~6 were incorporated. Round two identified
replay persistence, proposal creation/supersession, exact session binding, source-task equality,
bounded inputs and conflict-detail gaps; C~7–C~8 were incorporated. The remaining AD-12 ratio
wording mismatch is explicitly recorded as SD2 for the project-state fold.
