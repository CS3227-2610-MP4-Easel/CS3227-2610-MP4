# Architecture Area File Template

Copy to `workflow/project-state/architecture/<area>.md` the first time an area becomes real.
Areas mirror the system's real parts — data, a boundary such as auth or tenancy, a core engine,
the interface, each integration — usually drawn from the spec's architecture section. Three to
eight per project, not one per directory or class.

Read this file **only when a task touches this area** — never read the whole `architecture/`
folder "for context."

---

````markdown
# Architecture — <Area name>

> Legend: `C` = project decision. This area's **Now** is replaced wholesale when a branch changes
> it (`branch-state` skill § Architecture); the decisions table only grows.

## Now

<What this area is and how it behaves today, in a few lines a newcomer can follow. Name the real
files and functions. Say what it must never do, if that is the point of it. Mark anything settled
but unbuilt *(planned)*; leave out anything merely proposed.>

## Paths

| Path | Role |
|---|---|
| `<file>` | <what it owns> |

## Decisions

The decisions that shaped this area, newest first. Full reasoning lives in each `decisions/C<n>.md`;
this table is the index for this area only.

| ID | Date | One-line decision | File |
|---|---|---|---|
| C9 | YYYY-MM-DD | <decision that shaped this area> | [decisions/C9.md](../decisions/C9.md) |

## Target Link and Drift

<Which `docs/architecture/` section this area realises, and what currently differs (or "none
known"). Updated whenever this area's Now changes.>
````
