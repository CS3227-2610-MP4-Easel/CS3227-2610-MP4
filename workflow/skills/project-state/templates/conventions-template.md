# Convention Topic File Template

Copy to `workflow/project-state/conventions/<topic>.md` when a new rule topic needs its own file
(for example `data-access.md`, `error-handling.md`, `testing.md`). Small projects may keep every
convention in one `conventions/general.md` until a topic earns its own file.

---

````markdown
# Conventions — <Topic>

Rules every change in this area must honour. Breaking one is a bug even if the tests pass.

- <e.g. every query in `lib/queries/` takes `workspaceId` as its first argument>
- <e.g. timestamps are stored UTC; only `lib/time.ts` formats or parses them>

## ID Namespaces

(Keep this block only in `conventions/general.md`, once per project.)

`W` = workstream, `C` = decision, `D` = deviation, `Q` = needs a human. Numbers are unique across
the whole project, never reused, and allocated only by `sync-project-state`. A branch state uses
provisional `~` IDs (`C~1`).
````
