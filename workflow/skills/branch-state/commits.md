# Commit Conventions

`AGENTS.md` §6 gives the 4–5 line rule every commit on a branch follows. This file is the full
convention it points to.

## Format

```
type: what and why (workstream)

Workstream: W-x
Task: T3
```

- **Subject:** `type: what and why`, imperative, under ~72 chars. `type` is `feat`, `fix`,
  `refactor`, `docs`, `test`, `chore` — whatever the project's existing history uses.
- **Trailers:** `Workstream:` and `Task:` when the commit is under a workstream. Omit both for
  work with no workstream (a true one-off Small change).
- **Never cite a provisional ID** (`C~1`, `D~1`) in a commit message — it is renumbered at fold
  and the commit is never rewritten. Cite a permanent ID, or describe the thing in words.

## Granularity

One logical change per commit: a plan task (or a logical slice of one), a green build, a handful
of files. Never `git add -A`. The branch state's own update (ticked plan boxes, Progress cell,
Changes line) rides in the **same commit** as the code it describes, not a follow-up commit —
otherwise a reader sees code land with no record of it, even briefly.

## What Is and Isn't Automated (today)

Only if the project ran `ws init` (`project-state` skill, `scripts/ws.mjs`). Then git hooks
auto-add `Workstream:` (when the branch state has exactly one active workstream) and `Task:`
(from `ws task start <T>`, a per-worktree pointer), and warn — never block — on a malformed
subject, a missing trailer, or a provisional ID. `ws changes` renders the Changes table from
`git log`. Hooks are not part of a clone: each collaborator runs `ws init` once. Without `ws`:

- Add the trailers by hand when you know the workstream and task.
- Write the Changes line by hand (`branch-state` skill §3) and make it agree with the subject.
- Manual commit messages are always allowed; humans commit however they like. This format is what
  **agents** are instructed to use.

## Examples

```
feat: host calendar blocks overlapping bookings

Workstream: W-HOST
Task: T3
```

```
fix: buffer minutes applied to end only, not start (W1)
```

```
docs: spec for csv export
```
