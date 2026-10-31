# Decision File Template (ADR-style)

Copy to `workflow/project-state/decisions/C<n>.md`, next free permanent number — allocated only by
`sync-project-state` at fold, or by the owner for a hotfix made directly on `INT`. A branch never
creates this file; it writes the same fields under a provisional `C~n` in its branch state.

---

````markdown
# C<n> — <short title>

- **Date:** YYYY-MM-DD
- **Who asked:** <operator / name, or "agent, confirmed by operator">
- **Supersedes:** <C<m> or "—">
- **Superseded by:** <C<m> or "—">
- **Shapes area:** <architecture/<area>.md, or "—" if this is a process decision>
- **Binding (guardrails.md):** <yes — add to guardrails.md's Binding Decisions table | no>

## Decision

<The outcome, stated as a rule someone could follow without more context.>

## Why

<The rationale — what problem this solves, what was asked, what constraint forced it.>

## Rejected Alternatives

- <option> — <why it was rejected>
````

If **Shapes area** is filled in, also add this ID to that area's Decisions table
(`architecture/<area>.md`). If **Binding** is yes, add the one-line constraint to `guardrails.md`
instead of (not in addition to) `STATE.md`'s decision index; otherwise add the one-line summary to
`STATE.md`'s decision index.
