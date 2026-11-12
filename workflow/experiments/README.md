# Experiment framework

Runs one task under several agent-workflow configurations ("arms") in isolated clones, then compares
tokens, cost, runtime and artifact quality. v1 drives the Claude CLI and covers the spec-and-plan stage.
Spec: `workflow/specs/2026-11-03-experiment-framework-design.md`. Plan: `workflow/plans/2026-11-03-experiment-framework.md`.

## Layout

| Path | Committed | What it holds |
|---|---|---|
| `arms/<id>.json` | yes | one agent-workflow configuration; the id equals the file name |
| `tasks/<id>/` | yes | `task.json`, `brief.md`, optional `answer-sheet.md` and `seeded-issues.json` |
| `experiments/<id>.json` | yes | tasks x arms, replicates, ceilings, decision rule; must be committed before `exp run` |
| `plugins/<name>/` | yes | unmodified plugin copies an arm may load |
| `rubric/` | yes | judge rubric and calibration artifacts |
| `harness/` | yes | the `exp` command line (Node ESM, no dependencies) and its tests |
| `config.json`, `pricing.json` | yes | local settings; USD per million tokens per model |
| `local/` | **no** | runs, transcripts, bank, queue (raw text; gitignored) |

A task whose id starts with `pilot-` must ship a seeded issue set that satisfies F16 (6 or more issues, all six required categories).
Results are committed under `docs/telemetry/experiments/`.

## Commands

```
node workflow/experiments/harness/exp.mjs <command>
```

`check [--secrets]` validates every file above. More commands arrive with later tasks; each is a file in
`harness/commands/` exporting `{name, run(argv)}`. Tests: `node --test "workflow/experiments/**/*.test.mjs"`.
Exit codes are in the spec's `api.md`.
