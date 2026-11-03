# Conventions

Cite existing conventions/ entries by ID; list only rules new or applied here.

| Rule | Applies to | Source |
|---|---|---|
| Harness code is Node ESM (`.mjs`), no dependencies, entry `harness/exp.mjs`, modules beside it | `workflow/experiments/harness/` | new in this spec (SD2); precedent `workflow/tools/ws.mjs` |
| `EXP_ROOT` is the folder two levels above `harness/exp.mjs`; no module hard-codes `workflow/experiments` | all harness paths | new in this spec |
| Layout under `EXP_ROOT`: committed `arms/`, `tasks/`, `experiments/`, `rubric/`, `plugins/`, `harness/`, `config.json`, `pricing.json`; gitignored `local/` | folder | new in this spec |
| Results are committed under `docs/telemetry/experiments/` | CSV outputs | AD-31 |
| Run id: `YYYYMMDD-HHmmss-<task-id>-<arm-id>-r<rep>` in UTC; the clone path is `<worktrees_root>/<run-id>`; task and arm ids are 24 characters at most so the path stays under 200 characters | `local/runs/`, clones | new in this spec |
| Ids use lower-case letters, digits and hyphens; all path fields are relative with no `..`; `base_commit` is a hex sha; git is spawned with an argument array and `--` | config files | new in this spec |
| Money is USD with 4 decimals, tokens are integers, durations are whole seconds, times are UTC ISO-8601 | JSON and CSV | new in this spec |
| Raw transcripts, `otel.log`, artifacts, bank and questions stay under `local/`; `.gitignore` lists `workflow/experiments/local/`; `exp check` asserts `git check-ignore` covers `local/` and `worktrees_root` | secrets rule | AD-32 |
| The CLI keeps its own transcript store after a run; it holds the same text and is not cleaned by the harness (retention is the operator's) | transcripts | new in this spec |
| Tests: `*.test.mjs` beside the module, run with `node --test`; a fake CLI `harness/fixtures/fake-claude.mjs` (set through `config.json` `claude_bin`) replays scripted transcripts so no test spends money; real model calls happen only in T2 and T9 | harness tests | new in this spec |
| The test command is added to `workflow/config.json` `test_commands` when T1 lands | config | new in this spec |
| Vendored skills and agents are used as shipped; arms select among them and never edit them | arms | `AGENTS.md` § 9 |
| Commit messages: `type: what and why (workstream)` with `Workstream:` and `Task:` trailers; trailers use the permanent id the owner assigns, never `W~1` | commits | `AGENTS.md` § 6 |
| Process tooling sits outside `src/`, like `workflow/tools/ws.mjs`; location is open question Q4 | harness folder | C8 |
