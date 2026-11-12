# Skill Ecosystem: Implementation Status

- **Date:** 2026-10-31
- **Where the work lives:** user-level skills in `~/.claude/skills` (not this repo). Per design principle 3, edit only there and vendor into projects with `ws skills sync`.
- **Design:** `docs/skill-ecosystem-design.md`. Phase 1 test record: `docs/skill-ecosystem-phase1-test.md`.

| Phase | Design item | State | Verified how |
|---|---|---|---|
| 0 | Baseline measurement | Partial: three subagent runs recorded (78K-86K tokens incl. harness); no per-stage figure above baseline, no old-skill comparison run | Phase 1 test doc |
| 1 | Hot/cold layout, `project-state` + `branch-state` skills, router template, branch-state template, legend, `commits.md`, `manifest.json` template | Done | 3 subagent scenarios |
| 1a | `ws.mjs`: init, doctor, budget, pack, status, changes, task, hooks | Done | Run by hand on fixture |
| 1b | `infra.json`, `ws infra`, quiet `ws test` | `ws test` done; `ws infra` **syntax-checked only** (needs a real Postgres container) | `ws test` run on fixture |
| 2 | Medium tier template, reviewer bundle rule, tier question in router | Done in skills | Not exercised by an agent |
| 3 | `architecting-systems` to `docs/architecture/`, `AD-nn`, handoff; new `slicing-architecture`; `ws drift` | Done | `ws drift` run; skills read-checked only |
| 4 | Provider-neutral role files (10), `models.json`, `ws adapters claude/codex`, `ws verify-scope`, `drafting-interfaces`, `authoring-tests`, lessons, `ws decision`, `ws lesson`, executing-plans adaptation | Done | adapters, scope, decision, lesson run on fixture. **Codex output format is unverified** |
| 5 | Model-routing experiments | **Not run.** Protocol and results template in `project-state/experiments.md`; needs the team's model per tier | n/a |
| 6 | Split guide, `map.json`, `phase` default, `ws guide-targets` | Done in skills | `ws guide-targets` run |
| 7 | `ws fold`, `ws skills sync/check`, remove old skill | Done | `ws fold` reproduced a subagent's manual fold (W~1 to W2, C~1 to C3) and handled decision/lesson blocks; skills sync/check detected an edited vendored skill |

## Not yet validated

- No subagent has used the Medium tier, `slicing-architecture`, `drafting-interfaces`, `authoring-tests`, the split guide, or the fresh-context-per-task rule.
- `ws fold` parses two branch-state formats (table rows and `ws decision` blocks); other shapes are untested. Binding-decision placement in `guardrails.md` is still manual.
- Hooks were exercised once, on one commit; Windows `cmd` quoting affects `ws test` command strings.
- `SKILL.md` routers remain above the 3 KB soft target (`branch-state` 7.7 KB, `project-state` about 8 KB).
- No part of this has been run in MP4 yet; the project still has no `workflow/` tree.

## To adopt in a project

1. Copy `project-state/scripts/ws.mjs` to `workflow/tools/ws.mjs`; run `node workflow/tools/ws.mjs doctor`, then `init`.
2. Follow `project-state/bootstrapping.md`; copy `manifest-template.json`, `models-template.json`, `templates/agents/*` into `workflow/`.
3. Set `skills`, `int_branch`, `test_commands` in `workflow/config.json`; run `ws skills sync`.
4. Write `AGENTS.md` from `templates/agents-router-template.md` (keep its section numbers).
5. Run the Phase 5 experiments once the team has chosen candidate models.
