# Deviation File Template

Copy to `workflow/project-state/deviations/D<n>.md`, next free permanent number. Deviations are
not indexed anywhere in `STATE.md` — they are cited by ID from a Workstreams Progress cell, a
session row, or wherever they are relevant, and found by filename otherwise. **This file is the
only home for this fact** — it contradicts or post-dates the spec/plan it refers to.

---

````markdown
# D<n> — <short title> (<where it was found>)

- **Date:** YYYY-MM-DD
- **Workstream:** <ID>
- **Still live:** <yes — the code still behaves this way | no — superseded by <what>, archived
  <date>>

## What the Document Said

<The spec or plan's claim, cited by section.>

## What Is True Instead, and Why

<The actual behaviour, and the reason the documented approach didn't hold.>

## Consequence

<What a future agent must do differently, or what test now guards it.>
````

Never delete this file once the deviation stops being live — mark **Still live: no** and leave it;
it still explains why the code once looked the way it did. Move it to
`workflow/project-history/` only as part of a `refresh-project-state` run, never on its own.
