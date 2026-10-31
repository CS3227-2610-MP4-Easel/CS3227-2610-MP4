# Branch State Template

Copy to `workflow/project-state/branch-states/<slug>.md`, where `<slug>` is the branch name with
`/` replaced by `-`. Create `workflow/project-state/branch-states/archive/` once per project
(`project-state` skill's bootstrapping).

A branch state is a **lean "what has changed" file**. It mirrors the hot/cold structure, so
porting at fold is a copy, not a translation: a Decisions entry becomes `decisions/C<n>.md`, a
Deviations entry becomes `deviations/D<n>.md`, an Architecture block becomes (or replaces)
`architecture/<area>.md`.

**Required sections** (always present, even empty): Header, How to Resume, Workstreams, Changes,
Remaining/Handover. **Optional sections** (Architecture, Conventions, Known Gaps, Decisions,
Deviations) exist in the file **only when this branch changes them** — if this branch touches
none of them, omit all five and write one line under the header instead:

```markdown
**Untouched:** Architecture, Conventions, Known Gaps, Decisions, Deviations
```

List only the ones with nothing to change; include a section normally the moment the branch
changes it, and drop it from the `Untouched:` line. `sync-project-state` treats an omitted,
`Untouched`-listed section as "nothing to fold," and a present section as the text that should
land in its cold file or `guardrails.md`/`STATE.md`'s index.

Rules that differ from the hot/cold tree:

- **Provisional IDs.** IDs you mint carry `~`: `W~1`, `C~2`, `D~1`, `Q~1`. They are unique only in
  this file and are renumbered at fold. Cite existing permanent IDs (`C14`) freely. **Never cite
  a provisional ID outside this file** — commit messages and code comments are not rewritten.
- **Session IDs** (`S1`, `S2`) are local to this file, never folded, and carry no marker.
- **An Architecture block, a Decision, or a Known Gap that edits something already in `STATE.md`,
  `guardrails.md` or a cold file** names the entry it replaces, by ID or area name. A pure
  addition needs no such reference.
- Only the project owner fills `Approved`. Agents never do.

---

````markdown
# Branch State — <branch>

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** <branch> (from `INT` at `<sha>`)
- **Base:** <sha of the `INT` commit last merged into this branch — move it when you merge `INT`>
- **Owner:** <name>
- **Status:** Draft   (`Draft` · `In review` · `Approved` · `Folded`)
- **Approved:** — (project owner only: <name> YYYY-MM-DD)
- **Last updated:** YYYY-MM-DD by <model / agent> — <what changed, five words>

**Untouched:** <list the unchanged ones among Architecture, Conventions, Known Gaps, Decisions,
Deviations here; omit this line entirely once every one of the five has its own section below>

---

**Scope.** <One or two sentences: what this branch is for and which workstream it serves.>

---

## 1. How to Resume

**Setup**, only if it differs from `STATE.md` §2:

```bash
<commands that reach a working state on this branch>
```

**Sessions** — one row per operator-initiated session, however many agents or subagents it runs.
Delete a row once its work is recorded in Workstreams and Changes. The table must be empty before
the branch can be approved.

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S2 | YYYY-MM-DD HH:MM | <model/agent> (lead) + <subagents> | W~1 | Active | Task 6/9: conflict engine | <file, task, and how you know it is done> | YYYY-MM-DD HH:MM |
| S1 | YYYY-MM-DD HH:MM | <model/agent> | W~1 | Blocked — needs human | Q~1 | <what to do once the answer arrives> | YYYY-MM-DD HH:MM |

Session status: `Active` · `Paused` · `Blocked — needs human` (name the question).

- **Doing** is a position, like the Progress cell: where in the plan, and an ID.
- **Next action** is concrete enough that a cold agent can start without asking: the file, the
  task, and how it will know it is done.

**Remaining** — work no session has claimed, in order. Mark a follow-up that should **outlive
this branch** with **Handover**; sync copies those into `STATE.md` §2 → Upcoming. Everything else
must be done or removed before approval.

- [ ] <unclaimed task>
- [ ] **Handover:** <follow-up for after the merge, with enough context to act on>

---

## 2. Workstreams

Rows created or changed on this branch, in `STATE.md`'s columns. An existing workstream keeps its
permanent ID; a new one is `W~n`. A workstream's Guide cell is `—` here (or `N/A` with the
reason); the guide is never edited on a branch.

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W~1 | <name> | Building | [spec](../../specs/....md) | [plan](../../plans/....md) | Task 6/9 in flight: conflict engine | — |

---

## 3. Changes

One line per change on this branch, big or small: what changed and why, with a commit as the
reference. Copied into the Done ledger at fold. Not a copy of `git log`.
**Ref:** a commit's sha cannot be known inside that same commit, so write `this commit` and
replace it with the sha in your next write to this file (at the latest, at close-out).

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| YYYY-MM-DD | <outcome, user-visible where possible> | W~1 | `<sha>` |

---

<!-- Everything below is OPTIONAL. Include a section only when this branch changes it; otherwise
list it in the Untouched: line above and omit the section entirely. -->

## 4. Architecture

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

One block per area this branch changes, named exactly as the project's `architecture/<area>.md`
files. Write the text that should replace the area's **Now**, not a description of the change.

### 4.x <Area name>

**Now (proposed):** <what the area is and how it behaves once this branch lands — the full
replacement paragraph, naming real files and functions.>

| Path | Role |
|---|---|
| `<file>` | <what it owns> |

| ID | Date | Decision | Why / who asked | Source |
|---|---|---|---|---|
| C~1 | YYYY-MM-DD | <decision that shaped this area> | <rationale; what was rejected> | [spec §3](...) |

## 5. Conventions

Entries added, changed (name the entry replaced) or removed, one topic file's worth of content per
block, in `conventions/<topic>.md`'s format.

## 6. Known Gaps

Entries added, changed or removed, in `guardrails.md`'s format.

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

Decisions added or changed, with provisional IDs, one `decisions/C~n.md`'s worth of fields per
entry (date, who asked, why, rejected alternatives, supersedes).

## 8. Deviations

> Legend: `D` = Deviation, where reality diverged from a spec or plan. Not to be confused with
> AD-nn, an Architecture Decision.

Deviations and discoveries added, with provisional IDs, one `deviations/D~n.md`'s worth of fields
per entry.

## 9. Lessons

Mistakes the operator corrected, avoidable errors a review exposed, or ones you caught yourself
(`ws lesson new`): what happened, cause, one-line rule, scope (`project` or `role:<name>`), found by.
````
