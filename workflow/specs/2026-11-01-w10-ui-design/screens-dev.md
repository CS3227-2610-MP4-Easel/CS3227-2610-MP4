# Developer screens (S19, S20)

Common states, error handling and components are in [ui.md](ui.md). The Developer also uses S3 to S9, S11 and S13 from [screens-shared.md](screens-shared.md) and [screens-project.md](screens-project.md), read-only except for the status of their own tasks.

## S19 My work

Route `/my-work`. Developer. Endpoints 6, 20, 24, 22 via S8. There is no cross-project task endpoint (Q3 in ui.md), so the screen loads the member projects and then the caller's tasks in each.

| Region | Content |
|---|---|
| Header | "My work"; counts "{n} open, {b} blocked" |
| Filters | project (all or one), **Active sprint only** (default on when the project has an active sprint), **Hide done** (default on) |
| Groups | one group per project (project name links to S5), tasks inside by status order `In progress`, `In review`, `To do`, `Done` |
| `TaskRow` | title, epic, `PointsBadge`, sprint chip, `StatusChip` as a select, `BlockedBadge` with a toggle |

| Interaction | Result |
|---|---|
| Click a task title | S8 as a drawer |
| Change status | endpoint 24 `{ status, version }`; the row updates at once and reverts with the message on failure. Only assigned tasks appear, so every row is editable |
| Mark blocked | the reason dialog of S6 (required, up to 500) then endpoint 24 |
| Unblock | endpoint 24 `{ blocked: false }` |
| A task in a closed sprint | the controls are replaced by a lock and "Sprint closed" |

States:
- Empty: "No tasks are assigned to you yet. Your Dev Lead assigns tasks from the backlog."
- Empty because of filters: "Nothing matches these filters." with **Clear filters**.
- A project that is archived keeps its group, read-only.
- Partial failure while loading (one project's request fails): the other groups show and the failed group shows an error panel with **Try again**.

## S20 Upload and standup

Route `/projects/:id/standup`. Developer, project member. Endpoints 49, 50, 51, 52. T2: 53, 54. The page is a vertical sequence of three panels; the panels are independent, so the Developer can skip to the standup without uploading anything.

### Panel 1: Upload activity

| Region | Content |
|---|---|
| Intro | "Upload a JSON file of your commits and pull requests. Only titles, short bodies and file names are used. Diffs are never read." |
| Drop zone | choose or drop one `.json` file; **Download an example file** (a static sample of the `items` format) |
| Rules | at most 1 MB and 100 items; links must be `https:` |

| Interaction | Result |
|---|---|
| Choose a file | the browser parses it and checks it against the shared `ActivityItemInput` schema **before sending**. Problems are listed per item ("Item 14: title is required"). If the file is not JSON or is above 1 MB or 100 items, nothing is sent and the message names the limit. A file with some bad items offers **Upload the valid items** (the server would also report them in `rejected`) |
| Upload | endpoint 49 `{ items }`. While waiting, the zone shows a progress state |
| 200 | a result strip: "{created} new, {updated} changed, {unchanged} unchanged, {rejected} rejected". Rejected items are listed with their index and reason. Panel 2 starts on its own if there is anything to summarise |
| 413 | "That file is larger than 1 MB." |
| 422 | the validation message(s) |

Re-uploading the same file is safe: it reports everything as unchanged.

### Panel 2: Summaries

Appears after an upload that returned `needsSummary` ids.

| Region | Content |
|---|---|
| Progress | a bar "Summarised {done} of {total}"; the work runs in batches of at most 10 items, one request each (endpoint 50), one after another |
| Item list | the items of this upload (titles come from the file in the browser): type icon (commit or pull request), title, the one-line summary when ready (plain text), `FlagMarker` where flagged |

| Interaction | Result |
|---|---|
| Batch succeeded | those rows fill in. Items already cached return at once |
| Batch failed (`failed` ids, 503, network) | those rows show "No summary yet" and the panel shows **Retry failed ({n})**. The standup can still be generated without them |
| 429 `AI_BUSY` | the run pauses with the countdown and resumes |
| Leave and return | the item list is gone (Q6 in ui.md) but the stored summaries are still used by the standup |

### Panel 3: Standup

On entry the screen calls endpoint 52 for the selected date (default: the next standup). 404 means none yet.

| State | The panel shows | Controls |
|---|---|---|
| None yet | "No standup for {selected date} yet." | **Generate standup** |
| Standup present | three sections: `Yesterday`, `Today`, `Blockers`, each a list of lines (up to 12 of 300 characters). Badges: `Edited`, `Flagged for review`, and the degraded note "Built from your task activity only" | **Regenerate**; T2: **Edit**, **Use as is**, thumbs up and down |
| Up to date | after **Regenerate** returns `cached: true`: the note "Nothing has changed since this was generated. Upload new activity to refresh it." | none |
| Empty section | the section reads "Nothing to report." (an empty list is valid) | none |

| Interaction | Result |
|---|---|
| Generate or regenerate | endpoint 51 `{ date }`. The panel header holds the two-option selector of ui.md §8: **For the next standup** (default, shown with its date) and **For today**. Each choice loads and stores its own standup. On a model failure the server returns a code-built standup flagged degraded, so the panel never ends empty. 429 `AI_BUSY`: countdown |
| Edit (T2) | the lines turn into editable fields, one per line with add and remove; **Save** sends endpoint 53 `{ content, version }`; the standup then shows `Edited`. Plain text only |
| Use as is (T2) | endpoint 54 `{ accept: true }`; the badge changes to "Accepted" |
| Thumbs (T2) | endpoint 54 `{ feedback }` with `UP`, `DOWN` or `null`; clicking the active thumb clears it |
| Copy | copies the standup as plain text to the clipboard (client only) |

The Developer sees only their own standup; nobody else's appears on this screen.

States: loading skeletons per panel; archived project: the three panels are read-only with the banner (upload and generate disabled); a Developer who is not a member gets 404.
