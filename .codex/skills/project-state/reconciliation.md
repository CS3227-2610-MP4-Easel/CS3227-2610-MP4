# Reconciliation — Verifying State Against the Repo

Status drift is what kills these documents. One stale `Building` row and the next agent stops
trusting the whole tree — at which point it has negative value, because it is now a
confident-sounding lie.

Run this **once per session, right after reading `STATE.md` and `guardrails.md`** (and, on a
branch, the branch state), before acting on either. This check covers `INT`'s whole hot/cold tree;
`branch-state`'s own reconciliation (session rows, `Base`) is the smaller check almost every agent
on a branch runs — do both there.

## The Check

1. **Git first.** `git log --oneline -20` and `git status`. Does recent history match the Done
   ledger (and, on a branch, the branch state's Changes)? Uncommitted work nothing mentions is the
   loudest signal that the last session ended without writing.
2. **Every `Building` workstream** in `STATE.md` §3 (and in the branch state, if any). Open its
   plan. Does the first unchecked task match what the repo actually contains?
3. **Every `Blocked — needs human` row** — is it still blocked, or was the answer given in a
   session that never cleared the flag?
4. **Pending folds on `INT`.** List the non-archived files in
   `workflow/project-state/branch-states/`. Each is a branch merged without being folded in, or
   still in flight. Tell the project owner a `sync-project-state` run is due; do not fold it
   yourself unless asked.
5. **Links.** Every spec, plan and cold-file link resolves. A dead link is worse than no link.
6. **Architecture drift.** For any workstream that finished or changed shape since the last
   verification, does its `architecture/<area>.md` Now still describe the code? A Now describing
   last month's design is the same failure as a stale `Building` row.
7. **`guardrails.md` and `STATE.md`'s decision index agree with their cold files.** An entry
   listed as binding that the linked `decisions/C<n>.md` shows as superseded is drift — fix the
   index, not the file.
8. **Guide column** — only if the project keeps a developer guide. List `STATE.md` §3 rows whose
   Guide is `Awaiting confirmation` or `Pending`, or whose Progress says `guide out of date`, and
   raise them with the operator. See `update-documentation`.
9. **What to do next.** `STATE.md` §2's first Upcoming row — still right, given 1–8?

Correct what you find, then stamp `Last verified against repo` with today's date in `STATE.md`.

Cheap version — usually under a minute:

```bash
git log --oneline -20
git status --short
ls workflow/specs workflow/plans
ls workflow/project-state/branch-states
grep -E "Awaiting confirmation|Pending|guide out of date" workflow/project-state/STATE.md
```

## When the Document and the Repo Disagree

| Kind of claim | Winner | What to do |
|---|---|---|
| What the code does, what exists, what is committed | **The repo** | Correct the document. Note the correction in a `deviations/D<n>.md` if it is surprising |
| What was decided, what is in scope, what was rejected, why | **The document** | The code is wrong or incomplete. Do not silently "fix" the document to match the code — that erases the decision |
| Both plausible, genuinely unclear | **Neither** | Do not guess. Raise it in `STATE.md` §5 and keep working on something else |

The asymmetry matters: code drifts from intent all the time, and the document is the only record
that intent ever existed. A decision quietly overwritten to match a stray commit is unrecoverable.

## Do Not Skip This Because the File Looks Fine

A well-written stale tree looks exactly like a well-written current one. The check is cheap
precisely so that it can be unconditional.
