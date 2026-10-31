# guardrails.md Template

Copy to `workflow/project-state/guardrails.md`. **Always loaded, target ≤2 KB.** This is the
collision check: before building anything, a request that matches a line here must stop and ask
(`branch-state` skill, collision rule) rather than silently proceeding or silently reversing it.

Keep only *active or high-risk* entries. A Known Gap that stops mattering, or a decision that is
superseded, drops out of this file (it stays in `STATE.md`'s decision index if still binding but
not a prohibition, or in its cold file either way).

---

````markdown
# Guardrails — <Project Name>

**Prohibitions and binding constraints only.** Full detail is one click away in `decisions/`,
`deviations/` or `architecture/<area>.md`. If a request collides with any line below, stop and
ask before doing anything — `branch-state` skill.

> Legend: entries below are Known Gaps, out-of-scope items, or binding decisions (`C<n>`). A
> Known Gap or out-of-scope entry carries no ID of its own; cite it by its bold name.

## Known Gaps & Accepted Limitations

Deliberately not built, or deliberately not fixed. **These are decisions, not a TODO list.**

- **<gap>** — <why it is deliberate, one line; full reasoning in `decisions/C<n>.md` if it has one>

## Explicitly Out of Scope

Deliberately rejected ideas, so nobody re-proposes them.

- **<idea>** — <why, one line>

## Binding Decisions

Decisions that forbid or constrain a future action — not every decision; see `STATE.md` §4 for
the rest.

| ID | Constraint | File |
|---|---|---|
| C1 | <what it forbids or requires, one line> | [decisions/C1.md](../project-state/decisions/C1.md) |
````
