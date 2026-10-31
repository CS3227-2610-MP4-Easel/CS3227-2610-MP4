# Failure Modes (on a branch)

How a branch state decays, and the counter for each. Read when you notice yourself reaching for a
reason not to write something down. Project-wide failure modes (cold-file drift, guardrails
bloat) are in the `project-state` skill's `failure-modes.md`.

## Rationalizations

| Excuse | Reality |
|---|---|
| "I'll update it at the end of the session" | Sessions end unpredictably — context runs out, the window closes. The update is always what gets lost. Write at the boundary, not after it |
| "Writing it down slows me down" | Rediscovering state costs a whole session. You are trading sixty seconds against an hour |
| "It's a small change, it doesn't need recording" | Ceremony scales with size; the record does not |
| "The spec already covers this" | The branch state must be readable alone |
| "This decision was implicit / obvious" | Implicit decisions get silently reversed by the next agent |
| "The operator just told me, I will remember" | You will not. The next session is a different you |
| "The Progress cell should say what I did" | It should say where you are. Put the work in Changes, the reason in a decision or deviation, and an ID in the cell |
| "I recorded the decision, so the architecture is covered" | Rewrite the area's proposed Now in the same edit |
| "I'm mid-task, I'll write it when this is done" | If the task derails — and derailed tasks are the ones most worth recording — it never gets written |
| "Another session is probably handling that" | Check its row's `Last touched` against `git log`. A stale `Active` row means nobody is |
| "I'll skip adding my session row, it's just a quick fix" | A quick fix is exactly what another agent duplicates or overwrites. Claim the row first |
| "I'll just edit STATE.md, it's quicker" | It is read-only from a branch; it conflicts with every other branch and records unmerged work as if merged |
| "The branch is basically done, I'll merge and get it approved afterwards" | Approval is the owner's gate. Sync refuses an unapproved state anyway |
| "I'll write `No change.` under each section to be safe" | Use one `Untouched:` line; omitted sections are the claim |

## Common Mistakes

- **A stale Next action** — the most damaging single field. Reconcile your session row before you
  stop, every time.
- **A vague Handover.** "Look into X later" is lost at fold. Write it so a stranger can act on it.
- **Citing a provisional ID outside the branch state** — in a commit message or code comment.
- **A stale `Base`.** Merging `INT` without re-checking the entries the branch edits.
- **Narrating the workstream.** Progress cells that grow into paragraphs.
- **Fixing a Known Gap** listed in `guardrails.md`, or building through a recorded decision
  because the operator asked without confirming keep-or-reverse.
- **Recording the outcome without the reason.**
- **A session row nobody prunes.**
- **Resolving a collision by dropping a side.** If two people sharing a branch collide inside the
  branch state, keep both rows and entries.
- **Setting the Guide column on a branch.** Keep `—`; record confirmation and
  `guide out of date: <what>` in Progress and let `sync-project-state` set the cell.
- **Claiming `Untouched:` for something you changed.** Sync diffs the branch against the claim
  and stops if it contradicts.
