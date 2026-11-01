# Dev Lead screens (S16, S17, S18)

Common states, error handling and components are in [ui.md](ui.md). The Dev Lead also uses S3 to S11 and S13 from [screens-shared.md](screens-shared.md); sprint management (S10) and checkpoint editing (S9) are theirs.

## S16 Overview (all my projects)

Route `/lead/overview`. Dev Lead. T2. Endpoint 43. In Tier 1 the Dev Lead lands on S3 instead.

| Region | Content |
|---|---|
| Header | "Overview"; "{n} projects"; the time of the data ("as of") |
| Table | one row per member project: name, `ProgressBar`, `avgVelocity` (or "no history"), projected completion date (or "unknown"), number of checkpoints at risk, `RiskBadge` of the worst checkpoint, digest status (`Latest digest {date}`, `Out of date`, `None`) |
| Row action | the whole row opens S17 for that project |

The list contains only projects the Dev Lead is a member of (endpoint 43 never returns others). Sorting: at-risk projects first, then by name.

States: empty "You are not a member of any project yet. Ask a PM to add you."; a project with no estimates shows "no estimates" instead of 0%.

## S17 Project health

Route `/projects/:id/health`. Dev Lead, project member; a PM who is a member sees the **facts panel only** (see PM view below). Endpoints 42, 44, 45; 46, 47, 48 (re-plan, T2); 12, 16, 20, 9 (names behind ids in suggestions). Facts appear first and need no AI; the digest is added on demand, so a failure of the model never empties the screen (AD-34).

### Facts panel (no AI)

Loaded with endpoint 42 on entry, always.

| Block | Content |
|---|---|
| Progress | points done of total, percent, points remaining, tasks without an estimate |
| Velocity | the closed sprints as bars, `avgVelocity` over the last three; projected completion date (or "No forecast yet") |
| Checkpoint risk | table: checkpoint, target date, remaining points, projected date, `RiskBadge` |
| Overload | table of people with open points across your projects: name, open points, average completed per sprint, the projects behind it; computed over **the Dev Lead's own projects only**, with a line saying so |

States: with no closed sprint the forecast cells show "No forecast yet" and `UNKNOWN`, with the line "Close a sprint to get a forecast." (§11); an empty overload table reads "No one is overloaded across your projects."

### Digest panel (AI)

On entry the screen loads endpoint 45. 404 means none yet.

| State | The panel shows | Control |
|---|---|---|
| No digest yet | "No digest yet." | **Generate digest** |
| Digest present | the explanation (plain text), the time generated, `FlagMarker` if flagged | **Refresh digest** |
| Degraded | the facts stay, `explanation` is empty, the `DegradedNote` | **Try again** |
| Busy or disabled | the countdown (429) or "AI features are switched off in this environment." | none |

| Interaction | Result |
|---|---|
| Generate or refresh | endpoint 44. While waiting, the button shows "Analysing…" and the facts stay visible. 200 with `cached: true`: a quiet note "Nothing has changed since the last digest." and no new text. 200 with a `proposalId`: the suggestions list appears. 200 `degraded`: the degraded state |
| 429 `AI_BUSY` | countdown on the button |

Only the explanation and the suggestions come from the model. Every number comes from code and is labelled with its source ("from project data").

### Suggestions list (re-plan, T2)

Shown when the latest digest has a PENDING re-plan proposal (endpoint 46 filtered to PENDING; the digest's `proposalId` finds it directly).

| Region | Content |
|---|---|
| Header | "Suggested changes ({n})"; the explanation line; `FlagMarker` if flagged |
| Rows | a checkbox, a sentence built from the suggestion, and the rationale (up to 300 characters, plain text) |
| Footer | **Apply selected ({n})** and **Dismiss all** |

How each suggestion reads (names are looked up from the project's checkpoints, epics, tasks and members, because the payload carries ids):

| Type | Sentence |
|---|---|
| `MOVE_CHECKPOINT_DATE` | "Move checkpoint **{name}** from {old date} to {new date}" |
| `MOVE_EPIC_TO_CHECKPOINT` | "Move epic **{title}** from {old checkpoint or none} to {new checkpoint or none}" |
| `REASSIGN_TASK` | "Reassign task **{title}** from {current assignee or unassigned} to {new assignee}" |

| Interaction | Result |
|---|---|
| Apply selected | `ConfirmDialog` listing the chosen changes, then endpoint 47 `{ version, suggestionIds }`. 200: the applied rows turn into a confirmation, the facts reload, a toast says "{n} changes applied." |
| 409 `CONFLICT_STATE` listing suggestions | **Nothing was applied.** The listed rows are marked "Out of date: {reason}" and unchecked and disabled; the rest stay selectable. A button **Generate a new digest** is offered |
| Dismiss all | `ConfirmDialog` then endpoint 48; the list disappears, the digest text stays |
| Nothing selected | **Apply selected** is disabled |

The Dev Lead can approve only a subset, so every suggestion is a separate decision. Suggestions are never applied without this step (AD-10).

## S18 Team standups

Route `/projects/:id/standups`. Dev Lead, project member. Endpoints 55, 9. Read only.

| Region | Content |
|---|---|
| Filter bar | standup day (**For today** by default, **For the next standup**, or **Earlier** for the last 7 days; ui.md §8), developer (all or one) |
| Cards | one per **developer member** of the project, in name order. A card shows `Yesterday`, `Today` and `Blockers` as bullet lists in plain text, and the badges below |
| Badges | `Edited` when the developer changed it, `Built from task activity only` (degraded), `Flagged for review` |

Developers with no standup for the selected day show a card with the line † "not generated". The screen does not show the developer's thumbs rating (it is feedback on the AI, not status).

States: no developers in the project: "No developers have been added. Add them in Members." with a link; archived project: still readable.

## S17, PM view

The PM opens the same route from the **Health** tab. The facts panel is identical to the Dev Lead's and loads from the same endpoint 42; the overload block covers the PM's own member projects. The digest panel and the suggestions list are not rendered for a PM, and no AI call can be started from this view. The header line reads "Read only. The Dev Lead generates the digest and applies re-plan changes." The purpose is that the PM sees current progress, forecast and checkpoint risk without asking.
