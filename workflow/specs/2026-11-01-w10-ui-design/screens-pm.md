# Project Manager screens (S14, S15)

Common states, error handling and components are in [ui.md](ui.md). The PM also uses S3 to S5, S7, S9, S11, S12 and S13, and the read-only facts view of S17 in [screens-lead.md](screens-lead.md), from [screens-shared.md](screens-shared.md) and [screens-project.md](screens-project.md).

## S14 New plan

Route `/projects/:id/plan` (entry) and `/projects/:id/plan/:proposalId` (a plan in progress or finished). PM, project member. The proposal id in the URL is how a PM returns to a plan (Q2 in ui.md). Endpoints 34, 35, 37, 40, 41, and 36 for the continue banner. T2: 38, 39.

This is one screen with a single flow in four phases. The phase is decided by the proposal's data, never by local state, so a reload lands in the same place (the expansion state is stored per epic, §5).

### Phase A: describe the idea

| Region | Content |
|---|---|
| Header | "Plan with AI"; one line saying the assistant drafts an approach, checkpoints, epics and tasks that the PM reviews before anything is created |
| Context | the project name and brief, read-only, with the note "The assistant also looks at similar epics and tasks in your other projects." |
| Plan in progress | shown when endpoint 36 (status `PENDING`) returns a plan: the banner "You have a plan in progress. A new plan replaces it." with **Continue plan**, which opens `/plan/:proposalId` |
| Idea box | a multi-line field, 20 to 6000 characters, live counter, placeholder with an example idea |
| Actions | **Generate plan** (`AiButton`), **Create manually** (link to S7) |

| Interaction | Result |
|---|---|
| Generate plan | endpoint 34 `{ idea }`. The button shows "Drafting the outline…" (this call takes several seconds). 201: go to phase B at `/plan/:proposalId` |
| 422 `VALIDATION_FAILED` | "The idea is empty after cleaning. Describe what the project should do." or the length message |
| 422 `REQUEST_REFUSED` | the refusal copy of ui.md §4; the idea stays in the box |
| 429 `AI_BUSY`, `RATE_LIMITED` | countdown on the button |
| 503 `AI_UNAVAILABLE` | † "LLM unreachable. Please try again later" with **Try again** and **Create manually** |
| 503 `AI_DISABLED` | "AI features are switched off in this environment." with **Create manually** |

The AI is optional: every outcome offers the manual path, so the PM is never stuck.

### Phase B: review the outline and expand the epics

| Region | Content |
|---|---|
| Summary bar | status chip `Draft` (PENDING), "N of M epics ready", a `FlagMarker` if the proposal is flagged |
| Approach | the approach text (plain text) |
| Checkpoints | list of `{ name, target date }` as proposed |
| Similar work used | the `retrieved` items: "{project name} › {item title}" with the source (epic or task). Plain text; shown so the PM can see where suggestions came from |
| Epics | one card per epic, in order: index, title, description, checkpoint chip, and the **expansion state** below |
| Sticky footer | **Approve plan** and **Reject**, with the approval rule (phase C) |

Expansion state of each epic card:

| State | The card shows | Control |
|---|---|---|
| PENDING | "Not expanded" | **Expand** (endpoint 37) |
| IN_PROGRESS | spinner and "Expanding…". If this browser did not start it, "Another request is expanding this epic" | none; the screen re-reads the proposal every 5 s while any epic is in progress |
| DONE | task count, total points; collapsed list of tasks (title, points; expand a task to see its description and acceptance criteria) | **Regenerate** (T2, endpoint 39), **Edit** (T2, endpoint 38) |
| FAILED | the reason by code ("The assistant could not complete this epic" for a model failure, the busy or unavailable copy otherwise) | **Retry** |

| Interaction | Result |
|---|---|
| **Expand all epics** (primary button above the list) | runs endpoint 37 for each non-DONE epic **one after another**, updating each card as it finishes ("3 of 7 expanded"). One request per epic keeps each within the function time limit (§10). **Stop** halts after the current epic. A 429 `AI_BUSY` pauses the run with the countdown and then resumes by itself |
| Expand one epic | endpoint 37 for that epic. Other epics are unaffected by its failure |
| Leave the page during a run | the in-flight epic finishes on the server; returning to `/plan/:proposalId` shows the stored states |
| Regenerate (T2) | `ConfirmDialog` "Replace the tasks with a new draft?" → endpoint 39. 429 `RATE_LIMITED`: "Regeneration limit reached for this plan. Edit the tasks by hand." |
| Edit epic (T2) | inline form for title, description, checkpoint, and the task list (add, remove, change title, description, criteria, points). **Save** sends endpoint 38 with `version`. Changing the title or description sets the epic back to PENDING and shows "Edited. Expand this epic again before approving." |

Partial failure is a first-class state: the mockup draws a plan with some epics DONE, one FAILED and one PENDING.

### Phase C: approve or reject

**Approve plan** is disabled until every epic is DONE, with the tooltip "Expand every epic first (N left)" (AD-46).

| Interaction | Result |
|---|---|
| Approve plan | `ConfirmDialog` summarising what will be created, counted from the proposal: "{c} checkpoints, {e} epics, {t} tasks. You can edit all of them afterwards." Confirm sends endpoint 40 with `version` |
| 200 | phase D (approved) |
| 409 `CONFLICT_STATE` | the server reason in a banner: a newer plan replaced this one, the plan was rejected, an epic is not ready, or the project was archived. The screen reloads the proposal so its status chip is correct |
| 409 `CONFLICT_VERSION` | the reload banner |
| Reject | `ConfirmDialog` "Discard this plan?" → endpoint 41. 200: return to phase A with a toast "Plan discarded." |
| Double click on Approve | ignored while in flight; a repeated request returns the same result anyway |

### Phase D: finished plans (read-only views of the same screen)

| Status | The screen shows |
|---|---|
| APPROVED | the plan as approved, a success banner "Created {c} checkpoints, {e} epics and {t} tasks." and **Open backlog** / **Open board** |
| REJECTED | the plan greyed, the banner "This plan was discarded.", and **Start a new plan** |
| SUPERSEDED | the banner "A newer plan replaced this one." with a link to it when known, otherwise **Start a new plan** |

Notes: starting a new plan while another is PENDING supersedes the earlier one; phase A says so in the plan-in-progress banner (endpoint 36, Q2). AI and uploaded text is plain text throughout.

States specific to this screen: loading skeleton of phase B; 404 for a proposal of another project or one that does not exist; archived project (banner; **Generate**, **Expand** and **Approve** disabled).

## S15 Plan history

Route `/projects/:id/plan/history` (`history` is a reserved segment, never a proposal id). PM. T2. Endpoint 36. Status labels: Draft is `PENDING`, Approved is `APPROVED`, Rejected is `REJECTED`, Replaced is `SUPERSEDED`; the status chip on S14 uses the same labels.

| Region | Content |
|---|---|
| Filter | status: All, Draft, Approved, Rejected, Replaced |
| List | one row per proposal, newest first: created date, status chip, epic count, "flagged" marker if set; opens S14 on that proposal |

Empty state: "No plans yet." with **Plan with AI**. If a Draft exists the screen puts **Continue plan** at the top (this is the resume path of Q2).
