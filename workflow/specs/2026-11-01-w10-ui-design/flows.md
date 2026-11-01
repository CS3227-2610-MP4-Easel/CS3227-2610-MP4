# Flows: each role end to end

Screens are specified in [screens-shared.md](screens-shared.md), [screens-project.md](screens-project.md), [screens-pm.md](screens-pm.md), [screens-lead.md](screens-lead.md) and [screens-dev.md](screens-dev.md); shared rules in [ui.md](ui.md). This file strings them into the journeys the mockups must let a reviewer click through. Notation: `S5` is a screen; `→` is a navigation or a result; `[T2]` marks a Tier 2 step. Each flow ends with its failure branches.

## F1 First visit: register and sign in (all roles)

1. Open the app, unauthenticated → S1.
2. **Create an account** → S2 step 1: pick a role card, type the code, **Continue** (endpoint 2).
3. Step 2: email, password, name → **Create account** (Firebase signup, endpoint 3) → landing page of the role: PM → S3, Developer → S19, Dev Lead → S3 (S16 `[T2]`).
4. Next visits: S1 → landing page.

Failure branches:
- Wrong code → step 1, "That code was not accepted."
- Too many attempts → step 1 with a countdown.
- Signed up in Firebase but `register` failed → the next sign-in goes to S2 **Finish setup**.
- Registered twice → "Sign in instead."

## F2 Project Manager: idea to a populated backlog

The PM's main value path, and the one with the most states.

1. S3 → **New project** → S4 (name, brief) → S5 with a checklist.
2. S5 → **Add a Dev Lead** → S11, email → the Dev Lead appears in the list.
3. S5 → **Plan with AI** → S14 phase A: type the idea → **Generate plan**.
4. Phase B: the PM reads the approach, checkpoints and similar work used. Epics are all "Not expanded".
5. **Expand all epics**: cards fill in one at a time; progress reads "3 of 7 expanded".
6. `[T2]` The PM edits one epic's tasks, or regenerates one; the card returns to "Not expanded" if its title or description changed, and is expanded again.
7. All epics DONE → **Approve plan** becomes active → confirmation with counts → Approve.
8. Phase D: "Created 3 checkpoints, 6 epics and 31 tasks" → **Open backlog** → S7 shows the new epics and tasks.
9. S9 shows the checkpoints; S5's progress is 0 of N points.
10. Later, the PM opens the **Health** tab (S17, read only) to see current progress, forecast and checkpoint risk as the Dev Lead and Developers update the work.

Failure branches:
- The model is down or switched off at step 3 → error panel with **Create manually** → S7: **Add epic**, **Add task**, S9: **Add checkpoint**. The product is fully usable without AI.
- One epic fails at step 5 → that card shows **Retry**; the rest continue; Approve stays disabled until it is DONE.
- Busy at step 5 → the run pauses with a countdown and resumes.
- A teammate approved or replaced the plan meanwhile → the 409 banner at step 7 explains and reloads.
- The PM closes the tab at step 5 → returning to `/plan/:proposalId` (from the browser history, or from the **Continue plan** banner on S14; S15 `[T2]` lists all plans) shows each epic in its stored state.
- **Reject** at step 7 → back to phase A.

## F3 Dev Lead: staff the project and run a sprint

1. S3 → open the project (the PM added them) → S5.
2. S11 → **Add a Developer** by email, one per developer.
3. S7: review the backlog, give each task story points and an assignee (inline). Tasks without points cannot join a sprint.
4. `[T2]` S10 → **New sprint** (name, dates) → assign tasks to it from S7 (sprint chip on each row) → **Start**.
5. Through the sprint: S6 shows the sprint's tasks; the Dev Lead can move any task; a Developer moves their own.
6. `[T2]` End of sprint: S10 → **Close sprint** → the carry-over table (each unfinished task: backlog or a PLANNED sprint) → confirm → velocity updates in S5 and S10.

Failure branches:
- Remove a member who still has open tasks `[T2]` → 409 message, reassign first.
- Start a sprint while another is active → **Start** disabled with the reason.
- Sprint dates overlap → inline 422 message.
- Two Dev Leads edit the same task → the reload banner.
- Archived project → everything read-only, banner.

## F4 Dev Lead: check health and re-plan

1. S3 → S5 → **Check project health** → S17; or `[T2]` S16 → the project row → S17.
2. The facts panel loads without any AI: progress, velocity, checkpoint risk, overload.
3. **Generate digest** → explanation text appears under the facts. If nothing changed since the last digest, a note says so and no model runs.
4. `[T2]` If the digest carries suggestions, the list appears: tick the ones to apply → **Apply selected** → confirmation → done; the facts reload.
5. Back in S9, the moved checkpoint dates show.

Failure branches:
- The model is down → the facts stay, the digest panel shows the degraded note, **Try again**.
- No closed sprints → forecast cells read "No forecast yet" and a hint to close a sprint.
- A suggestion no longer fits (a task moved meanwhile) `[T2]` → 409, nothing applied, the stale rows are marked, the rest can be applied again, or the digest is regenerated.
- Busy → countdown.

## F5 Dev Lead: read the team's standups

1. The **Standups** tab of the project → S18 (today by default; the selector also offers the next standup and **Earlier**, a list of the last 7 days).
2. One card per developer; developers without one say "not generated". Pick an earlier day to look back.
3. A card with `Built from task activity only` tells the Dev Lead that the AI part failed for that developer.

No write actions exist on this flow.

## F6 Developer: the daily loop

1. Sign in → S19: the tasks assigned to them, grouped by project.
2. Update a task: change status or mark it blocked with a reason; the Dev Lead sees it on S6.
3. Open the project's **My standup** tab → S20.
4. Upload the activity file → counts, rejected items → summaries fill in batch by batch.
5. Pick **For the next standup** (the default) or **For today**, then **Generate standup** → Yesterday, Today and Blockers appear.
6. `[T2]` Edit lines, click **Use as is**, rate with a thumb.

Failure branches:
- File over 1 MB or 100 items, bad items → named in the panel before sending.
- Summaries fail for some items → **Retry failed**, or generate the standup anyway.
- Model down at step 5 → a standup built from the Developer's own task events is shown as degraded.
- Re-upload of the same file → everything "unchanged"; **Regenerate** says nothing changed.
- Task in a closed sprint → locked.

## F7 One run through the whole product (the demo path)

The order a reviewer sees in the demonstration, and the order for the seed data (W13):

| Step | Actor | Screens |
|---|---|---|
| 1 | PM registers, creates a project, adds the Dev Lead | S2, S4, S11 |
| 2 | PM plans with AI and approves | S14, S7, S9 |
| 3 | Dev Lead registers, adds a Developer, estimates and assigns tasks | S2, S11, S7 |
| 4 | Dev Lead creates and starts a sprint `[T2]` | S10, S6 |
| 5 | Developer registers, moves a task, uploads activity, generates a standup | S2, S19, S20 |
| 6 | Dev Lead reads the standup and checks health, generates a digest | S18, S17 |
| 7 | Dev Lead applies a re-plan suggestion `[T2]` | S17, S9 |
| 8 | Anyone opens usage `[T2]` | S13 |

## How AI failure looks, by role

The same failure is handled differently per role (AD-34); the mockups must show all three.

| Role | Feature | When the model fails or is disabled |
|---|---|---|
| PM | plan (S14) | an error with **Create manually**; nothing is produced |
| Dev Lead | digest (S17) | the facts remain; the explanation is replaced by the degraded note |
| Developer | standup (S20) | a standup built from task events, marked degraded; summaries show "No summary yet" |
