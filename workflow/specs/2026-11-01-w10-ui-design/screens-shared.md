# Screens shared by all roles (S1 to S13)

Layout regions, fields, interactions and states for each screen. Common states, error handling and components are in [ui.md](ui.md) and are not repeated; only what is specific to the screen is listed. Each interaction row reads: user action → endpoint → what the screen does. **T2** marks a Tier 2 control on a Tier 1 screen.

## S1 Sign in

Route `/sign-in`. Public. Endpoints 4 (after Firebase sign-in).

| Region | Content |
|---|---|
| Card | email, password, **Sign in**, link **Create an account** (to S2) |

| Interaction | Result |
|---|---|
| Sign in | Firebase signs in; the screen calls 4. 200: go to the landing page of the role (ui.md §3). 403 `USER_NOT_REGISTERED`: go to S2 at **Finish setup** |
| Firebase refuses (wrong password, unverified or disabled account) | Firebase's message is shown as returned (AD-57). No custom wording |
| Already signed in and visiting `/sign-in` | redirect to the landing page |

States: submitting (button busy, fields disabled); error (Firebase message under the form). No empty or loading state.

## S2 Register

Route `/register`. Public for step 1 and 2; step 3 needs a Firebase session. Endpoints 2, 3. The registration code and the role are checked **before** the Firebase account exists (§9.1).

| Step | What the user sees | Controls |
|---|---|---|
| 1 Role and code | three role cards (`Project Manager`, `Dev Lead`, `Developer`) each with one line of what the role does; a code field (masked, with a show toggle) | **Continue** |
| 2 Account | email, password, display name (1 to 100) | **Create account** |
| 3 Finish setup | shown only when a Firebase session exists but 4 returned `USER_NOT_REGISTERED`: role cards, code, display name | **Finish** |

| Interaction | Result |
|---|---|
| Continue | endpoint 2 `{ role, code }`. 200: go to step 2, keeping role and code in memory only (never in the URL, storage or logs). 403: "That code was not accepted." 429: "Too many attempts. Try again in N seconds." with a countdown on the button |
| Create account | Firebase sign up, then endpoint 3 `{ role, code, displayName }` with the new token. 201: go to the landing page. 403 `REGISTRATION_CODE_INVALID`: back to step 1 with the same message. 409 `ALREADY_REGISTERED`: "This email is already registered. Sign in instead." with a link to S1. 429: countdown |
| Firebase signup fails | Firebase's message as returned (including its email verification steps if the project requires them) |
| Register fails after Firebase succeeded (network, 429) | the user stays signed in to Firebase; the next visit shows step 3 so they never re-create the Firebase account |
| Finish | endpoint 3 as above |

Notes: the role cannot be changed after registration; step 1 says so. Registration codes are never displayed back.

## S3 Projects list

Route `/projects`. Endpoints 6, 7 (progress, Q1), 5 via S4.

| Region | Content |
|---|---|
| Header | title **Projects**; filter **Active / Archived / All** (default Active); **New project** (PM only) |
| List | one row or card per project, newest first: name, brief (first two lines), status chip, `ProgressBar` (points done of total and percent). No member count: the list has no such field |
| Footer | `Pagination` |

| Interaction | Result |
|---|---|
| Click a project | S5 for that project, for every role |
| New project (PM) | S4 |
| Change filter | endpoint 6 with `status` (omitted for All) |

States:
- Empty, PM: "No projects yet." with **New project**.
- Empty, Dev Lead or Developer: † "ask your PM to add you".
- Archived projects show an `Archived` chip and sort among the rest by creation date.

## S4 New project (dialog)

Over S3. PM only. Endpoint 5.

Fields: name (required, 1 to 200), brief (optional, up to 4000, counter). Buttons **Create** and **Cancel**.

| Interaction | Result |
|---|---|
| Create | 201: close the dialog, open the new project's S5 with a toast "Project created. Next: add a Dev Lead and plan the work." The creator is a member automatically |
| 422 | field errors under name or brief |

## S5 Project overview

Route `/projects/:id`. Endpoints 7, 33, 9, 12. Entry point of every project.

| Region | Content |
|---|---|
| Header | project name, status chip, brief (plain text, expandable if long) |
| Progress card | `ProgressBar`; "{pointsDone} of {pointsTotal} points done"; "{unestimatedTasks} tasks have no estimate" when above 0 |
| Velocity card | bar chart of `completedPoints` per closed sprint (endpoint 33 `velocity`); empty line "No closed sprints yet." |
| Checkpoints card | next three checkpoints by date: name, target date; link **All checkpoints** (S9) |
| Team card | members with `RoleBadge`; link **Manage** (S11) |
| Role call-to-action | PM: **Plan with AI** (S14), **View project health** (S17, read only) and **Add a Dev Lead** when none. Dev Lead: **Check project health** (S17) and **Add developers** when none. Developer: **Upload activity and standup** (S20) |

States: a new project with nothing in it shows the call-to-action card as the main content with a three-step checklist for the PM ("Add a Dev Lead", "Plan the work", "Review the backlog") and for the Dev Lead ("Add developers", "Create a sprint", "Assign tasks"). The checklist ticks itself from the data (members, epics, sprints).

## S6 Board

Route `/projects/:id/board`. Endpoints 20, 24, 27 (sprint filter), 9 (assignee names), 22 via S8.

| Region | Content |
|---|---|
| Filter bar | sprint (default the ACTIVE sprint, else **All tasks**), epic, assignee, **Blocked only**, **Assigned to me** |
| Columns | `To do`, `In progress`, `In review`, `Done`, each with a count and points sum |
| Card | title, epic name, `PointsBadge`, assignee avatar, `BlockedBadge`, a lock when the task is in a closed sprint |

| Interaction | Result |
|---|---|
| Click a card | S8 as a drawer |
| Drag a card to a column, or **Change status** menu on the card | endpoint 24 `{ status, version }`. The card moves at once and snaps back if the call fails, with the message. Allowed to a Dev Lead for any task and to a Developer for a task assigned to them; other cards are not draggable and the menu is absent |
| Mark blocked (card menu) | small dialog asking for the reason (required, up to 500) → endpoint 24 `{ blocked: true, blockedReason }`; **Unblock** sends `blocked: false` |
| **Add task** (PM, Dev Lead) | opens the task form of S7 in a dialog (endpoint 21) |
| Scroll past 100 tasks | **Show more** loads the next page of endpoint 20 |

States:
- Empty, PM or Dev Lead: "No tasks yet. Add the first epic and task in the Backlog, or plan with AI." with both links.
- Empty, Developer: "No tasks in this view."
- A PM sees the board read-only: no drag, no status menu, since status is not a PM operation (§7).
- 409 `CONFLICT_STATE` (closed sprint, archived project): the card snaps back and the message sits on the card.
- 409 `CONFLICT_VERSION`: the card refreshes from the server and the toast says "Someone else changed this task."

## S7 Backlog

Route `/projects/:id/backlog`. Endpoints 16, 20, 17, 21, 23, 24, 12 (checkpoint names), 27 (sprint names), 9. T2: 18, 19, 25.

Structure: epics in order of `position`, each an expandable section with its tasks as `TaskRow`s.

| Region | Content |
|---|---|
| Toolbar | **Add epic**, **Add task** (PM, Dev Lead); search by title (client-side over loaded rows); filters **Unscheduled** (no sprint), **Unassigned**, **No estimate** |
| `EpicHeader` | title, description, checkpoint chip (or "No checkpoint"), task count, points total; T2: edit and delete in an overflow menu |
| `TaskRow` | title, `StatusChip`, `PointsBadge`, assignee, sprint chip, `BlockedBadge`; T2: delete in the row menu |

Forms (dialogs, shared with S6):
- **Epic**: title (required), description, checkpoint (select from endpoint 12, optional). Create is endpoint 17.
- **Task**: epic (required), title (required), description, acceptance criteria (list, add and remove lines, at most 12 of 300 characters), story points (select `1, 2, 3, 5, 8, 13` or none), assignee (`UserPicker`, members only). Create is endpoint 21; edit is endpoint 23.

| Interaction | Result |
|---|---|
| Change points, assignee, epic or sprint inline | endpoint 23 with `version`. Setting a sprint without points is blocked in the form: "Estimate this task before it joins a sprint." (the server would answer 422) |
| Delete epic or task (T2) | `ConfirmDialog`. Epic: "This also deletes its N tasks." 409 if it holds a DONE task: "This epic has finished tasks and cannot be deleted." |
| Drag a task to another epic (optional) | endpoint 23 `epicId` |

States:
- Empty, PM or Dev Lead: "The backlog is empty." with **Add epic** and, for a PM, **Plan with AI**.
- Empty, Developer: "Nothing planned yet."
- Developers see the screen read-only (no add, no inline edit).
- Tasks in a CLOSED sprint show a lock and cannot be edited (A-14).

## S8 Task detail (drawer)

Over S6, S7 or S19, opened by `?task=:taskId`. Endpoints 22, 23, 24, 25, 26 (T2).

| Region | Content |
|---|---|
| Header | title, epic, `StatusChip`, `BlockedBadge` |
| Body | description, acceptance criteria (a checklist display, not tickable: no endpoint stores ticks), story points, assignee, sprint, checkpoint (inherited from the epic) |
| History (T2) | `TaskEvent`s newest first: actor, what changed (from → to), time (endpoint 26, paged) |
| Actions | PM, Dev Lead: **Edit**, **Delete** (T2). Dev Lead and the assignee: **Status** select and **Mark blocked / Unblock** |

Edit mode turns the body into the task form of S7. **Save** sends endpoint 23; **Cancel** discards. A stale version shows the reload banner of ui.md §4 inside the drawer. Closing the drawer returns to the screen underneath with its scroll position kept.

States: loading skeleton; 404 "Not found"; a task in a closed sprint shows the lock and "This task is frozen because its sprint is closed."

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

Route `/projects/:id/sprints`. T2 (endpoints 27 to 32; 33 for velocity). Developers and PMs see it read-only.

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
2. A table of each not-DONE task with a select: **Move to backlog** (default) or a PLANNED sprint by name.
3. **Close sprint** sends `carryOver` with one entry per not-DONE task. If none are left, the table is hidden.
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
| Remove (T2) | `ConfirmDialog`, endpoint 11. 409: "This person still has open tasks. Reassign them first." |

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

Cost is shown in dollars to four decimals and labelled "estimated cost" (the unit comes from the provider's rate control, not an invoice). Empty state: "No AI sessions in this period." Summary row at the top of each tab with the totals for the filtered range.
