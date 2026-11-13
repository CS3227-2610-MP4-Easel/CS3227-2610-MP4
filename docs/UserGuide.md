# Easel User Guide

Easel is a web app for running a small Scrum project. A **Project Manager** turns an idea into a plan with an AI assistant, a **Dev Lead** runs the backlog, board and sprints and reads an AI digest of project health, and a **Developer** works on assigned tasks and prepares a daily standup with AI help from their own commits and pull requests.

This guide describes the deployed app as it is now: what each role can do, how to reach it, and how to test it. Where a feature is not available yet, it says so under [Known limitations](#9-known-limitations).

<!-- TEAM: fill in the two values marked [FILL IN] before submission. -->

- [1. Accessing Easel](#1-accessing-easel)
- [2. Signing up and signing in](#2-signing-up-and-signing-in)
- [3. Getting around](#3-getting-around)
- [4. Project Manager](#4-project-manager)
- [5. Dev Lead](#5-dev-lead)
- [6. Developer](#6-developer)
- [7. Pages every role shares](#7-pages-every-role-shares)
- [8. AI features: limits and messages](#8-ai-features-limits-and-messages)
- [9. Known limitations](#9-known-limitations)
- [10. Suggested test walkthrough](#10-suggested-test-walkthrough)

---

## 1. Accessing Easel

- **URL:** https://agile-platform.vercel.app/
- **Browser:** a current desktop browser (Chrome, Edge, Firefox or Safari). The layout is designed for a laptop screen or wider.
- **Registration codes:** every role needs its own registration code to sign up. 
- REGISTRATION_CODE_PM=EASEL_PM_CODE
- REGISTRATION_CODE_DEV_LEAD=EASEL_LEAD_CODE
- REGISTRATION_CODE_DEVELOPER=EASEL_DEV_CODE
- **Accounts:** sign up with any email address and a password; the email is not verified. Use a different email for each role you want to test. A private or incognito window per account keeps sign-ins apart.

The AI features run on the course's language-model service. If the service is busy or switched off, the app says so and the rest keeps working (see [section 8](#8-ai-features-limits-and-messages)).

## 2. Signing up and signing in

### Create an account

1. Open the app. You land on **Sign in**. Click **Create an account**.
2. **Step 1, Role and code (Pick your role):** choose **Project Manager**, **Dev Lead** or **Developer**, enter that role's **Registration code**, and click **Next**. The code is checked before any account is created. Your role cannot be changed after you register.
3. **Step 2, Account (Create your account):** enter a **Display name**, **Email** and **Password**, then click **Create account**.
4. You are signed in and taken to your home page: **Projects** for a Project Manager or Dev Lead, **My work** for a Developer.

If you see:
- **"This account is already registered. Sign in instead."**: that email already has an Easel account. Use **Sign in instead**.
- **Finish setup** when you sign in later: your earlier registration did not complete. Enter your display name to finish.
- **Retry** after a failed step: the step can be repeated with the same values. Repeated attempts are rate-limited per network address (20 a minute); wait and try again.

### Sign in and sign out

- **Sign in:** on the Sign in page enter the **Email** and **Password** you registered with and click **Sign in**.
- **Sign out:** click **Sign out** at the right of the top bar.

## 3. Getting around

**Top bar** (every page):
- **Easel** logo: back to your home page (Projects, or My work for a Developer).
- **Project switcher** (shows the current project, or **All projects**): opens a menu of **All projects** and **Your projects**; pick one to open it.
- **Usage**: your AI usage page ([section 7](#7-pages-every-role-shares)).
- Your name, email and role, and **Sign out**.

**Project tabs** (inside a project):

| Tab | Project Manager | Dev Lead | Developer |
|---|---|---|---|
| Overview | ✓ | ✓ | ✓ |
| Board | ✓ (read-only status) | ✓ | ✓ |
| Backlog | ✓ | ✓ | ✓ (read-only) |
| Plan | ✓ | | |
| Checkpoints | ✓ | ✓ | ✓ |
| Sprints | ✓ (read-only) | ✓ | ✓ (read-only) |
| Health | ✓ (read-only) | ✓ | |
| Standups | | ✓ | |
| My standup | | | ✓ |
| Members | ✓ | ✓ | ✓ (read-only) |
| Settings | ✓ | | |

**Projects page** (Project Manager and Dev Lead): lists every project you are a member of, newest first, with its progress ("Points done"). Click a project to open its **Overview**. A Developer opens projects from the project switcher or from **My work**.

## 4. Project Manager

### 4.1 Create a project

1. On **Projects**, click **New project**.
2. Enter a **Name** (1 to 200 characters) and, optionally, a **Brief** (up to 4,000 characters). The assistant reads the brief when you plan with AI.
3. Click **Create project**. You become a member automatically and land on the project's **Plan** tab.

### 4.2 Add a Dev Lead

A Project Manager can add **Dev Leads** only.

1. Open the project's **Members** tab.
2. Enter the Dev Lead's **Email** (they must already have an Easel account as a Dev Lead) and click **Add Dev Lead**.
3. "Member added." confirms it. The project now appears on the Dev Lead's Projects page.

Adding an email that has no account, or a user of another role, shows an error and adds nobody.

### 4.3 Plan the work with AI (Plan tab)

**Step 1: describe the idea.**
1. In **Describe the idea**, write what the project should deliver (20 to 6,000 characters; a counter shows the length).
2. Click **Generate plan**. The assistant drafts an **Approach**, a list of **checkpoints** (dated milestones) and up to 10 **epics**, each linked to a checkpoint or to **No checkpoint**.

Prefer to skip AI? Use **Create manually** to go to the Backlog instead.

**Step 2: check the epics before tasks are generated.** The draft shows "Draft" and "*n* of *m* epics ready".
- **Edit checkpoints**: rename checkpoints or change their dates (names must be different; each needs a name and a date). **Checkpoints saved.** confirms.
- On each epic: **Edit** (title, description, checkpoint) or **Delete** (a plan keeps at least one epic).
- **Add epic** (up to 10 epics).
- **Confirm and Expand Epics**: the assistant writes the tasks for every epic, with story points (1 to 20). This can take up to a minute.

**Step 3: review the tasks.** Each epic shows **Ready**, **Not expanded** or **Failed**, with its tasks and points.
- **Regenerate** (a Ready epic): writes its tasks again.
- **Expand** or **Retry** (one epic), or **Retry failed epics** (all unfinished ones).
- **Edit** an epic and its tasks yourself (at most 8 tasks per epic; every task needs a title). Changing an epic's title or description keeps its tasks.
- **Delete** an epic and its tasks.

**Step 4: decide.**
- **Approve plan** (available once every epic is Ready): creates the checkpoints, epics and tasks in the project. The message says how many were created, and you are taken to the **Backlog**.
- **Reject plan**: discards the draft ("Plan rejected.") so you can start again.

**Plan history** (link on the Plan tab) lists earlier plans for the project; **Open** shows one. A plan marked **Flagged for review** had text the safety checks flagged; it is still shown, as plain text.

### 4.4 Follow progress

- **Overview**: progress (points done of total), velocity per closed sprint, next checkpoints and the team.
- **Health** (read-only for the PM): the same project facts the Dev Lead sees: progress, velocity, checkpoint risk, and overload across your own projects.
- **Board** (status is read-only for the PM; the page says "Project Manager view: status is read-only.").
- **Backlog**: the same list as the Dev Lead's ([5.2](#52-backlog-epics-and-tasks)), with **Plan with AI**, **Add epic** and **Add task**.
- **Checkpoints**: list and **Add checkpoint** ([5.3](#53-checkpoints)).
- **Sprints** (read-only).

## 5. Dev Lead

A Dev Lead sees a project once its Project Manager adds them ([4.2](#42-add-a-dev-lead)).

### 5.1 Add Developers

On **Members**, enter a Developer's **Email** (they must already have an Easel account as a Developer) and click **Add Developer**. A Dev Lead can add **Developers** only.

### 5.2 Backlog: epics and tasks

The **Backlog** lists epics with their tasks, grouped by epic, with each task's sprint, story points, status, a **Blocked** marker and assignee. Use **Search by title** and the filters **Unscheduled** (no sprint), **Unassigned** and **No estimate**.

- **Add epic**: **Title** (required), **Description**, and an optional **Checkpoint** (an epic belongs to at most one).
- **Add task**: **Epic** (required), **Title** (required), **Description**, **Acceptance criteria** (up to 12 lines of 300 characters; **Add criterion** adds a line), **Story points** (whole number 1 to 20, or none) and **Assignee** (project members only, or Unassigned).

Click a task's title to open it (see [5.4](#54-board)).

### 5.3 Checkpoints

**Checkpoints** lists each checkpoint and its target date. **Add checkpoint** takes a **Name** and a **Target date** (YYYY-MM-DD, Singapore time).

### 5.4 Board

Columns **To do**, **In progress**, **In review** and **Done**, each with its task count and points; 20 tasks per page (**Previous** / **Next**). Filters: **Status**, **Epic**, **Assignee** and **Blocked only**. **Add task** opens the same form as on the Backlog.

- **Change status**: click **…** on a card and pick a status, **Mark blocked** or **Unblock**. A blocked card shows a red **Blocked** marker.
- **Open a task**: click its title. The task panel shows its details and lets you change **Status**, block or unblock it, and **Edit** its title, description and story points.

A task in a closed sprint cannot be changed ("This task is in a closed sprint and cannot be changed.").

### 5.5 Sprints

The **Sprints** tab shows velocity and the sprints (active first, then planned, then closed), each with its dates and points. Click a sprint to show its tasks.

- **New sprint**: **Name**, **Start date** and **End date (inclusive)**, as YYYY-MM-DD. Sprint dates may not overlap.
- **Start** (a planned sprint): only one sprint can be active; Start is disabled while another is active.
- **Edit** or **Delete** a planned sprint. Deleting moves its tasks back to the backlog.
- **Close sprint** (the active sprint): unfinished tasks are listed with **Move to**: **Backlog** (default) or a planned sprint. Done tasks stay in the sprint and count toward velocity.

### 5.6 Health and the AI digest

**Health** shows facts computed from the project data (tagged "from project data"): **Progress**, **Velocity** (average of the last closed sprints, and a projected completion date when there is one), **Checkpoints** at risk, a **Checkpoint risk** table (target, remaining points, projected date, On track / At risk / unknown) and **Overload** (people carrying more than the team's usual load, across your own projects).

**Digest**: click **Generate digest** (later **Refresh digest**) for a short AI explanation of the facts. If nothing changed since the last digest, the same one is shown ("Nothing changed since the last digest, so the same one is shown."). If the AI is unavailable, the facts stay and the digest says "The AI part is unavailable right now."

### 5.7 Team standups

**Standups** shows one card per Developer in the project, in name order, for **For today** (default), **For the next standup** or **Earlier** (pick one of the 7 days before today). Filter by **Developer**. Each card shows **YESTERDAY**, **TODAY** and **BLOCKERS**, with the badges **Edited**, **Built from task activity only** (made without the AI) and **Flagged for review**. A Developer with no standup that day shows "not generated". This page is read-only.

## 6. Developer

A Developer sees a project once its Dev Lead adds them ([5.1](#51-add-developers)).

### 6.1 My work

Your home page. It lists your open tasks across all your projects ("*n* open, *b* blocked"). For each task:
- the **Status** dropdown moves it between To do, In progress, In review and Done (a task set to Done leaves the list);
- **Mark blocked** / **Unblock** toggles its Blocked marker;
- the project name opens the project, and the task title opens the task.

On a project's **Board** you can change the status of tasks assigned to you, the same way as a Dev Lead ([5.4](#54-board)). Other people's tasks are read-only.

### 6.2 My standup

Open a project and its **My standup** tab. The page has three parts.

**1. Upload activity.** Upload a JSON file of your commits and pull requests. Only titles, short bodies and file names are used; diffs are never read.
- Choose or drop one `.json` file: at most 1 MB and 100 items. Use **Download an example file** to see the format.
- Each item has `type` (`COMMIT` or `PR`), `externalId`, `title`, `timestamp` (with a time-zone offset) and `files` (a list of file names); `repo`, `body` and `url` (must be `https:`) are optional. Bodies longer than 2,000 characters are cut, and the item is flagged.
- Messages before anything is sent: "That file is larger than 1 MB.", "That file is not valid JSON.", "That file has no items list.", "A file can hold at most 100 items."
- After upload: "*a* new, *b* changed, *c* unchanged, *d* rejected", then "Item *n*: *reason*" for each rejected item. Uploading the same file again reports everything unchanged.

**2. Summaries.** After an upload, the new and changed items from the current standup period are summarised by the AI in batches of 10 ("Summarised *x* of *y*"). Each row shows a one-line summary.
- If the AI is busy: "AI is busy. Resuming in *s* s." It resumes by itself.
- If you have made too many AI requests: "Too many AI requests. Try again in *s* s.", and the rest are marked "No summary yet".
- **Retry failed (*n*)** resends only the ones without a summary. The standup can still be generated without them.

**3. Standup.** Pick **For the next standup** (default) or **For today**; each shows its date. The next standup is the next day from Monday to Thursday, and the coming Monday from Friday to Sunday (Singapore time).
- No standup yet: "No standup for *date* yet." Click **Generate standup**.
- A standup shows **Yesterday**, **Today** and **Blockers** ("Nothing to report." when empty). It is built from your summaries and your task changes since the previous working day, plus every task assigned to you that is blocked now.
- Badges: **Edited**, **Built from your task activity only** (made without the AI, from task activity alone), **Flagged for review**.
- **Regenerate** builds it again. If nothing changed: "Nothing has changed since this was generated. Upload new activity to refresh it."
- **Copy** copies the standup as plain text.
- "AI is busy. Try again in *s* s." disables Regenerate for that time. "AI features are off for this deployment." means AI is switched off.

Only you see your own standup here; your Dev Lead sees it on **Standups**.

## 7. Pages every role shares

- **Overview**: progress, velocity, next checkpoints and team for the project.
- **Usage**: tabs **My AI sessions** and **Platform**. *This page currently shows sample data, not your real usage* (see [Known limitations](#9-known-limitations)).

## 8. AI features: limits and messages

| Role | AI feature | Where |
|---|---|---|
| Project Manager | Plan generation, epic expansion and regeneration | Plan tab |
| Dev Lead | Health digest | Health tab |
| Developer | Activity summaries and the standup | My standup tab |

- **Per-user limits:** 6 AI calls a minute and 200 a day. Over the limit you see a wait time ("Too many AI requests" or "Please wait before trying again.").
- **Shared limits:** when the service is busy for everyone you see "AI is busy" with a wait time. Try again after it.
- **AI task limits:** each AI task (one plan, one digest, one standup with its regenerations) is a session. You can have at most 3 open per feature and start 20 a day, and a session allows 5 regenerations; past that you are asked to wait.
- **AI off or unavailable:** AI buttons report it; the non-AI parts of each page keep working. The Developer standup falls back to a version built from task activity only.
- **Flagged for review:** text that tripped the safety checks is still shown, as plain text, with this marker.
- **Unchanged input:** generating again without new input returns the saved result instead of calling the AI (the Health digest, item summaries and the standup).

## 9. Known limitations

These are known gaps in the current release; please do not report them as new bugs.

- **Sprint assignment:** tasks cannot yet be added to a sprint from the app (the task forms have no sprint field), so sprints stay empty and velocity shows "Close a sprint to get a velocity."
- **Reassigning a task:** the assignee is chosen when the task is created and cannot be changed afterwards.
- **Removing members:** members cannot be removed.
- **Health, Suggested changes:** shows "Suggestions will become interactive when W14 adds the proposal endpoints."; re-plan suggestions are not available yet.
- **Settings (Project Manager):** renaming or archiving a project is not saved.
- **Usage:** shows sample data.
- **Mark blocked** does not ask for a reason; the reason is recorded as "Blocked" (or "Blocked from My Work" from My work), and that text appears in the Developer's standup blockers.
- **Task panel for a Developer:** an **Edit** button appears on your own task, but saving fails with "You do not have permission to view this."; only Project Managers and Dev Leads can edit task details. Changing status works.
- **Standup Edit, Use as is and thumbs** are not available yet.
- **Summaries list:** the list of uploaded items and summaries is not kept after you leave the page; the stored summaries are still used by the standup.
- **Registration:** the register page shows Firebase's "email already in use", so it reveals whether an email has an account.

## 10. Suggested test walkthrough

Use three accounts (one per role) in separate private windows.

1. **PM:** sign up as Project Manager, create a project with a short brief, and on **Plan** describe an idea (at least 20 characters) and **Generate plan**.
2. **PM:** edit an epic, **Confirm and Expand Epics**, wait for every epic to be Ready, then **Approve plan**. Check the **Backlog**.
3. **Dev Lead:** sign up as Dev Lead. **PM:** on **Members**, add the Dev Lead's email. **Dev Lead:** open the project from **Projects**.
4. **Developer:** sign up as Developer. **Dev Lead:** on **Members**, add the Developer's email; then **Add task** assigned to the Developer, and mark another task assigned to them as blocked.
5. **Developer:** on **My work**, move a task to In progress. Open the project's **My standup**, **Download an example file**, upload it, let the summaries finish, and **Generate standup**. Check the blocked task appears under **Blockers**.
6. **Dev Lead:** open **Standups** and find the Developer's card; open **Health** and **Generate digest**.
7. **Dev Lead:** create a sprint, start it and close it from **Sprints**.
