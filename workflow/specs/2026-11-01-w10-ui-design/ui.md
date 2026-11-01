# UI: shell, navigation and shared behaviour

Draft. Reference for the W10 mockups. Realises architecture §13 (screens and states) and AD-71 (one person designs the whole UI; the others link their flows to the backend). Endpoint numbers are those of [contracts.md](../../../docs/architecture/contracts.md). Copy marked † is fixed by the architecture; all other copy is proposed and can change in the mockups.

How the files fit: this file holds what every screen shares. [flows.md](flows.md) walks each role through the product end to end. The screens themselves, with their contents and interactions, are in [screens-shared.md](screens-shared.md), [screens-project.md](screens-project.md), [screens-pm.md](screens-pm.md), [screens-lead.md](screens-lead.md) and [screens-dev.md](screens-dev.md).

## 1. Screen inventory

Twenty screens, which cover the eleven of §13 plus the supporting ones the endpoints need (members, task detail, project settings, new project). **Tier** is the delivery-plan tier of the endpoints the screen cannot work without: Tier 1 mockups are due 2 Nov, Tier 2 by 5 Nov (AD-71). A screen can be Tier 1 with some Tier 2 controls; each screen file marks those controls.

| ID | Screen | Can open | Can act | Route | §13 row | Tier |
|---|---|---|---|---|---|---|
| S1 | Sign in | anyone not signed in | sign in | `/sign-in` | Sign in and register | 1 |
| S2 | Register | anyone not signed in; a Firebase account with no profile (Finish setup) | register with a role and code | `/register` | Sign in and register | 1 |
| S3 | Projects list | PM, Dev Lead, Developer (own member projects only) | PM: create a project | `/projects` | Projects list | 1 |
| S4 | New project (dialog) | PM | PM: create | over `/projects` | Projects list | 1 |
| S5 | Project overview | members: PM, Dev Lead, Developer | read only | `/projects/:id` | Project board and backlog | 1 |
| S6 | Board | members: all roles | Dev Lead: any task's status; Developer: own tasks' status; PM, Dev Lead: add task; PM: status read only | `/projects/:id/board` | Project board and backlog | 1 |
| S7 | Backlog | members: all roles | PM, Dev Lead: epics and tasks; Developer: read only | `/projects/:id/backlog` | Project board and backlog | 1 |
| S8 | Task detail (drawer) | members: all roles | PM, Dev Lead: edit; Dev Lead and assignee: status | over S6, S7, S19 (`?task=:taskId`) | Project board and backlog | 1 (history 2) |
| S9 | Checkpoints | members: all roles | PM, Dev Lead: add, edit, delete | `/projects/:id/checkpoints` | Checkpoints and sprints | 1 (edit, delete 2) |
| S10 | Sprints | members: all roles | Dev Lead: create, start, close, delete | `/projects/:id/sprints` | Checkpoints and sprints | 2 |
| S11 | Members | members: all roles | PM adds Dev Leads; Dev Lead adds Developers; Developer: read only | `/projects/:id/members` | none in §13 | 1 (remove 2) |
| S12 | Project settings | PM | PM: rename, archive | `/projects/:id/settings` | none in §13 | 2 |
| S13 | Usage | all roles | read only (own sessions; platform totals) | `/usage` | Usage | 2 |
| S14 | New plan | PM | PM: generate, edit, approve, reject | `/projects/:id/plan`, `/projects/:id/plan/:proposalId` | New plan | 1 (edit, regenerate 2) |
| S15 | Plan history | PM | read only | `/projects/:id/plan/history` | New plan | 2 |
| S16 | Overview (all my projects) | Dev Lead | read only | `/lead/overview` | Overview | 2 |
| S17 | Project health | Dev Lead, PM (facts only) | Dev Lead: generate digest, apply re-plan; PM: read facts | `/projects/:id/health` | Project health | 1 (re-plan 2) |
| S18 | Team standups | Dev Lead | read only | `/projects/:id/standups` | Team standups | 1 |
| S19 | My work | Developer | Developer: own tasks' status and blocked flag | `/my-work` | My work | 1 |
| S20 | Upload and standup | Developer | Developer: upload, summarise, generate, edit own standup | `/projects/:id/standup` | Upload and standup | 1 (edit, feedback 2) |

**Can open** is who sees the screen in navigation and can load it; every project screen additionally requires membership of that project, otherwise 404. **Can act** is what each role may do on it, taken from the policy map (§7). The two differ on purpose: most project screens are readable by every member and writable by a few roles, so "who sees the page" alone would hide that.

## 2. The shell

Every signed-in screen sits in one shell (R6: one layout component, no per-role copies).

| Region | Content | Notes |
|---|---|---|
| Top bar | product name (links home); project switcher when inside a project (lists the member projects from endpoint 6); **Usage** link (Tier 2; hidden in Tier 1); user menu | the user menu shows display name, email, a **role badge** (`Project Manager`, `Dev Lead`, `Developer`) and **Sign out**. The role is read from endpoint 4 and cannot be changed in the UI |
| Left navigation | role-based items (section 3) | collapses to icons below 1100 px wide |
| Project header | project name, status chip (`Archived` shown when archived), project tabs | appears on every `/projects/:id/...` screen; tabs depend on role (section 3) |
| Content | the screen | max width 1200 px; the board may use the full width |
| Banner slot | archived banner, offline or AI notices | sits between the project header and the content |
| Toast area | success confirmations and non-blocking errors | confirmations auto-dismiss after 4 s; errors stay until closed |

**Design decisions proposed for the mockups** (change them there, not in the code):
- Desktop first, designed for 1280 px wide. Down to 1024 px the layout is complete; below that it stacks without extra design. Mobile is not designed.
- Light theme only for the MVP. The design tokens (colour, type, spacing, radius, elevation) are defined once in the mockup file and mirrored as CSS variables in `apps/web`.
- Status is never carried by colour alone: every chip has a text label and an icon.
- Everything is reachable from the keyboard. The board offers a **Change status** menu on every card as the alternative to drag and drop.

## 3. Navigation by role

Left navigation (outside a project):

| Item | PM | Dev Lead | Developer | Tier |
|---|---|---|---|---|
| Projects (S3) | yes | yes | yes | 1 |
| Overview (S16) | no | yes | no | 2 |
| My work (S19) | no | no | yes | 1 |
| Usage (S13) | yes | yes | yes | 2 |

Landing page after sign-in: PM goes to S3; Dev Lead goes to S16 once it exists (Tier 1: S3); Developer goes to S19. A deep link that was open when the session expired is restored after sign-in.

Project tabs (inside a project). A tab that a role has no use for is hidden, not disabled (the UI hides actions as a convenience only; the server is the control, §7).

| Tab | PM | Dev Lead | Developer | Screen | Tier |
|---|---|---|---|---|---|
| Overview | yes | yes | yes | S5 | 1 |
| Board | yes | yes | yes | S6 | 1 |
| Backlog | yes | yes | yes | S7 | 1 |
| Checkpoints | yes | yes | yes | S9 | 1 |
| Sprints | yes (read) | yes | yes (read) | S10 | 2 |
| Plan | yes | no | no | S14 | 1 |
| Health | yes (facts only) | yes | no | S17 | 1 |
| Standups | no | yes | no | S18 | 1 |
| My standup | no | no | yes | S20 | 1 |
| Members | yes | yes | yes | S11 | 1 |
| Settings | yes | no | no | S12 | 2 |

My work (S19) spans projects, so it is outside the tabs; each task in it links to its project.

## 4. Global states and error handling

Every screen implements the same states, from one set of shared components (`PageState`, `ErrorPanel`, `EmptyState`, `Skeleton`). The mockups draw each screen's *populated* state plus the screen-specific states listed in its file; the common ones are drawn once as a sheet.

| State | What the user sees |
|---|---|
| Loading | skeleton of the screen's layout, not a spinner over a blank page |
| Empty | one explanatory line and the primary action for the role (the line differs per role; screen files give it) |
| Error | the server's message, the request id in small text, and **Try again** |
| Unauthorized (401) | redirect to S1 with the return path kept |
| Forbidden (403 `FORBIDDEN_ROLE`) | full-page "Your role cannot open this page" with a link home. Navigation never links there, so this is reached only by typing a URL |
| Not found (404) | "Not found". Never says whether the thing exists in another project (AD-33) |
| Not registered (403 `USER_NOT_REGISTERED`) | redirect to S2 at the **Finish setup** step |

Behaviour per API outcome, applied wherever the call is made:

| Outcome | UI behaviour |
|---|---|
| 422 `VALIDATION_FAILED` | the message from `details[].field` is shown under that field; unknown fields cannot occur because the form is built from the shared schema |
| 409 `CONFLICT_VERSION` | inline banner on the edited item: "Someone else changed this. Reload to see their version." with **Reload**. The user's unsaved edit stays visible until they choose |
| 409 `CONFLICT_STATE` | the server message is shown next to the control that failed (for example "This task is in a closed sprint"). Never a generic error |
| 429 `AI_BUSY` | † "busy, try again in N seconds"; the AI button is disabled and counts down from `Retry-After` |
| 429 `RATE_LIMITED` | same countdown, with the copy of the cause: code check, regeneration limit or session limit |
| 503 `AI_UNAVAILABLE` | † "LLM unreachable. Please try again later" |
| 503 `AI_DISABLED` | "AI features are switched off in this environment." Non-AI features keep working |
| 422 `REQUEST_REFUSED` | "The assistant declined this request because it is outside project planning. Rephrase it or create the plan manually." |
| 200 with `degraded: true` | a note on the AI part: "The AI part is unavailable right now. This shows what could be computed without it." |
| 200 with `flagged: true` | † a "flagged for review" marker on the item, summary, standup or digest. The text is still shown, as plain text |
| 413 `PAYLOAD_TOO_LARGE` | "That file is larger than 1 MB." |
| 500 `INTERNAL` | "Something went wrong." plus the request id, so a teammate can find it in the logs |
| network failure | an offline banner; actions that write are disabled until the next successful request |

**Archived project.** Every `/projects/:id/...` screen shows the banner "This project is archived and read-only." Every write control (create, edit, status change, drag, upload, generate) is disabled with the tooltip "Archived projects are read-only". A server 409 `CONFLICT_STATE` on a write is handled the same way, in case the archive happened after the page loaded.

**Concurrency.** Every edit sends the `version` it loaded. After a successful write the screen replaces its copy with the response. Double clicks on a submit button are ignored while the request is in flight (the server is idempotent where it matters, AD-35, but the UI does not rely on it).

**Plain text rule (A-15).** All user, AI and uploaded text is rendered as plain text. No markdown, no HTML, no links except `https:` item URLs, which open with `rel="noopener noreferrer"` in a new tab. Multi-line text keeps its line breaks.

**Destructive actions** use one confirmation dialog: names the thing, says what happens to its children, has a **Cancel** (default focus) and a red confirm button labelled with the verb ("Delete epic").

## 5. Shared components

The mockup file defines each once. Screen files refer to them by name.

| Component | Used by | Purpose |
|---|---|---|
| `AppShell`, `ProjectHeader`, `ProjectTabs` | all | section 2 |
| `PageState` | all | loading, empty, error wrapper |
| `ConfirmDialog` | all destructive actions | section 4 |
| `RoleBadge` | shell, member lists | the three roles |
| `StatusChip` | board, backlog, task detail | `To do`, `In progress`, `In review`, `Done` |
| `BlockedBadge` | cards, rows, detail | red flag with the reason in a tooltip |
| `PointsBadge` | tasks, epics | story points; "unestimated" when null |
| `ProgressBar` | project list, overview, health | points done of total, with the percent as text |
| `RiskBadge` | health, checkpoints (PM, Dev Lead) | `ON_TRACK`, `AT_RISK`, `UNKNOWN` |
| `TaskCard`, `TaskRow` | board, backlog, my work | one task; both variants share the same data props |
| `EpicHeader` | backlog, plan | title, checkpoint chip, task count, points |
| `FlagMarker` | AI text, items | "flagged for review" |
| `DegradedNote` | AI results | section 4 |
| `AiButton` | every AI action | normal, in flight, busy with countdown, disabled with reason |
| `PlainText` | all AI and user text | enforces the plain text rule |
| `DateField` | sprints, checkpoints, standups | `YYYY-MM-DD`, read in `Asia/Singapore` (AD-37) |
| `UserPicker` | assignee, add member | lists project members only |
| `Pagination` | lists | `page`, `size` (default 20, at most 100) |
| `Toast` | all | section 2 |

## 6. Roles at a glance

What each role can do in the UI. Each cell is the policy map of §7; the screens enforce it by hiding or disabling.

| Capability | PM | Dev Lead | Developer |
|---|---|---|---|
| Create or archive a project | yes | no | no |
| Add members | Dev Leads | Developers | no |
| Create or edit checkpoints, epics and tasks | yes | yes | no |
| Change a task's status or blocked flag | no | any task | own assigned tasks only |
| Create, start, close, delete sprints | no | yes | no |
| Generate, edit, approve or reject a plan | yes | no | no |
| Read facts (progress, forecast, checkpoint risk, overload) | yes | yes | no |
| Generate a digest, approve a re-plan | no | yes | no |
| Upload activity, summarise, generate or edit a standup | no | no | yes |
| Read standups | no | developers of their projects | own only |
| Usage: own sessions and platform totals | yes | yes | yes |

## 7. Endpoint coverage

Moved to [endpoint-coverage.md](endpoint-coverage.md), which maps every endpoint of contracts.md to its screens.

## 8. Decisions on the open points (operator, 2026-11-01)

All eight were answered by the operator. The ones that touch another owner's work are handovers in the branch state.

| ID | Point | Decision |
|---|---|---|
| Q1 | Endpoint 6 returns `Project` without `progress`, but S3 shows a bar per project | Approved: ask the Dev Lead (W5 owner) to return `ProjectDetail` items from endpoint 6. If refused, S3 calls endpoint 7 per visible row. A contract change, so a handover |
| Q2 | A PENDING plan can be resumed only by its id; the list endpoint 36 is Tier 2 | Approved: promote endpoint 36 to Tier 1 so the PM gets **Continue plan**. A scope change for W7, so a handover |
| Q3 | No endpoint lists a user's tasks across projects | Approved: S19 calls endpoint 6, then 20 per project with `assigneeId` = me |
| Q4 | Which Firebase sign-in methods | Approved: email and password only |
| Q5 | Checkpoint risk comes from `Facts` (endpoint 42), Dev Lead only | Changed by the operator: **the PM may also read facts** (endpoint 42), so the PM sees current progress, forecast, checkpoint risk and overload. The digest, its suggestions and the re-plan stay Dev Lead only. A permission change: it amends AD-47 and the policy map, so it is a handover (see below) |
| Q6 | No endpoint lists a Developer's items after a reload | Approved: the item list in S20 exists only for the file uploaded in this visit; summaries and the standup survive a reload |
| Q7 | Standup date | Changed: not a date picker. A two-option selector, see below |
| Q8 | A Dev Lead cannot read the plan a PM approved (endpoint 35 is PM only) | Approved: the Dev Lead works from the backlog |

**Standup selector (Q7).** A standup exists to prepare the next daily standup, so S20's selector offers exactly two choices:
- **For the next standup** (default): the next working day, Monday to Friday, in `Asia/Singapore` (AD-37, AD-44). Shown with its date, for example "Tue 3 Nov".
- **For today**: for when more work was done before today's standup.

The selector sends the chosen date as `date` to endpoint 51 and 52. Each choice has its own stored standup (one per developer, project and day, AD-27), so switching between them shows each one's own content. S18 uses the same two options plus **Earlier** (the last 7 days); its default is **For today**, which is what a Dev Lead reads on the day. Contracts.md says only "`date?` (default today)": whether a future date is accepted, and how the activity window is anchored for it, is a handover to the W9 owner.

**Facts for the PM (Q5).** The PM gets a read-only **Health** tab on S17: the facts panel only, with no digest panel and no suggestions. S9 shows the PM the same `RiskBadge` as the Dev Lead. The overload block is computed over the *caller's own* projects (A-08), so for a PM it covers the PM's member projects; the block keeps its line saying so. The PM gets the whole `Facts` response, not a trimmed one: they manage the whole project, or several. Decided by the operator. Contract consequences, for the owners of the policy map and of `lead`:
- Endpoint 42 keeps its number but moves to the shared path `GET /api/projects/{id}/facts`, because AD-07 reserves `/api/lead` for the Dev Lead. The old `/api/lead/projects/{id}/facts` path is removed, so there is no duplicate and the endpoint count stays 57.
- Its policy becomes `PM, LEAD; member`.
- Architecture §7's operation table, AD-47, `contracts.md` §3.5 and the generated authorisation tests must be amended to match. The digest endpoints (44, 45) and the re-plan endpoints (46 to 48) are unchanged.
