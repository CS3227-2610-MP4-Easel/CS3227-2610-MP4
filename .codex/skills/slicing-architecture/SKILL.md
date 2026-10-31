---
name: slicing-architecture
description: Use when an architecture in docs/architecture has passed its readiness gate and must be cut into workstreams, when the architecture gains decisions that change what work exists, or when the operator asks to break the architecture into workstreams, vertical slices, or a build order. Bridges architecting-systems to writing-specs-lite.
---

# Slicing Architecture

Turns the **Target** architecture (`docs/architecture/`, from `architecting-systems`) into
**workstreams** the project state can track. Target is what should exist; project state
(`architecture/<area>.md` "Now") is what is built. Do not mix them.

**Announce at start:** "I'm using slicing-architecture to cut the architecture into workstreams."

## Process

1. **Read** the readiness-gate summary, the delivery plan, and `STATE.md` §3 Workstreams and
   `guardrails.md`. Read architecture sections only as you cut each slice.
2. **Cut vertical workstreams** (one capability across layers, never one layer). For each, note:
   - architecture sections and contracts it realises (by anchor, e.g. `contracts.md#create-room`)
   - requirements it traces to (F/N IDs)
   - dependencies on other workstreams
   - areas it will change (these become `architecture/<area>.md` stubs)
   - a suggested tier (Small / Medium / Big) and risk
3. **Write the rows** with `Status: Not started`, links to those sections, on the branch state (or
   `STATE.md` when slicing on `INT` at project start). Create area stubs from
   `project-state/templates/architecture-area-template.md` for areas that do not exist yet; their
   Now says *(planned)*.
4. **Report gaps both ways**: architecture items no workstream covers, and workstreams that cite no
   architecture. Both are findings, not details.
5. **Gate:** ask the operator one question to confirm the slicing (the list, dependencies, and
   what is left uncovered). Write nothing as final on silence.

## Output shape

| Workstream | Realises (architecture anchors) | Traces to | Depends on | Areas | Tier |
|---|---|---|---|---|---|

## Traceability chain

```
requirement -> architecture component/contract -> workstream -> spec F/N -> plan T -> test E -> commit trailer
```

Keep it intact: a spec cites contracts by anchor instead of restating them, and an architecture gap
found while specifying goes back to `architecting-systems` as a new Gap.

## Red flags

- Slicing by layer ("database", "API", "UI") instead of capability.
- A workstream with no architecture citation, or architecture with no workstream, left unreported.
- Writing workstream rows before the operator confirms the slicing.
- Copying contract text into the workstream row; cite the anchor.
