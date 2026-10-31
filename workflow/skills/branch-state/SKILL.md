---
name: branch-state
description: Use when doing any work on a feature branch - at session start before reading code or answering questions, when a task starts/finishes/blocks, when the user makes a decision that shapes the design, when a spec or plan is written, and before ending a session or compacting context. Keywords - branch state, write-immediately, session row, Progress cell, how to resume, Untouched, approval gate, Approved, collision, keep or reverse.
---

# Branch State

## Overview

`workflow/project-state/STATE.md` (the **project-state** skill) describes `INT` — what is merged,
decided and handed over. A branch never edits it. **Everything one branch has added or changed
lives in its own lean file**, `workflow/project-state/branch-states/<slug>.md`, until the branch
merges and is folded in. `<slug>` is the branch name with `/` replaced by `-`.

This is the skill almost every agent on a branch needs — the project-state skill's hot/cold
structure and cold-folder templates are pulled in only for the rarer cases this file calls out.

The operator switches between models, agents, and context windows — sometimes running several
sessions and agents at once, on different branches, with teammates. None of that history
survives; the branch state does. **Anything not written there did not happen.**

Branches never conflict on `STATE.md` or collide on its ID numbers, because they never write it.
They read it (and `guardrails.md`) for context and write to their own branch state. After the
merge, the agent asks the project owner and runs `sync-project-state` on their yes
(`AGENTS.md` §8) to fold the branch state in.

## Read Before You Act

At the start of every session, and after any compaction:

1. **Read `workflow/project-state/STATE.md` and `guardrails.md` in full** (project-state skill) —
   context, not the thing you write to.
2. **Read your branch state in full.** If `branch-states/<slug>.md` does not exist, create it
   from [templates/branch-state-template.md](templates/branch-state-template.md) before doing
   anything else. Its How to Resume says what every session on the branch is doing and what to
   do next.
3. **Reconcile** — git first, then your own session row, then the rest:
   - `git log --oneline -20` and `git status` against the branch state's Changes.
   - Every session row: `Active` with a `Last touched` that predates recent git activity on the
     branch died without saying so — mark it `Paused` or delete it if its work already landed.
   - Compare `Base` with the tip of `INT`; if it moved, see **Merging `INT` In** below.
   - Add or update your own row before doing anything else, so another session does not
     duplicate your work.
   - The checks above are the whole branch-side reconciliation and are mandatory. The
     `project-state` skill's full [reconciliation.md](../project-state/reconciliation.md) is for
     the owner, a fold, or a bootstrap — read it on a branch only when `STATE.md` looks stale.

## Every Change Is Recorded — Size Decides the Ceremony

See `AGENTS.md` §3. **Big** gets a spec (`writing-specs-lite`), a plan (`writing-plans-lite`), and
a Workstream row linking both. **Small** gets a Changes line, nothing else. **Small never means
unrecorded** — a one-line fix still gets a Changes line, and if it diverges from a plan,
contradicts a spec, or leaves a trap, it also gets a Deviations entry. Only pure no-ops (a typo in
a comment) pass unwritten.

Ambiguous size? Treat it as Big — a spec you did not need costs twenty minutes; a feature built
without one costs a rewrite.

**If a request collides with `guardrails.md` or `STATE.md`'s decision index** — stop and confirm
before doing anything (`AGENTS.md` §4). Name the entry, then ask: **keep** (do nothing) or
**reverse** (build it, record a decision reversing the entry, give the work its own workstream if
it falls outside the current one). Act on neither until the operator answers, even if they said
"just do it" — the request does not show they knew it overturns a recorded decision. If the
operator is unavailable, stop and put the question in Remaining.

## Write Immediately When

See `AGENTS.md` §2 for the one-line version; this is the full list. The branch state keeps every
required section (below); an optional section with nothing to change is covered by the single
`Untouched:` line, not written out.

1. **A workstream changes status, or a task starts, finishes, or blocks** — update its row and
   Progress cell.
2. **A session starts, changes what it is doing, spawns or retires an agent, or ends** — add or
   update its row in How to Resume immediately, including its **Next action**. Delete the row
   once its work is in Workstreams and Changes.
3. **The shape of the system changes** — write the affected area's proposed **Now** in an
   Architecture block, in the same write.
4. **The operator makes or changes a decision** — capture *who asked and why*, not just the
   outcome. Use a provisional ID (`C~1`).
5. **A spec or plan is created or materially revised** — link it from its workstream.
6. **Work completes, or reality diverges from a plan** — a Changes line, status, and a Deviation.
7. **The session is ending, context is low, or you are about to compact** — reconcile your
   session row and Remaining so a different session can take over cold. Anything that should
   outlive the branch is marked **Handover**.
8. **You merge `INT` into the branch** — see below, then move `Base` to the new `INT` sha.
9. **The branch is finished** — empty the session table, set `Status: In review`, and tell the
   project owner.
10. **The operator corrects you, a review exposes an avoidable error, or you catch your own** —
    record a lesson (`ws lesson new`, fields: what happened, cause, rule, scope `project` or
    `role:<name>`, found by). When the *operator* corrected you, ask whether to record it; in all
    other cases decide yourself. Likewise, every answer to a question you asked the operator that
    settles a design or scope point is a decision candidate (`ws decision new`); mark trivial
    preferences `local` and keep them in the branch state only.

Not at the end, not batched: sessions end unpredictably and the update is what gets lost. **A
task is not complete until the branch state reflects it.**

## Two Things Agents Get Wrong

**An Architecture block describes the system, not the change.** Write the full replacement text
for the area's **Now**, not a description of the diff. A decision that changed the shape of the
system lives with the area block; one that changed how the work is done is a plain Decision.

**The Progress cell is a position, not a diary.** At most ~15 words: where in the plan, what is
in flight, and the ID of whatever blocks or explains it — `Task 6/9 in flight: conflict engine`,
`Task 3/8 stopped: Q2`. What was built is in the plan and the Changes lines. Why something
changed mid-flight is a Decisions or Deviations entry, cited from the cell by ID only.

## The Acid Test

Before you stop, ask: **could a fresh agent, given only `STATE.md`, `guardrails.md` and this
branch's state, take over any session in How to Resume and take its Next action correctly,
without asking a question?**

If no, the file is wrong — fix the file, not your answer to the question.

## Where the Rest Lives

| File | Read it when |
|---|---|
| [templates/branch-state-template.md](templates/branch-state-template.md) | Creating a branch state |
| [commits.md](commits.md) | Writing any commit message on a branch |
| [worked-examples.md](worked-examples.md) | Writing a Next action, decision, deviation, session row or Changes line |
| [failure-modes.md](failure-modes.md) | You are about to skip or shortcut an update |
| `project-state` skill | The hot/cold structure itself, bootstrapping, project-wide reconciliation, cold-file templates |
| `sync-project-state` skill | Your branch merged and is `Approved` |
| `update-documentation` skill | The project keeps a developer guide and a workstream reached `Done` |
| [reference.md](reference.md) | Setting a status, the approval gate and merge rules, merging `INT` into the branch, status vocabulary |
