# Live Backlog Editing Design

- **Status:** Draft — open questions and review pending
- **Format:** v2
- **Risk tier:** High — project-scoped writes require authorization, tenancy and concurrency checks.
- **Workstream:** pending | **Plan:** not written
- **Constraints consulted:** contracts.md §3.3 (endpoints 12–25), AD-55 policy map; W7c points 1–20; branch state Known Gap: live backlog and forms not wired.

## 1. Problem
`live-backlog.tsx` reads checkpoints, epics and tasks but presents a read-only epic list; its canvas add forms write fixtures. A PM or Dev Lead cannot use it to maintain existing live backlog records. The contracts already grant project-member PMs and Dev Leads editing rights, but the checkpoint and epic update routes are not implemented. The operator wants an editable, checkpoint-grouped backlog, collapsible checkpoints, and task dragging.

## 2. Goals
**Functional**
- F1 Show all live checkpoints in target-date order with their epics and tasks, plus unassigned epics after them; include empty checkpoints. Accept: a project with an empty checkpoint and an unassigned epic shows both.
- F2 Let a PM or Dev Lead edit a checkpoint's name and target date. Accept: save persists via endpoint 14 and the updated date changes its display order.
- F3 Let a PM or Dev Lead edit an epic's title, description and checkpoint assignment. Accept: save via endpoint 18 moves the epic and its tasks into the selected checkpoint group; selecting none moves it to the unassigned group.
- F4 Let a PM or Dev Lead edit a task's title, description, acceptance criteria, points, epic assignment, assignee and sprint. Accept: endpoint 23 saves and displays those values; task remains under the selected epic and therefore that epic's checkpoint.
- F5 Permit moving a task by dragging to an epic, with a keyboard-accessible destination selector providing the same operation. Accept: either interaction updates task `epicId` using endpoint 23 and refreshes the displayed group.
- F6 Let users expand or collapse each checkpoint group without changing stored data. Accept: keyboard activation hides and restores its epics and tasks and reports expanded state. The destination picker can be operated by keyboard, receives focus when opened, and returns focus on cancel or completion.
- F7 Wire existing endpoint 9 and implement existing endpoint 14, 18 and 27 contracts with optimistic concurrency, membership and related-record validation. Accept: valid edits persist; stale versions and cross-project references are rejected without partial writes.

**Non-functional**
- N1 Writes are atomic and scoped to the project: no denied or conflicting request modifies records. Accept: integration tests assert stored rows unchanged after failed requests.
- N2 The live UI retains fetched versions and surfaces errors without silently discarding unsaved edits. Accept: a simulated version conflict shows an error and retains the editor's inputs.

## 3. Non-goals
- New database entities or columns; tasks remain attached to epics, not directly to checkpoints.
- Changing task status authorization or sprint lifecycle rules.
- Creating or deleting records in this workstream; this specification covers existing records. Existing 13, 17 and 21 routes remain unchanged; missing delete routes 15, 19 and 25 are outside scope.
- Editing proposal drafts, AI generation, or fixture data.

## 4. Design
### 4.1 Approach
Render a checkpoint-first view using endpoint 12 and every page of endpoints 16 and 20; for a static dataset deduplicate by id; offset pagination does not promise a consistent snapshot during concurrent changes; place epics without a checkpoint in a final group. Each edit is an independent server mutation. Dropping a task on a checkpoint opens a destination picker limited to the epics in that checkpoint; choosing one moves only the dragged task. If it has no epics, no write occurs and the UI explains that an epic is needed. Cancel makes no change.

### 4.2 Data model
No migration, seed or schema change. A checkpoint has name, targetDate and version. An epic has title, nullable description, nullable checkpointId, position and version. A task has required epicId, title, nullable description, acceptanceCriteria, nullable storyPoints and version. Task membership in a checkpoint is derived via its epic. Existing rows remain unchanged until edited. Rollback restores prior application code without data conversion; persisted edits remain.

### 4.3 Interfaces
All operations retain their existing policy keys and contracts. Fetch responses include resource versions in frontend types.

| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors | Transaction and events |
|---|---|---|---|---|---|
| 9, 27 GET | any project member | existing project id | existing Member and Sprint arrays; member userId and displayName and sprint id and name drive selectors | existing auth and validation errors | read only; membership scoped |
| 12, 16, 20 GET | any project member | existing pagination/filters | existing checkpoint, epic and task views including version | existing auth and validation errors | read only |
| 14 PATCH `/api/checkpoints/{id}` | PM or LEAD; member | `{name?, targetDate?, version}`; name 1–200, targetDate valid `YYYY-MM-DD`, version positive integer | 200 Checkpoint | 404 missing/inaccessible; 409 `CONFLICT_VERSION` or `CONFLICT_STATE` archived; 422 `VALIDATION_FAILED` | one transaction; version increases on change; no task event |
| 18 PATCH `/api/epics/{id}` | PM or LEAD; member | `{title?, description?, checkpointId?, position?, version}`; title 1–200, description null or ≤4000, checkpointId null or same-project UUID, position a whole number 0–2147483647, version positive integer; position changes only that epic and does not shift others | 200 Epic | 404 missing/inaccessible; 409 `CONFLICT_VERSION` or `CONFLICT_STATE` archived; 422 `VALIDATION_FAILED` | one transaction; version increases on change; no task event |
| 23 PATCH `/api/tasks/{id}` | PM or LEAD; member | existing contract: title, description, acceptanceCriteria, storyPoints, epicId, assigneeId, sprintId, version; storyPoints null or whole 1–20; epicId same-project | 200 Task | existing 404/409/422 errors including stale version, archived project, closed sprint and invalid related record | existing transaction and task events remain unchanged |

The API must use existing route policy checks and validate membership and writability again inside the write transaction. Do not add request fields or change existing API shapes.

### 4.4 UI
Loading shows a loading state; a failed initial fetch shows an error. The populated view displays every checkpoint name and date with an accessible expanded/collapsed button, then its epics and their tasks. The last group contains epics without a checkpoint. Project members may inspect; mutation controls are offered in the local live PM flow; the backend policy authorizes project-member PMs and Dev Leads. The current live client uses the local dev-PM token, so real Dev Lead UI identity remains dependent on the sign-in follow-up. Editors provide save and cancel and validate using interface limits. Task assignee and sprint selectors show project members and project sprints, including an unassigned option, using endpoints 9 and 27; existing task mutation rules validate membership, sprint state and points. Tasks may be dropped directly onto an epic to move there, or onto a checkpoint to open its destination-epic picker; task movement also has a labelled destination selector. While a record's request is pending its editor's save and cancel controls are disabled. On failure show the API error and preserve form values; on 409 reload the record before allowing the user to retry with a fresh version. On success use fresh server data to refresh grouping and counts. On conflict reload the complete project-scoped list, retain the draft separately, and prohibit retry unless the record is still accessible with a fresh version; if deleted or access is lost show an error and do not submit. Capture the selected project ID at the start of each load and mutation; discard results belonging to a prior project after a switch. Fetch every list page, not just the first. The prototype role cookie only affects presentation: API authorization uses the authenticated principal and policy, never the cookie.

### 4.5 Conventions
Follow existing API data-layer boundary and policy map (AD-55). No frontend database access.

### 4.6 Sequencing constraints
Endpoints 14, 18 and 27, the live endpoint 9 client, and response version types must be available before the live UI can save those records. Task movement follows the same versioned endpoint as other task edits.

## 5. Edge cases
### What could corrupt data
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1 | Empty checkpoint and unassigned epic | Both appear; unassigned appears last | UI |
| E2 | F2 | Save changed date | New date persists and checkpoint appears in date order | API + UI |
| E3 | F3 | Change epic checkpoint or select none | Epic and tasks appear in new group; task rows are not rewritten | integration + UI |
| E4 | F4 | Save task details and valid 1 or 20 points | Values persist on the same task | integration + UI |
| E18 | F4 | Assign or clear task assignee and sprint; use foreign IDs, closed sprint, or assign sprint without points | same-project values and null clears persist via 23; foreign IDs, closed sprint and missing points are rejected with no row or event writes; successful relevant changes retain existing events | API + UI |
| E19 | F7, N1 | Endpoint 27 requested by member and non-member | member sees only sprints from that project in start-date order; non-member receives 404 and no sprint data | integration |
| E5 | F4 | Invalid title, criteria, date or points | 422 or frontend validation; no write | API + UI |
| E6 | F5 | Drag or use destination selector to another epic | Same endpoint 23 write; task appears under destination epic | integration + UI |
| E14 | N2 | Conflicted record is deleted or membership is removed | retain draft, show unavailable, prohibit retry without an accessible fresh version | UI + integration |
| E15 | N1 | Switch projects while old loads or mutations are pending | discard old responses; never show old project data in the new project | UI |
| E16 | F1 | More records exist than a single API page | for a static dataset all pages are included without duplication; concurrent mutations may cause offset-page inconsistency | UI + API |
| E17 | N1 | Prototype role cookie differs from authenticated principal | API principal and policy alone decide access; cookie cannot authorize a mutation | integration |
| E13 | F5 | Drop on a checkpoint with zero, one or multiple epics; choose or cancel | Picker lists destination epics; selection moves only the task; empty group shows an explanation and makes no write; cancel makes no write | UI + integration |
| E7 | F6 | Keyboard toggle on a checkpoint | `aria-expanded` and content visibility change together; no request is sent | UI |
| E8 | F7, N1 | Stale version or two concurrent writes | One versioned write succeeds; stale write receives 409; no overwritten data | integration |
| E9 | N1 | Non-member, wrong role, or cross-project checkpoint/epic id | Request rejected, rows unchanged, no foreign data returned | integration |
| E10 | N1 | Project archived or task in closed sprint | Existing 409 state rule prevents write | integration |
| E11 | N2 | Request fails or conflict occurs while editing | Show error and preserve unsaved values; fresh version required before retry | UI |
| E12 | N1 | Mutation fails after beginning its transaction | No partial row or event writes | integration |

## 6. Security
Authenticated members may read; only project-member PMs and Dev Leads may mutate through policy gate plus transactional checks. Each resource determines its own project; never trust a client project id to authorize a resource. Related checkpoint and epic ids are checked against that project inside the mutation transaction. Input validation follows §4.3. Existing request logging applies; do not add descriptions or acceptance criteria to logs. Changes to task points, assignee and sprint retain existing events. Name and description edits do not gain a new audit schema.

| Actor and abuse | Mitigation | Test |
|---|---|---|
| Non-member guesses an id | Membership check and 404, no write | E9 |
| Developer forges a write | Role gate rejects it | E9 |
| Member injects a cross-project id | Server validates relation project | E9 |
| Two editors race | Version predicate in transaction; loser gets conflict | E8 |
| Request fails mid-mutation | Transaction rolls back all writes | E12 |

## 7. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

| — | None | — | — |

## 8. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Reuse checkpoint → epic → task relationships and choose an epic when dropping on a checkpoint | The operator chose a destination epic; moving the whole original epic was rejected. | Operator |

## 9. Review record
Lenses: Implementer, Tester, Maintainer, Attacker (authorization and tenancy). Endpoint 9 exists; 27 needs a member-scoped implementation. Round 1 findings: conflict recovery, project switching, paging, identity, positions, drop targets and storyPoints naming folded. Round 2: no blocking Tester or Attacker issues after fixes. Rounds: 2. Rejected findings: none.
