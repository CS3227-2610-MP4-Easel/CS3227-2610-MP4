# Skills Ecosystem — A Guide for Humans

These skills let several people and several AI agents build one project over weeks without
losing the thread. They solve three problems: agents forget between sessions, reading everything
every session is expensive, and without gates an agent will happily build the wrong thing. The
design rationale is in the project repo (`docs/skill-ecosystem-design.md`); this file is the map.

## The three ideas

1. **Memory lives in files, not in chat.** Anything not written to the project state did not
   happen. A fresh agent with no history can pick the work up by reading a few small files.
2. **Read little, read the right thing.** Hot files are read every session and kept small; cold
   files are read only by ID or area. `ws pack <role>` prints exactly what a role should read.
3. **Ceremony matches risk.** A typo fix needs nothing; a schema change needs a spec, a plan,
   blind tests and review. Humans approve at fixed gates; agents never approve for them.

## How the work flows

```
architecting-systems      Target architecture (docs/architecture/, AD-nn decisions, readiness gate)
        |
slicing-architecture      Cuts it into workstreams (W1, W2 ...) in STATE.md
        |                 Size each change: Small / Medium / Big (AGENTS.md section 3)
writing-specs-lite        Spec files, reviewed from several lenses            -- Gate 1: approve spec
        |
drafting-interfaces       (Big) compilable stubs from the spec's contracts
authoring-tests           (Big) contract tests written blind, from the spec only
        |
writing-plans-lite        Task list with exact files and a checklist          -- Gate 2: approve plan
        |
executing-plans-lite      One fresh context per task: test, build, tick, update branch state
        |                                                                      -- Gate 3: branch review
   (merge to development)
        |
sync-project-state        Folds the branch state into the project state       -- Gates 4, 5
update-documentation      Updates the developer guide for Done workstreams    -- Gate 6
```

Throughout, **branch-state** keeps a lean file per branch (what changed, how to resume,
decisions, deviations, lessons) so any session can take over cold. **project-state** defines the
shared structure all of this reads and writes.

## The skills

| Skill | Use it when |
|---|---|
| `project-state` | Setting up or reconciling the state tree; hot/cold layout, templates, `ws` tool, role files |
| `branch-state` | Any work on a feature branch: write-immediately rules, session rows, commits |
| `sync-project-state` | A branch merged and the owner says fold it |
| `architecting-systems` | Designing or reviewing the target architecture |
| `slicing-architecture` | The architecture passed its gate and must become workstreams |
| `writing-specs-lite` | A Big or Medium change needs a spec |
| `drafting-interfaces`, `authoring-tests` | Big or high-risk specs: stubs first, then blind contract tests |
| `writing-plans-lite` | An approved spec needs a task plan |
| `executing-plans-lite` | Implementing a plan task by task |
| `update-documentation` | Keeping the developer guide (`docs/guide/`) current |
| `refresh-project-state` | Starting a new iteration; archives and condenses the state (owner only) |
| `logging-agent-interactions`, `reviewed-plan` | Standalone: interaction logs; a second-model reviewed spec and plan |

## The project state (`workflow/project-state/`)

| | Files | Read |
|---|---|---|
| Hot | `STATE.md` (about 8 KB), `guardrails.md` (about 2 KB) | every session |
| Cold | `architecture/<area>.md`, `conventions/`, `decisions/C<n>.md`, `deviations/D<n>.md`, `lessons/L<n>.md`, `ledger/` | by ID or area only |
| Branch | `branch-states/<slug>.md` | by the branch's own sessions |

`guardrails.md` lists what must not be done. If a request collides with it, the agent stops and
asks: keep the decision, or reverse it on the record.

IDs: `W` workstream, `C` decision, `D` deviation, `Q` needs a human, `L` lesson. On a branch they
carry `~` (`C~1`) and are renumbered at fold. Architecture documents use their own hyphenated
family (`AD-nn`, `G-nn`); the legend line at the top of each table says which is which.

## The `ws` tool

`workflow/tools/ws.mjs` is plain Node, no model calls, so it costs no tokens. It does the
mechanical work: `init`, `doctor`, `budget` (size report), `pack` (read list), `status`,
`changes`, `task`, `test` (quiet runner), `decision`, `lesson`, `fold`, `adapters`, `skills`,
`drift`, `guide-targets`, `feedback`. Every skill also describes the manual fallback, so a
missing Node never blocks work.

## Agents and models

Roles (reviewer, implementer, test-author, spec-writer, planner, interface-drafter, architect,
slicer, state-clerk, doc-writer) are defined once in `workflow/agents/`. `ws adapters claude|codex`
generates the tool-specific files. Each role names a tier (`strong`, `mid`, `cheap`); the model
for each tier lives only in `workflow/models.json`. Defaults are the tool default for every tier
until the team measures otherwise (`project-state/experiments.md`).

## Adopting it in a project

1. Copy `project-state/scripts/ws.mjs` to `workflow/tools/ws.mjs`; run `doctor`, then `init`.
2. Follow `project-state/bootstrapping.md`; seed `STATE.md`, `guardrails.md` and area files from
   the architecture.
3. Set `skills`, `int_branch` and `test_commands` in `workflow/config.json`; run `ws skills sync`
   to vendor the skills with a checksum lock.
4. Write `AGENTS.md` from `project-state/templates/agents-router-template.md`. Its section
   numbers are cited by the skills; do not renumber.
5. Run `ws adapters` for the tools the team uses.

## Where to edit

Skills are edited **only here** (`~/.claude/skills`). A project holds a locked copy in
`workflow/skills/`; `ws skills check` reports edits to it and `ws skills sync` refreshes it.

## The feedback loop

The limits in these skills are starting guesses: file sizes, read lists, review counts, which
steps apply to which tier. Agents are told to flag any that do not fit (`ws feedback`, logged in
`workflow/skill-feedback.md`) and, at stage boundaries, to propose a batch of revisions with the
expected saving in context, resource use and cost. The owner decides; accepted changes are made
here and re-synced. See `project-state/skill-feedback.md`.

## Known limits

Not yet validated by real use: the Medium tier, `slicing-architecture`, `drafting-interfaces`,
`authoring-tests`, the split developer guide, fresh-context-per-task, `ws infra` against a real
container, and the Codex adapter format. Model routing (`experiments.md`) has not been run. The
router `SKILL.md` files are about 8 KB against a 3 KB target. Treat these as the first things to
check, and log what you find.
