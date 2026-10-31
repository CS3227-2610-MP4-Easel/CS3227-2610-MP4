---
name: sync-project-state
description: Use when folding a merged, approved branch state into the project state tree - after a branch that has a workflow/project-state/branch-states/<slug>.md file has been merged to the integration branch (INT), when reconciliation reports a pending fold, or when the project owner says sync, fold, land or archive a branch state. Started on the project owner's yes in chat: the agent asks after the merge (AGENTS.md § 8), never runs it unasked. Keywords - sync-project-state, branch state, fold, provisional IDs, archive branch state, STATE.md, handover, Upcoming.
---

# Sync Project State

## Overview

`workflow/project-state/` describes `INT` (see the `project-state` skill for the layout).
Branches never edit it; each records what it changed in a branch state,
`workflow/project-state/branch-states/<slug>.md` (see the `branch-state` skill). **This skill
folds one merged, approved branch state into the hot/cold tree and the Done ledger, then archives
the branch state.** It is the only thing that writes that tree, apart from the owner's
hand-edited hotfixes.

It is **owner-gated**. After the merge the agent asks the owner (`AGENTS.md` § 8, gate 4) and runs
it on their yes, or the owner invokes it, naming a branch state — or asking for the list of
pending ones. Nothing runs it without that yes: no CI, no hook. That makes the fold serial, so IDs
and counters never collide. A branch state left in `branch-states/` on `INT` is the pending-fold
signal.

**Where it runs.** On `INT`, or on a short-lived `sync/<slug>` branch cut from the merged `INT` if
the owner wants the fold reviewed as a PR. Keep **one sync PR open at a time**.

## Never

- Never **approve** a branch state. `Approved` is the project owner's. They may give it now, in
  this conversation; then write their name and the date.
- Never **push**. Commit locally and report. On a sync branch, open the PR only if asked.
- Never fold a branch that is **not merged**.
- Never **overwrite** an entry that changed on `INT` since the branch's `Base`. Stop and ask.
- Never **rewrite the substance** of the branch state's text. You renumber IDs and fit the text
  to the target file's format; you do not reword decisions, deviations or the proposed *Now*.
- Never edit the developer guide. It is handled afterwards by `update-documentation`.

## Procedure

**Shortcut.** `ws fold <slug>` (project-state skill, `scripts/ws.mjs`) does steps 4-5 and 7 mechanically (ID allocation and rewrite, cold files, STATE.md rows, Upcoming, ledger, archive with fold record) and refuses an unapproved state or a non-empty session table. It does not do steps 1-3, 2a, 6, 8-10: still check preconditions, the `Untouched:` claim and stale bases first, then review `git diff`, move binding decisions to `guardrails.md`, remove covered Upcoming rows, and commit. Without Node, follow the steps by hand.

**0. Pick the state.** If the owner named a branch, use it. Otherwise list the non-archived files
in `workflow/project-state/branch-states/` and ask which. Fold one at a time, oldest merge first.

**1. Preconditions.** Stop and report if any fails.

- On `INT` (or a fresh `sync/<slug>` from it) with a clean tree.
- The branch is merged: `git branch --merged INT` lists it, or `git log INT` shows its merge.
- `Status` is `Approved` with the `Approved` field filled. If not, tell the owner; if they approve
  now, write `Approved: <name> YYYY-MM-DD`.
- The **session table is empty.** Rows left behind are stale or unfinished work: ask the owner
  whether to discard them (note it in the archive).
- **Remaining** has no unmarked open items. Ask the owner to drop each or mark it **Handover**.

**2. Read** `STATE.md`, `guardrails.md`, the head of `ledger/done-ledger.md`, and the branch state,
in full. Read cold files only for entries the branch state edits (step 3).

**2a. Check the `Untouched:` claim.** Every optional section the branch state omits must appear in
its `Untouched:` line. For each of Architecture, Conventions, Known Gaps listed there, skim the
branch diff (`git diff <Base> <merge sha> --stat`) for new directories, dependencies, profiles,
scripts or boundaries that contradict it; if one does, stop and ask. A true `Untouched` is
skipped in step 5.

**3. Check for stale bases — before editing anything.** A pure addition never conflicts. An
**edit to an existing entry** (an area's *Now*, a Workstream row, a Convention, a Known Gap)
does if another fold or hotfix changed it since the branch's `Base`:

```bash
git diff <Base> INT -- workflow/project-state/
```

For each entry the branch state replaces, compare it with the diff. If `INT` changed it, **stop
and ask the owner.** Show both versions. Reconcile; if the result changes what the area *is*,
record the resolution as a Decision. Never keep both versions side by side.

**4. Allocate permanent IDs.** For each namespace `W`, `C`, `D`, `Q`, find the highest number
already used across `STATE.md`, `guardrails.md`, `decisions/`, `deviations/`, `ledger/` **and** the
ID maps in `branch-states/archive/` — resolved Questions disappear but their numbers are never
reused. Give the branch state's provisional IDs the next numbers, in the order they first appear
top to bottom. Rewrite every citation in the text you file into the tree in **one regex pass**
(`([WCDQ])~(\d+)`), so `C~1` can never match inside `C~12`. The archived branch state keeps its
provisional IDs unchanged; the map goes in its fold record. If the same entry appears twice with
different wording, stop and ask which is right. Branch states written with older section
numbering are read by section name, not number.

**5. Apply, section by section.** Newest first wherever the target is newest-first. An omitted /
`Untouched` section adds nothing.

| Branch state | Goes to |
|---|---|
| Workstreams | `STATE.md` §3: new rows added; a changed existing row replaces the old one in place |
| Architecture | Each area: replace its **Now** in `architecture/<area>.md` (create it from the template if new), merge Paths rows, add its decision IDs to the area's table |
| Conventions | `conventions/<topic>.md`: add, replace or remove the named entries |
| Known Gaps | `guardrails.md`: add, replace or remove the named entries |
| Decisions | One `decisions/C<n>.md` per entry from the template, verbatim. Add the one-line summary to `STATE.md` §4, or to `guardrails.md` Binding Decisions if it is a prohibition |
| Deviations | One `deviations/D<n>.md` per entry from the template, verbatim |
| Needs a Human (Remaining questions) | `STATE.md` §5: add new rows; delete resolved ones |
| Changes | `ledger/done-ledger.md` at the right dates, plus one line recording this fold |
| Handover items | `STATE.md` §2 → **Upcoming**, after existing rows unless the owner says otherwise, each with `Source: handed over from <branch>` and today's date. Kind is `Post-merge` for a Handover from a `Post-merge` plan task, `Workstream` if it needs a spec, otherwise `Todo`. Also delete any Upcoming row the folded workstream now covers |

Then update `STATE.md` §6 (latest entry date, entry count) and the header — `Last updated:
YYYY-MM-DD by <model> — folded <slug>`. Rotate the ledger to `ledger/YYYY-MM.md` if the live file
passed ~100 entries. Size check: if `STATE.md` exceeds ~8 KB or `guardrails.md`
~2 KB, tell the owner which entries to move out of the index.

**6. Reconcile.** Run the `project-state` skill's `reconciliation.md` against the result: no
dangling provisional IDs (`grep -rn "[WCDQ]~[0-9]" workflow/project-state --exclude-dir=branch-states`
is empty), links resolve, every new cold file is reachable from `STATE.md`, `guardrails.md` or an
area file. Stamp `Last verified against repo`.

**7. Archive.** Move the file with `git mv` to
`workflow/project-state/branch-states/archive/<YYYY-MM-DD>-<slug>.md`. In it set `Status: Folded`,
and append the fold record:

```markdown
## Fold record
Folded YYYY-MM-DD by <model> on <INT | sync/<slug>> · merge commit `<sha>` · base `<sha>`

| Provisional | Permanent |
|---|---|
| C~1 | C29 |

Sessions discarded at fold: <none | list, with the owner's yes>
```

**8. Commit** with `docs: sync <slug> branch state into project state`. Do not push.

**9. Developer guide.** Ask this after the owner confirms the fold (step 10). Only if the project
keeps one (`AGENTS.md` § 5): for each folded workstream that is now `Done`, set Guide to
`Awaiting confirmation` and ask the owner **"Is W<n> confirmed for the developer guide?"** A yes
becomes `Pending`; the `update-documentation` skill takes it from there.

**10. Report and ask** (`AGENTS.md` § 8, gate 5): ask the owner to confirm the fold, then ask the
step 9 guide question. Report briefly: the ID map, the files touched, any stale-base decision, the
Handover items now in Upcoming, the Guide questions asked, and any further pending folds.

## Red Flags — Stop

- "The branch state says `Approved`, I'll skip the checks" → check the preconditions anyway.
- "It's only a typo in their text" → renumber and reformat only. If it is wrong, tell the owner.
- "Both versions are fine, I'll keep both" → an area has one *Now*. Reconcile with the owner.
- "I'll fold three branches at once" → one at a time, so each stale-base check sees the last fold.
- "The numbers don't matter, I'll skip the archive maps" → they are why a resolved Q's number is
  never reused.
- "I'll push so it's done" → the owner decides when it leaves the machine.
- "The guide needs updating, I'll do it now" → ask the confirmation question; do not edit the guide.
- "This decision has no home in the index, I'll skip creating its file" → every decision gets its
  own `decisions/C<n>.md`; the index only points at it.
