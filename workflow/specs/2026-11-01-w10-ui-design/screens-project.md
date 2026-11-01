# Project screens shared by all roles (S8 to S13)

Task detail, checkpoints, sprints, members, settings and usage. Common states, error handling and components are in [ui.md](ui.md). Each interaction row reads: user action → endpoint → what the screen does. **T2** marks a Tier 2 control on a Tier 1 screen. S1 to S7 are in [screens-shared.md](screens-shared.md).

## S8 Task detail (drawer)

Over S6, S7 or S19, opened by `?task=:taskId`. Endpoints 22, 23, 24, 9 (assignee), 12 (checkpoint name), 16 (epic name). T2: 25, 26, 27 (sprint name).

| Region | Content |
|---|---|
| Header | title, epic, `StatusChip`, `BlockedBadge` |
| Body | description, acceptance criteria (a checklist display, not tickable: no endpoint stores ticks), story points, assignee, sprint, checkpoint (inherited from the epic) |
| History (T2) | `TaskEvent`s newest first: actor, what changed (from → to), time (endpoint 26, paged) |
| Actions | PM, Dev Lead: **Edit**, **Delete** (T2). Dev Lead and the assignee: **Status** select and **Mark blocked / Unblock** |

Edit mode turns the body into the task form of S7. **Save** sends endpoint 23; **Cancel** discards. A stale version shows the reload banner of ui.md §4 inside the drawer. Closing the drawer returns to the screen underneath with its scroll position kept.

States: loading skeleton; 404 "Not found"; a task in a closed sprint is read-only and says "This task is frozen because its sprint is closed."

## S9 Checkpoints

Route `/projects/:id/checkpoints`. Endpoints 12, 13, 16 (linked epics), 42 (risk, PM and Dev Lead). T2: 14, 15.

| Region | Content |
|---|---|
| Toolbar | **Add checkpoint** (PM, Dev Lead) |
| List | by target date: name, target date, the epics linked to it (chips with task counts and points), for a PM or Dev Lead a `RiskBadge` and the projected date from `Facts` |

Form (dialog): name (required, 1 to 200), target date (`DateField`). Create is endpoint 13. T2: edit (14), delete (15, "Epics linked to this checkpoint are kept and unlinked.").

States:
- Empty, PM or Dev Lead: "No checkpoints yet. A checkpoint is a date the team commits to. Epics belong to at most one."
- Empty, Developer: "No checkpoints yet."
- Without sprint history the badge reads `UNKNOWN` with the note "Close a sprint to get a forecast." Developers see dates and linked epics only, no risk.
- Linking an epic to a checkpoint happens on the epic form in S7, not here.

## S10 Sprints

Route `/projects/:id/sprints`. T2 (endpoints 27 to 32; 33 for velocity; 20 with `sprintId` for a sprint's tasks and points planned). Developers and PMs see it read-only.

| Region | Content |
|---|---|
| Toolbar | **New sprint** (Dev Lead) |
| Velocity strip | the last closed sprints as bars of `completedPoints`, and the average |
| Sprint list | by start date: name, dates, status chip (`Planned`, `Active`, `Closed`), points planned (sum of the sprint's task points), `completedPoints` when closed; expand to see its tasks as `TaskRow`s |
| Planned sprint actions (Dev Lead) | **Edit** (29), **Start** (30), **Delete** (32) |
| Active sprint actions (Dev Lead) | **Close sprint** |

Forms: **New or edit sprint** dialog with name, start date, end date (inclusive). 422 shows "End date must be on or after the start date" or "Dates overlap sprint {name}".

**Close sprint** (endpoint 31) is a dialog:
1. Summary line: "{n} tasks done, {points} points complete. {m} tasks not done."
2. A table of each not-DONE task with a select: the next PLANNED sprint by name (default) or **Backlog**. A confirmation line states how many tasks and points will move. When no PLANNED sprint exists the default is **Backlog**.
3. **Close sprint** sends `carryOver` with one entry per not-DONE task. If none are left (the happy path), the table is hidden and the dialog reads "All {n} tasks done, {points} points complete. Nothing to carry over."
4. Result: the sprint shows CLOSED with its `completedPoints`, and a toast "Sprint closed. Velocity: {points}."

Interactions: **Start** is disabled with the tooltip "Another sprint is active" while one is ACTIVE (409 otherwise). **Delete** exists only for PLANNED sprints and says "Its tasks move to the backlog."

States: empty, Dev Lead: "No sprints yet. Create one and assign tasks from the Backlog." Empty, other roles: "No sprints yet."

## S11 Members

Route `/projects/:id/members`. Endpoints 9, 10. T2: 11.

| Region | Content |
|---|---|
| List | display name, `RoleBadge`, added date (`Member` carries no email, so none is shown) |
| Add panel | PM: "Add a Dev Lead" with an email field. Dev Lead: "Add a Developer". Developer: absent |

| Interaction | Result |
|---|---|
| Add | endpoint 10 `{ email }`. 201: the member appears. 200: toast "Already a member." 422: "No registered {Dev Lead or Developer} has that email." |
| Remove (T2) | shown only on rows whose role the caller may add (PM: Dev Leads, Dev Lead: Developers), so never on a row of the caller's own role. `ConfirmDialog`, endpoint 11. 409: "This person still has open tasks. Reassign them first." |

The panel states plainly that people register themselves with a code before they can be added. The email match is case-insensitive.

## S12 Project settings

Route `/projects/:id/settings`. PM only. T2. Endpoint 8.

| Section | Content |
|---|---|
| Details | name, brief, **Save** (sends `version`) |
| Archive | explanation "Archiving makes the project read-only for everyone. It cannot be undone from the app." and **Archive project** (red) |

Archive uses `ConfirmDialog` with the project name typed to confirm. On success the project header shows the archived banner at once. After archiving, this screen shows only the details, read-only.

## S13 Usage

Route `/usage`. All roles. T2. Endpoints 56, 57.

| Tab | Content |
|---|---|
| **My AI sessions** (56) | table: feature (readable name), started, outcome chip (`Open`, `Accepted`, `Edited`, `Rejected`, `Abandoned`), regenerations, feedback (thumb), calls, prompt and completion tokens, estimated cost, elapsed time. Filters: date range, feature. Paged |
| **Platform** (57) | table: feature, model, calls, prompt and completion tokens, estimated cost, cache hits, average latency, schema failures, estimate error percent. Date range filter. A note: "Totals for all users. No individual content is shown." |

Cost is shown in dollars to four decimals and labelled "estimated cost" (the unit comes from the provider's rate control, not an invoice). Empty state: "No AI sessions in this period." A summary row at the top of the Platform tab with the totals for the filtered range. My AI sessions has none, because its list is paged and endpoint 56 returns no totals.
