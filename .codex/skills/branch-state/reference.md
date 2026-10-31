# Reference: lifecycle, merging INT, status vocabulary

Read when you set a status, approve/merge a branch, or merge `INT` into the branch.

## The Branch Lifecycle and the Approval Gate

`Draft` → `In review` → `Approved` → `Folded`.

- Agents set `Draft` (creating the file) and `In review` (spec, plan, build and review are done
  and the session table is empty), then ask the owner to review (`AGENTS.md` §8, gate 3).
- **Only the project owner sets `Approved`**, with their name and the date. An agent never
  approves a branch.
- **Do not merge a branch to `INT` until it is `Approved` and its session table is empty.**
- After the merge, the agent asks the owner and runs `sync-project-state` on their yes — it
  refuses a state that is not `Approved`. A file left in `branch-states/` on `INT` means a fold
  is pending.

## Merging `INT` In

1. `git diff <Base> INT -- workflow/project-state/STATE.md workflow/project-state/guardrails.md`
   — what changed on `INT` since your `Base`. If cold files matter to your branch, diff the
   specific `architecture/<area>.md` or `decisions/C<n>.md` you edit too.
2. For every entry your branch state **edits** (not merely adds — an area's Now, a Workstream
   row, a Convention, a Known Gap), check whether that entry changed on `INT`. If it did, redraft
   your proposed text on top of the new one; if the two cannot both be true, put the question in
   Remaining rather than guessing.
3. Check your provisional IDs still make sense — one you cite as permanent (`C14`) may have been
   superseded.
4. Move `Base` to the new `INT` sha and update `Last updated`.

## Status Vocabulary

**Workstream status:** `Not started` · `Spec'd` · `Planned` · `Building` ·
`Blocked — needs human` · `In review` · `Done` · `Abandoned`. `Blocked` must always name what you
need.

**Branch state status:** `Draft` · `In review` · `Approved` · `Folded`.

**Session status:** `Active` · `Paused` · `Blocked — needs human`. A finished session is not a
status — its row is deleted once the work is in Workstreams and Changes.

**Guide column** (only when the project keeps a developer guide): `—` · `Awaiting confirmation` ·
`Pending` · `Documented YYYY-MM-DD` · `N/A`, owned by `update-documentation`. **On a branch the
Guide cell stays `—` (or `N/A`, with the reason in Progress), even when the workstream is `Done`.**
Only `sync-project-state` sets `Awaiting confirmation`, at fold. Record a branch-side confirmation
as text in Progress (`guide confirmed by <owner> <date>`) and add `guide out of date: <what>`, so
the fold carries both.

