# W5 Dev Lead pages frontend wiring

- **Status:** Approved (project operator, 2026-11-12)
- **Format:** v2
- **Risk tier:** High - authenticated role UI and multi-tenant network mutations cross several pages
- **Workstream:** W5
- **Plan:** pending Gate 2 plan approval
- **Constraints consulted:** AD-01b/C8, AD-47, AD-55, C20, W5 contracts in `docs/architecture/contracts.md`

## 1. Problem

The W10 Dev Lead screens for projects, project overview, board, backlog, checkpoints and members
still read from the prototype store in `src/fe/lib/api/store.ts`. W5 already exposes the corresponding
server contracts, but the frontend has no typed clients for those operations and therefore cannot show
the signed-in Dev Lead's real projects or persist planning changes. W8's Health page is already wired
for real UUID project routes on this branch.

The desired result is a coherent W5 vertical slice: a real UUID route uses the authenticated API and
shows server state; the existing `p1` prototype route keeps its current click-through behavior until
the rest of the application is migrated.

## 2. Goals

Ordered so dependencies come first. Each is testable and carries its acceptance criterion.

**Functional**

- F1 Load the Dev Lead's member projects - Accept: project list and project navigation use endpoint 6 for UUID-backed data and preserve ordering/page metadata. The existing Active/Archived/All tabs remain prototype-only until endpoint 6 exposes a status filter; live UUID project lists render the server page without client-side filtering.
- F2 Load a project's overview and progress - Accept: project overview uses endpoints 7 and 33; displayed totals, progress and status come from the response.
- F3 Load planning collections - Accept: board/backlog use endpoints 16 and 20 with project-scoped pagination and the existing filters.
- F4 Load and create checkpoints - Accept: checkpoints use endpoint 12; the existing add form uses endpoint 13 and refreshes the list after success.
- F5 Load and mutate planning resources - Accept: existing Dev Lead task, epic and task-status controls call endpoints 17, 21, 22, 23 and 24 with server versions.
- F6 Load and add members - Accept: Members uses endpoint 9 and the existing add-developer flow uses endpoint 10; removal remains unavailable until W16 endpoint 11.
- F7 Preserve prototype compatibility - Accept: non-UUID W10 routes continue using the prototype store and existing interactions.
- F8 Show network state clearly - Accept: each wired page has loading, populated, empty, error and mutation feedback states using existing UI primitives and the fixed safe error mapping below.

**Non-functional**

- N1 Preserve authorization boundaries - Accept: the frontend sends only the authenticated request; role and membership remain enforced by the backend policy map.
- N2 Avoid duplicate data ownership - Accept: no page directly imports Prisma, `@agile/db` or backend services; all requests go through `src/fe/lib/api`.
- N3 Keep the slice testable - Accept: API paths, methods, bodies, route-mode selection, role-safe routing and representative page state transitions have focused frontend coverage mapped to F1-F8 and E1-E12.

## 3. Non-goals

- Sprint creation, editing, starting, closing or deletion (W14, endpoints 27–32).
- Dev Lead proposal listing, approval, rejection or application (W14, endpoints 46–48).
- Member removal (W16, endpoint 11).
- PM-only project creation/archive behavior (endpoints 5 and 8).
- Replacing the prototype data store for non-UUID W10 routes.
- Changing backend contracts, schemas, authorization predicates, database state or deployment behavior.

## 4. Design

### 4.1 Approach

Use the existing `src/fe/lib/api` data-layer convention. Add typed W5 functions beside the existing
numbered prototype helpers; do not change their prototype signatures. The route adapter is the only
place that inspects the project id: `src/fe/lib/api/project-mode.ts` exposes `isApiProjectId(id)` and
`useProjectDataMode(id)`, accepts an exact RFC4122 UUID (case-insensitive), selects the live client,
and otherwise selects the prototype client. Screen resolution must pass the resolved
`projectId` through every project page, `ProjectHead`, loader, mutation handler and generated link;
components consume the adapter rather than checking UUID syntax themselves. W8 Health must use the
same adapter seam rather than retaining a separate UUID predicate. A route change resets adapter
state and ignores or cancels responses for the previous project.

The app route entry point passes `{ pathname, projectId }` into `Screen`; `Screen` provides the
project id through a project-route context consumed by `Top`, `ProjectHead`, `nav.r` and all project
screens. `nav.r` preserves the current project id when converting canvas links, while project-list
links explicitly replace it with the selected server id. No project screen may call `routeOf` without
the current route context.

UUID-backed routes use Firebase auth through `apiFetch`; non-UUID routes retain the prototype store.
The UI keeps its existing shell, copy and component classes, adding only data loading, empty/error
states and server-backed mutation refreshes.

This preserves the W10 demo while allowing the authenticated application to use real W5 data. A
read-only-first split was rejected because it would leave task/checkpoint actions silently writing to
the prototype store beside real reads.

### 4.2 Data model

The frontend mirrors the existing contract shapes: `Project`, `ProjectDetail`, `Member`, `Checkpoint`,
`Epic`, `Task`, `TaskEvent`, `Progress` and paged collection wrappers. Every mutable resource carries
its server `version`; mutations send that version and replace local state with the response. No
frontend persistence is added.

### 4.3 Interfaces

| Operation | Caller | Request | Result / UI effect | Errors |
|---|---|---|---|---|
| `listProjects_6(page, size)` | any authenticated role | `GET /api/projects?page&size` | paged project details; list renders items and empty state | API error shown in page error state |
| `getProject_7(projectId)` | member | `GET /api/projects/{projectId}` | project detail | 404/403 shown using existing error copy |
| `getProgress_33(projectId)` | member | `GET /api/projects/{projectId}/progress` | progress totals and velocity | API error shown beside progress |
| `listMembers_9(projectId)` | member | `GET /api/projects/{projectId}/members` | member list | API error shown in members card |
| `addMember_10(projectId, email)` | eligible Dev Lead | `POST /api/projects/{projectId}/members`, `{email}` | on success reload members, deduplicate by `userId`, and show success | validation, role, membership and conflict errors use the safe mapping below |
| `listCheckpoints_12(projectId)` | member | `GET /api/projects/{projectId}/checkpoints` | checkpoint cards | API error/empty state |
| `createCheckpoint_13(projectId, input)` | PM or Dev Lead | `POST /api/projects/{projectId}/checkpoints` | add returned checkpoint | 422 shown beside form |
| `listEpics_16(projectId, page, size)` | member | `GET /api/projects/{projectId}/epics?page&size` | backlog epic rows | API error/empty state |
| `createEpic_17(projectId, input)` | PM or Dev Lead | `POST /api/projects/{projectId}/epics` | refresh or insert returned epic | 422 shown in form |
| `listTasks_20(projectId, filters)` | member | `GET /api/projects/{projectId}/tasks` with filters/page | board/backlog tasks | API error/empty state |
| `createTask_21(projectId, input)` | PM or Dev Lead | `POST /api/projects/{projectId}/tasks` | refresh list with returned task | 422 shown in form |
| `getTask_22(taskId)` | member | `GET /api/tasks/{taskId}` | task drawer detail | 404/409 shown in drawer |
| `updateTask_23(taskId, input)` | PM or Dev Lead | `PATCH /api/tasks/{taskId}` including `version`; W5 sends only title, description, acceptance criteria, story points and assignee, never `sprintId` | replace task and refresh affected view | 409 conflict keeps editor open and shows server message |
| `setTaskStatus_24(taskId, input)` | Dev Lead | `POST /api/tasks/{taskId}/status` including `version` | replace task and refresh board | 409/422 shown beside status action |

The API page contract is zero-based: the client defaults to `page=0,size=20`, serializes both as
query parameters, and renders `page`, `size` and `total`. Next/previous controls use those values
and are shown only on list screens that already have paging affordances. Task filters serialize only
the endpoint-20 fields `status`, `epicId`, `assigneeId` and `blocked`; changing a filter resets page
to zero. The board and backlog use the same exact filter mapping; they do not filter an unbounded
client collection. Endpoint 6 has no status query in this slice, so live Active/Archived tabs are not
pretended to be server filters.

Endpoint 25 (`deleteTask`) remains prototype-only. On a UUID-backed route the task drawer hides or
disables Delete and explains that deletion is not part of W5; on a non-UUID route its existing
prototype behavior remains unchanged. W5 must not expose or send `sprintId`; sprint assignment belongs
to W14.

Create mutations do not automatically retry after a network error or timeout because the current
contracts provide no idempotency key. The form remains blocked until the user explicitly reloads the
affected collection; resubmission is a new explicit user action. A successful create always reloads
the collection from the server, preventing a locally invented row.

All path ids are URL-encoded by the client; all calls use `apiFetch` and therefore attach the current
Firebase bearer token. Mutations do not optimistically alter data before a successful response.

### 4.4 UI

- Project list: loading skeleton, populated project cards, empty member-project message, and a page error with retry.
- Project overview: loading summary, populated progress/project data, missing project error, and links to board, backlog, checkpoints, members and Health.
- Board/backlog: loading rows, populated task/epic data, empty collection copy, filters retained in the request, and request errors without losing the current route.
- Checkpoints: loading cards, populated cards, empty copy, add form pending/success/error, and server-returned risk/progress data where available.
- Members: loading list, populated members, empty copy, add-developer pending/success/error; no remove control for W5-backed routes.
- Mutations use the existing `Act`, form and toast primitives. A successful mutation replaces or reloads the affected collection; a failed mutation leaves the prior server-backed state visible.
- Error mapping is fixed: 401 invokes the existing `apiFetch` sign-out flow and the page is replaced by AuthGate/sign-in; the page does not remain mounted with an error. 403 (`FORBIDDEN_ROLE` or `FORBIDDEN`) shows `You do not have permission to view this.`; 404 (`NOT_FOUND`) shows `This project or task was not found.`; 409 (`CONFLICT_VERSION` or `CONFLICT_STATE`) keeps the editor open with `This changed elsewhere. Reload before trying again.` and a reload action; 422 (`VALIDATION_FAILED`) maps only bounded details to fields and otherwise shows `Check the highlighted fields.`; 429 (`RATE_LIMITED`) shows `Please wait before trying again.` plus the bounded retry-after value when present; network/5xx (`NETWORK`, `INTERNAL`, or `INTERNAL_ERROR`) errors show `Something went wrong. Try again.` plus a refetch-only retry action. Only these fixed messages and these allowlisted codes may be rendered; arbitrary server text, details outside the field allowlist, and request internals are never displayed.
- A refetch-only retry action reloads the affected collection or page and never resubmits a create/update mutation. After a create timeout, it first reloads the collection and leaves the form blocked until the user explicitly chooses to resubmit.
- Role-restricted dialogs are not reachable through crafted `view` URLs: `resolve` must return forbidden for a role-excluded view, and direct-URL tests cover every W5 mutation dialog.

### 4.5 Conventions

Use numbered endpoint functions, `apiFetch`, `ApiError`, existing `src/fe/lib/api/types.ts` shapes and
the current W10 component classes. Keep Firebase imports inside `src/fe/lib/auth`; keep backend data
access out of components. Existing prototype helpers remain available for non-UUID routes. Add the
missing live DTOs and paged wrappers to `types.ts`; live functions have distinct names/signatures
from prototype helpers and are selected only by the route adapter.

### 4.6 Sequencing constraints

API types and clients precede screen wiring. Collection loaders precede mutation wiring in each screen.
W14 must not be pulled into this branch. W8 Health changes already present must remain compatible.

## 5. Edge cases

| ID | Req | Scenario | Expected behaviour | Test layer |
|---|---|---|---|---|
| E1 | F1,F3,F4,F6 | API returns an empty collection | Render the existing page-specific empty copy and no prototype rows. | component |
| E2 | F1-F6 | API request is pending | Render a loading skeleton or pending control; do not show stale prototype data on UUID routes. | component |
| E3 | F1-F6,F8 | API returns 401/403/404/409/422/429/500 | 401 replaces the page through AuthGate; other statuses use the fixed safe mapping, preserve prior server state where applicable, and never expose response internals. | API/component |
| E4 | F4 | Checkpoint mutation returns 422 | Keep entered checkpoint values, map bounded field details, and do not add a phantom row. | component |
| E5 | F5 | Mutation returns `CONFLICT_VERSION` | Keep the editor open, show the conflict message and reload only after explicit retry. | component |
| E6 | F3 | Board filter changes | Send the corresponding W5 query and replace rows; do not filter an unbounded prototype list locally. | API |
| E7 | F7 | Route project id is `p1` or another non-UUID W10 id | Continue using the prototype store exactly as before. | component |
| E8 | N1,N2 | Component renders a UUID-backed page | No direct backend/database import is present; request is made only through `apiFetch`. | source/API |

### What could corrupt data

| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E9 | F2,F5 | A mutation response is stale or has a conflicting version | Do not retry or overwrite optimistically; retain the server-backed row and show the conflict message. | component/API |
| E10 | F5,F8 | Epic/task create or update fails after submit | Do not insert, remove or update a local row; keep form values and show safe mapped error. | component |
| E11 | F6 | Member add returns 200 for an existing member | Reload members and deduplicate by `userId`; never render duplicate members. | component/API |
| E12 | F5 | Create request times out or loses its response | Do not retry automatically or add a local row; require explicit reload before any resubmission. | component |
| E13 | F5,N1 | Task id from another project is supplied to read, patch or status | Backend response is indistinguishable 404; UI shows the normal missing-task state and changes nothing locally. | API |
| E14 | F7 | Project id is malformed, uppercase UUID, or route changes during a request | Uppercase valid UUIDs use live mode; malformed/non-UUID ids use prototype mode; prior responses are ignored after a route change; generated project links retain the current id. | adapter/component |
| E15 | F4,F5,N1 | Create checkpoint/epic/task supplies a foreign checkpoint, epic or assignee id | Backend rejects the cross-project reference without mutation or identifier leakage; UI shows the normal validation error. | API |

Focused verification must include: endpoint-client contract tests for F1-F6; route-adapter tests for
F7/E14; project-list and overview state tests for F1/F2/E1-E3; board/backlog filter and paging tests
for F3/E6; checkpoint, epic, task and member mutation tests for F4-F6/E4-E5/E9-E12; direct-URL
role tests for N1 and the mutation dialogs, including the `resolve` forbidden fallback; W8 Health
adapter compatibility tests; nested-resource tenancy tests for E15; a task-update serialization test
proving W5 never sends `sprintId`; a `apiFetch` error mapping test covering every allowlisted backend
code; and a source/API test proving N2 and E8. Each test names
the requirement or edge-case ID it covers rather than relying only on aggregate coverage.

## 6. Security

The browser sends Firebase credentials only through `apiFetch`; it does not choose roles or bypass
membership. Backend policy and resource resolution remain authoritative for every operation. The UI
does not log tokens, request bodies, task text or server error internals. Version values are taken from
server responses and sent back on mutation; stale writes are surfaced as conflicts rather than retried
blindly. This slice does not claim immediate disabled-user token revocation: the existing verifier
does not check revocation on every request, so that security property remains outside this UI change.
Backend task and nested-resource resolution must reject cross-tenant task, checkpoint, epic and
assignee IDs without mutation or leakage; this is an acceptance dependency, not a frontend
authorization bypass.

## 7. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|

## 8. Decisions made here

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Wire all W5-supported Dev Lead pages as one vertical slice, with UUID API mode and non-UUID prototype fallback | Keeps reads and writes on the same data source per route; rejected read-only-first split | project operator, 2026-11-12 |
| SD2 | Leave W14 sprint/re-plan and W16 member removal out of this branch | Those endpoints belong to later workstreams and are not needed to make W5 pages coherent | project operator, 2026-11-12 |

## 9. Review record

Lenses: Implementer, Tester, Attacker (authenticated role/tenancy boundary), Maintainer. Review rounds:
round 1 and round 2 complete; findings incorporated. Gate 1 approved by project operator on 2026-11-12.
