# Failure Modes

How this tree decays, and the counter for each. Read when you notice yourself reaching for a
reason not to write something down, or not to split a fact into its own cold file.

## Rationalizations

| Excuse | Reality |
|---|---|
| "I'll put the full decision text in `STATE.md`, it's all in one place" | That is exactly what made the old monolith unreadable. Full text goes in `decisions/C<n>.md`; `STATE.md` gets one line and a link |
| "I'll read the whole `architecture/` folder to be safe" | Defeats the point of splitting it. Read the area your task touches; if you don't know which, ask or infer from the spec |
| "It's a small change, it doesn't need recording" | Ceremony scales with size; the record does not. A one-line behaviour change still needs a Done-ledger line |
| "This decision was implicit / obvious" | Implicit decisions get silently reversed by the next agent, who has no idea one was ever made |
| "I recorded the decision, so the architecture is covered" | A decision says what changed; the area's Now says what *is*. Rewrite it in the same edit |
| "Nothing meaningful changed" | Decide that consciously. If you edited a file, something changed |
| "The guardrails entry is old, I'll leave it in `guardrails.md` forever" | Once it stops being active or high-risk, move it out of the index (it stays in its cold file) — an over-long guardrails file gets skimmed, not read |
| "I'll just add this decision straight to `guardrails.md`'s table" | Only if it is a prohibition (Known Gap, out-of-scope, a binding constraint). Everything else goes in `STATE.md`'s decision index |

## Common Mistakes

- **A decision log instead of a design.** Decisions dumped into `decisions/` with no area file
  describing the system as it stands. Every reader then has to open every decision and guess
  which ones still hold.
- **Status drift.** `Building` on something untouched for weeks. See
  [reconciliation.md](reconciliation.md).
- **Fixing a Known Gap.** An entry in `guardrails.md` is a decision, not a TODO. If you think it
  is wrong, raise it — do not quietly implement it.
- **A fold nobody runs.** A merged branch whose state is still sitting in `branch-states/` makes
  `STATE.md` lie by omission. Reconciliation lists them; tell the owner.
- **Deleting instead of archiving.** A deviation that is no longer live still explains why the
  code looks the way it does. Mark it not-live in its own file; never delete it.
- **Duplicating git.** The ledger records what changed for the user and why, at a level git
  cannot. Cite the commit as a reference; the commit is not the entry.
- **Orphan cold files.** A `decisions/C<n>.md` with no entry in `STATE.md`'s index or
  `guardrails.md` and no mention in any `architecture/<area>.md` is invisible. Every cold file
  must be reachable from somewhere hot.
