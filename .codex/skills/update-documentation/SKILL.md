---
name: update-documentation
description: Use when sync-project-state folds a Done workstream into STATE.md or a workstream reaches Done directly on the integration branch (INT), when an approved design spec is on INT (a first write is due if docs/guide/index.md does not exist), when the operator asks to update DeveloperGuide.md, the docs, or handover documentation, when the operator declares a phase transition, when STATE.md shows a Guide value of Awaiting confirmation or Pending, or when docs/guide/index.md contradicts STATE.md or the code. Keywords - DeveloperGuide.md, developer guide, STATE.md Guide column, handover, onboarding, architecture documentation, diagrams, checkpoint, documented.
---

# Update Documentation

## Overview

`docs/guide/index.md` is the handover brief for a developer taking over the project: scope,
goals, requirements, architecture, key decisions, diagrams, and how to test. It holds **only
confirmed work**, changes **only at checkpoints**, and is **never written without operator
approval**.

**It is written only on `INT`.** A branch never edits `docs/guide/index.md`: it is a shared file, and
merged work is what "confirmed" means. A workstream finished on a branch reaches the guide only after
`sync-project-state` has run (on the owner's yes), which sets its Guide value; the agent proposes the update itself once the owner confirms the workstream (`AGENTS.md` § 8, gate 6). The checkpoint below then
runs on `INT` or on the sync branch, or on its own branch and PR if the owner wants the guide change
separate from the fold.

It is not the source of truth — the project state (`workflow/project-state/`) is. The state file keeps work continuous
*within* a phase; the guide hands the project over *between* phases, so it may lag. **Never take
direction for coding from the guide.** If the two disagree, follow the state file.

## Settings

Read from `AGENTS.md` § 5.

| Setting | Values | Default |
|---|---|---|
| `Developer guide checkpoint` | `feature` — each confirmed workstream · `phase` — once when a group of related workstreams is Done, or when the operator declares a phase transition · `manual` — only on request | `phase` |
| `Developer guide optional sections` | `none` · `user stories` · `use cases` · `user stories, use cases` | `none` |

The checkpoint setting decides only **when you propose**. Confirmation and the Guide column
apply under every setting.

## The Guide Column

Every row in the `STATE.md` §3 Workstreams table has a **Guide** value. On a branch the cell
stays `—` (or `N/A`, with the reason in Progress), and a `guide out of date: <what>` note goes in the
branch state's row and folds with it.


| Value | Meaning | Set when |
|---|---|---|
| `—` | Not `Done`, or `Done` on a branch not yet folded | Default |
| `Awaiting confirmation` | `Done`; you asked whether it is confirmed | `sync-project-state` folds the workstream as `Done` (or it reaches `Done` directly on `INT`) |
| `Pending` | Confirmed, not yet in the guide | The operator confirms, or holds a proposal |
| `Documented YYYY-MM-DD` | In the guide | After writing an approved update |
| `N/A` | Nothing a developer needs to read about | Any time, with the reason in Progress |

Outstanding: `grep -E "Awaiting confirmation|Pending|guide out of date" workflow/project-state/STATE.md`. Rows finish in any
order; handle each on its own.

## When a Workstream Reaches `Done`

Under the branch-state workflow this happens at fold: `sync-project-state` does steps 1–2 and
hands over here. Work finished directly on `INT` follows the same steps.

1. Set Guide to `Awaiting confirmation` — or `N/A` if nothing is developer-facing, with the
   reason in Progress.
2. Ask: **"Is W<n> confirmed for the developer guide?"**
3. **Yes** → `Pending`, with `confirmed YYYY-MM-DD` in Progress. **No, not yet, or no answer** →
   leave it. **Uncertain means not confirmed.** `Done` is not confirmation; passing tests are not
   confirmation.
4. Under `feature`, a `Pending` row is a checkpoint — **unless** its Progress says `guide held` and
   the operator has not lifted the hold. Then mention the hold at session start; do not re-propose.
   When the operator lifts the hold, replace the note with `guide hold lifted YYYY-MM-DD`.
5. **Found `Awaiting confirmation` at session start** → ask the question again. Never assume the
   answer.

## At a Checkpoint: Propose, Wait, Write

**Triggers:** a `Pending` row under `feature`; a phase transition under `phase`; the operator
asking, under any setting; the first write — [first-write.md](first-write.md).

1. **Gather**, in this order: the project state (`STATE.md`, `guardrails.md`, the `decisions/`, `deviations/` and `architecture/` files for the workstream, and ledger entries since the last `Documented` date, plus every `guide out of date` note) → the workstream's
   spec and plan → the code → the current guide. **Where the code and the spec differ, the guide
   describes the code** and cites the deviation's `D`-ID.
2. **Propose — do not draft prose.** List:
   - each section to add or change, with a one-line summary
   - each diagram: its type and what it shows
   - hand edits found in the guide, which you will keep
   - discrepancies between the guide and `STATE.md`
   - workstreams left out, and why (e.g. "W4 is `Awaiting confirmation`")
   - open questions
3. **Wait.** Write nothing to the guide until the operator approves. They may approve, amend, or
   hold. On hold, the row stays `Pending` and Progress records it:
   `guide held YYYY-MM-DD: <reason>`.
   On amend, restate the amended proposal and wait for a yes.
4. **Write** exactly what was approved — [section-rules.md](section-rules.md),
   [diagrams.md](diagrams.md).
5. **Record** in `STATE.md`: Guide → `Documented YYYY-MM-DD`, and a line in `workflow/project-state/ledger/done-ledger.md`; remove
   any `guide out of date` notes this update resolved.

**Operator unavailable:** nothing blocks. Leave the rows as they are; the next session's
reconciliation surfaces them.

**A request collides with a recorded decision** — a Decisions entry, a Known Gap, or the
out-of-scope list: the `branch-state` keep-or-reverse rule (`AGENTS.md` § 4) applies unchanged. Stop
and ask before proposing.

## Red Flags — Stop

- "I'm on a branch and the code just landed, I'll update the guide now" → not on a branch. Leave
  Guide at `—`, note `guide out of date` in the branch state if it is wrong, and let the fold start
  the checkpoint.
- "They asked me to update the docs, so that's approval" → a request starts a proposal. Approval
  is their reply to the proposal.
- "They approved the spec, so the guide seed is approved" → the seed needs its own approval.
- "It's `Done`, so it's confirmed" → ask.
- "They said update the docs, so everything goes in" → only `Pending` rows. Name what you left out.
- "It's a small edit, I'll just write it" → propose first. Always.
- "The spec says X, so the guide says X" → the code wins. Cite the deviation.
- "I'll add the planned architecture now to save time" → architecture, components and diagrams
  describe built code only.
- "The guide says X, so I'll build X" → the guide is not the source of truth. Follow
  `STATE.md` and report the discrepancy.
- "I'll tidy this hand-written paragraph while I'm here" → keep hand edits; list them in the
  proposal.
- "The guide update is a doc-only small change, so a Done line is enough" → the guide is never a
  small change. Propose first, whatever its size.
- "The guide is just out of date, I'll correct the wording" → not outside a checkpoint. Follow
  `STATE.md`, report it, and add `guide out of date: <what>` to that workstream's Progress.
- "W1 is `Done`, so it's wrapped up" → `Done` starts the guide step; it does not end the work.

## Where the Rest Lives

| File | Read it when |
|---|---|
| [first-write.md](first-write.md) | The guide does not exist yet |
| [section-rules.md](section-rules.md) | Drafting a proposal, or writing approved changes |
| [diagrams.md](diagrams.md) | A proposal includes a diagram |
| [guide-template.md](guide-template.md) | Creating the guide |

## Guide Layout and Reading Cost

The guide is a folder, not one file: `docs/guide/index.md` (links and status per section, at most 3 KB), one file per section (target at most 15 KB each), and `map.json` (source-path glob to sections). At a checkpoint give `ws guide-targets <changed paths...>` the paths the fold changed and read **only the index and the sections it names** — never the whole guide. Claim-versus-code verification runs per section. Without `ws`, read the index and pick sections by hand from the changed paths. Checkpoint default is `phase` (write once when a group of related workstreams is Done); `feature` stays available per project in `AGENTS.md` § 5.
