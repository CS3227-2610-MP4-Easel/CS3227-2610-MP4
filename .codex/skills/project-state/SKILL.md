---
name: project-state
description: Use when bootstrapping a project's state layout for the first time, when sync-project-state or an owner hotfix needs the structure of the hot and cold state files, when reconciling the whole state tree against the repo, or when creating a new decision, deviation, architecture-area or convention file. Keywords - STATE.md, guardrails.md, workflow/project-state, cold folder, decisions, deviations, architecture Now, bootstrapping, reconciliation, hot state, index.
---

# Project State

## Overview

`INT`'s memory is split by how often it is needed, not kept in one file:

| | Hot | Cold |
|---|---|---|
| **Files** | `STATE.md`, `guardrails.md` | `architecture/<area>.md`, `conventions/<topic>.md`, `decisions/C<n>.md`, `deviations/D<n>.md`, `ledger/` |
| **Read** | Every session, in full | By ID or area, only when the task touches it |
| **Size** | `STATE.md` ≤8 KB, `guardrails.md` ≤2 KB (soft) | Grows without limit |

All of it lives under `workflow/project-state/`. Branches never write here — they write
`workflow/project-state/branch-states/<slug>.md` instead (**branch-state** skill), which is folded
in by `sync-project-state`. This skill is for the **hot/cold structure itself**: what almost every
agent needs is the one-line checklist below; the branch-state skill carries the day-to-day
write-immediately rules.

**This is a project's permanent record.** The operator switches models, agents and context
windows; none of that history survives. Anything not written here did not happen.

## The Layout

```
workflow/project-state/
  STATE.md                hot, ≤8 KB — How to Resume, Workstreams, Upcoming, Needs a Human, decision index
  guardrails.md           ≤2 KB, always loaded — Known Gaps, out-of-scope, binding decisions
  architecture/<area>.md  one file per system part — Now, Paths, the decision IDs that shaped it
  conventions/<topic>.md  one file per rule topic
  decisions/C<n>.md       one file per decision, ADR-style
  lessons/L<n>.md         one file per lesson, scoped project or role:<name>, loaded by ws pack
  deviations/D<n>.md      one file per deviation
  ledger/done-ledger.md   append-only Done ledger
  ledger/YYYY-MM.md       rotated once the live ledger passes ~100 entries
  branch-states/<slug>.md branch-state skill's territory
```

`STATE.md` and `guardrails.md` do not duplicate each other: `guardrails.md` lists *prohibitions* —
Known Gaps, out-of-scope items, and decisions that forbid or constrain a future action, each one
line with an ID and a link to its cold file. `STATE.md`'s decision index lists everything else
currently binding — process, tooling, priorities — the same way. A decision moves out of both
indexes, but never out of its cold file, once it is superseded.

## Read Before You Act

At session start, and after any compaction:

1. **Read `STATE.md` and `guardrails.md` in full.** Nothing else, yet.
2. **On a branch**, read its branch state in full (branch-state skill) — it is the hot file for
   everything that branch has changed.
3. **Pull a cold file only when your task touches it** — the area you are changing
   (`architecture/<area>.md`), the convention topic that applies, or a decision/deviation cited by
   ID from something you just read. Never read the whole `architecture/` or `decisions/` folder
   "to be safe"; if you don't know which area, ask or infer it from the spec, not from reading
   everything.
4. **Verify against the repo** — [reconciliation.md](reconciliation.md).

If `workflow/project-state/STATE.md` does not exist — [bootstrapping.md](bootstrapping.md).

## The `ws` Tool (optional accelerator)

`scripts/ws.mjs` (Node 18+, standard library only, no model calls). Copy it to
`workflow/tools/ws.mjs` in the project and run `node workflow/tools/ws.mjs <cmd>`:
`init` (state tree, git hooks), `doctor`, `budget` (soft size report), `pack <role> [--area A]
[--id C1] [--cat]` (the read-list for a role from `workflow/manifest.json`, with a token
estimate; copy [templates/manifest-template.json](templates/manifest-template.json)),
`status <W> <status>` (validated), `changes [slug]` (Changes table from commit trailers),
`task start <T>|done`, `test [component]` (quiet runner), `infra ...` ([infra.md](infra.md)), `decision new|show|supersede`, `lesson new|graduate`, `fold <slug>` (mechanical part of a sync), `adapters claude|codex` and `verify-scope <role>` (role files in `templates/agents/`, `templates/models-template.json`), `skills sync|check` (vendoring with a checksum lock), `drift`, `guide-targets <paths...>`, `feedback <skill> --issue --evidence --suggest`. **If Node is missing, everything still works by hand** — the steps below and
in `branch-state` are the fallback; `ws` only saves tokens and typos.

## Creating a Cold-Folder Entry

Not automated (`ws decision` and `ws fold` are a later phase); do it by hand:

- **Decision** — copy [templates/decision-template.md](templates/decision-template.md) to
  `decisions/C<n>.md`, next free number. Add it to `STATE.md`'s decision index (or to
  `guardrails.md` if it is a prohibition) with the one-line summary and the link.
- **Deviation** — copy [templates/deviation-template.md](templates/deviation-template.md) to
  `deviations/D<n>.md`. Deviations are not indexed in `STATE.md`; they are cited by ID from the
  Workstreams Progress cell or wherever they are relevant, and discovered by filename.
- **Architecture area** — copy
  [templates/architecture-area-template.md](templates/architecture-area-template.md) to
  `architecture/<area>.md` the first time an area becomes real.
- **Convention topic** — copy [templates/conventions-template.md](templates/conventions-template.md)
  to `conventions/<topic>.md`.

On a branch, these do not exist yet as permanent files — the branch state holds the proposed text
with a provisional ID (`C~1`), and `sync-project-state` creates the permanent cold file at fold
(branch-state skill, `commits.md`-adjacent rules).

## Legend Rule

Every table that holds IDs opens with a one-line legend, because ID families look alike —
see [legend.md](legend.md) for the exact wording to use for `C` (project decision) and `D`
(deviation) tables. Architecture decisions will get their own `AD-nn` family once
`architecting-systems` output moves under this layout (a later phase); until then, cite
architecture-shaping decisions with `C<n>` like any other and keep the file's legend line.

## Size and Growth (soft)

`guardrails.md` holds only *active or high-risk* entries — an item that stops constraining work
moves out of the index (it stays in its cold file). `STATE.md`'s decision index lists decisions
currently binding, not every decision ever made. Neither file is hard-capped; if one grows past
its target, trim it in the same sitting rather than letting it drift, so the next read is honest
about size.

## Where the Rest Lives

| File | Read it when |
|---|---|
| [bootstrapping.md](bootstrapping.md) | `STATE.md` does not exist yet |
| [reconciliation.md](reconciliation.md) | Session start, after reading the hot files — verifying the whole tree against the repo, merging `INT` into a branch, resolving doc-vs-repo conflicts |
| [failure-modes.md](failure-modes.md) | You are about to skip or shortcut an update, or the files have decayed |
| [legend.md](legend.md) | Writing or copying any table that carries `C`/`D` IDs |
| [templates/state-template.md](templates/state-template.md) | Creating `STATE.md` |
| [templates/guardrails-template.md](templates/guardrails-template.md) | Creating `guardrails.md` |
| [templates/architecture-area-template.md](templates/architecture-area-template.md) | Creating an area's first cold file |
| [templates/conventions-template.md](templates/conventions-template.md) | Creating a convention topic's first cold file |
| [templates/decision-template.md](templates/decision-template.md) | Recording a permanent decision |
| [templates/deviation-template.md](templates/deviation-template.md) | Recording a permanent deviation |
| [templates/lesson-template.md](templates/lesson-template.md) | Recording a permanent lesson |
| [templates/agents/](templates/agents/), [templates/models-template.json](templates/models-template.json) | Setting up provider-neutral role definitions (`workflow/agents/`) and model tiers; then `ws adapters` |
| [experiments.md](experiments.md) | Validating which model tier a role can use |
| [skill-feedback.md](skill-feedback.md) | A size cap, read list or flow does not fit the work: how to flag it and propose a revision |
| [templates/agents-router-template.md](templates/agents-router-template.md) | Writing a project's `AGENTS.md` for the first time |
| `branch-state` skill | Any work happening *on* a branch — write-immediately triggers, the branch-state template, session rows, commit conventions |
| `sync-project-state` skill | Folding a merged, approved branch state into this layout |
| `update-documentation` skill | The project keeps a developer guide and a workstream was folded as `Done` |
