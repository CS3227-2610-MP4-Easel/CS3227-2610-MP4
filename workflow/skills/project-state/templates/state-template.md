# STATE.md Template

Copy to `workflow/project-state/STATE.md`. **Hot file — target ≤8 KB.** Holds only what is needed
every session: where we are, and an index into everything else. Nothing here is the full text of
a decision or deviation; those live in `decisions/` and `deviations/` and are cited by ID.

---

````markdown
# Project State — <Project Name>

**Hot file — read in full every session.** `guardrails.md` beside it is also always loaded.
Everything else (`architecture/`, `conventions/`, `decisions/`, `deviations/`, `ledger/`) is read
by ID or area, only when the task touches it. On `INT` this file changes only through
`sync-project-state` (or an owner hotfix); on a branch, read it and write the branch state instead
(`branch-state` skill).

- **Phase:** <e.g. MVP build / hardening / shipped>
- **Stack:** <e.g. Next.js, Prisma, Postgres (Neon), Auth.js, Vercel>
- **Branch:** `INT` — this file describes `INT` only
- **Last updated:** YYYY-MM-DD by <model / agent> — <what changed, five words>
- **Last verified against repo:** YYYY-MM-DD
- **Developer guide:** <not created — or: seeded from [spec](../specs/....md) on YYYY-MM-DD>

---

## 1. Orientation

<Two or three sentences: what this project is, who uses it, what problem it solves.>

| Path | What lives there |
|---|---|
| `workflow/specs/` | Design specs |
| `workflow/plans/` | Implementation plans |
| `workflow/project-state/ledger/` | The Done ledger, rotated monthly past ~100 live entries |
| `workflow/project-state/branch-states/` | One lean state file per in-flight branch |
| `workflow/project-state/architecture/` | Per-area "Now" files |
| `workflow/project-state/decisions/`, `deviations/` | One file per permanent `C`/`D` entry |
| `<dir>` | <purpose> |

---

## 2. How to Resume

```bash
<checkout / install / test / typecheck commands that get you to a known-good state>
```

**Upcoming** — planned workstreams and todos handed over at each sync, in priority order. **The
first row is the next action.** Sessions and in-flight branches live in each branch's own state
file, not here.

| Item | Kind | Context / done when | Source | Added |
|---|---|---|---|---|
| <next thing to pick up> | Workstream | <enough to start without asking; how you know it is done> | handed over from `<branch>` | YYYY-MM-DD |

---

## 3. Workstreams

One row per feature-level-or-larger unit. Small changes skip this and go straight to the Done
ledger.

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W1 | <name> | Building | [spec](../specs/....md) | [plan](../plans/....md) | Task 6/9 in flight: conflict engine; see D2 | — |

Status: `Not started` · `Spec'd` · `Planned` · `Building` · `Blocked — needs human` ·
`In review` · `Done` · `Abandoned`. Guide: `—` · `Awaiting confirmation` · `Pending` ·
`Documented YYYY-MM-DD` · `N/A`.

**Progress is a position, not a diary** — at most ~15 words: where in the plan, what is in
flight, and the ID of anything blocking or explaining it (`D2`, `Q1`). What was built lives in the
plan and the ledger; why it changed is a `decisions/` or `deviations/` file, cited here by ID.

---

## 4. Decision Index

> Legend: `C` = project decision (process, priorities, scope, tooling). Architecture-shaping
> decisions are cited the same way but live with their area in `architecture/<area>.md`.

Decisions **currently binding**, one line each, full text in `decisions/C<n>.md`. Superseded
decisions drop out of this index but stay in their file — `guardrails.md` instead of here if the
decision is a prohibition (Known Gap, out-of-scope, a binding constraint).

| ID | One-line decision | File |
|---|---|---|
| C2 | <outcome in a few words> | [decisions/C2.md](../project-state/decisions/C2.md) |

---

## 5. Needs a Human

Anything an agent cannot do. Phrase each so a one-line reply or a short action unblocks it.

| ID | What is needed | What it blocks | Raised |
|---|---|---|---|
| Q1 | <action or decision> | <scope of the block; what can proceed meanwhile> | YYYY-MM-DD |

---

## 6. Record

The Done ledger lives in **[`ledger/done-ledger.md`](../project-state/ledger/done-ledger.md)** —
every change, newest first. Write the line there, not here.

- **Latest entry:** YYYY-MM-DD
- **Entries (live file):** <n>

The ledger file itself starts as:

```markdown
# Done Ledger — <Project Name>

The full chronological record of every change, newest first. One line each: what changed and why,
with a commit, plan or artifact as the reference. Not a copy of `git log`.

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| YYYY-MM-DD | <outcome, user-visible where possible> | W1 | `<sha>` |

**Rotated:** <none yet — start `ledger/YYYY-MM.md` past ~100 live entries and link it here>
```
````
