# Experiment Framework Implementation Plan

- **Status:** Approved (Xiao-Congchen, 2026-11-03)

> **For agents:** tick `- [ ]` -> `- [x]` as you finish each step, in this file, in the same commit as the work. Keep the branch state's Progress cell current. Spec: [experiment framework design](../specs/2026-11-03-experiment-framework-design.md).

## Scope
**Goal:** a local harness that runs one task under several agent-workflow arms in isolated clones, controls the agents' questions, extracts per-call usage, grades the spec and plan artifacts, and writes CSVs under `docs/telemetry/experiments/`; v1 drives the Claude CLI only and covers the spec-and-plan stage.
**In scope:** F1-F17, N1-N8, edge cases E1-E70 (spec `requirements.md`, `edge-cases.md`).
**Non-goals:** implementation, ablation and model-tier stages (exit 8); the real W7 task bundle and run; a dashboard; a Codex driver or any provider seam (the owner chose "plan as is"); significance tests; CI; OS sandboxing; editing anything under `workflow/skills/` or `.claude/skills/` (`AGENTS.md` § 9); touching `src/`, `tests/` or root `package.json`.
**Risk tier:** Medium. Verification: every module is test-first against a fake CLI (`harness/fixtures/fake-claude.mjs`) so no test spends money; real model calls happen only in T2 and T9 and start with `GATE:`; the Attacker-lens rows (E2, E3, E4, E26-E28, E36, E47, E57-E62, E64) each have a named test.

**Commands used below.** `<TEST x>` = `node --test "workflow/experiments/harness/x.test.mjs"`. `<BUILD>` = `node --test "workflow/experiments/**/*.test.mjs"` (after T1 it is also the `experiments` entry of `workflow/config.json` `test_commands`; Node 22 expands the glob itself). Root `npm test` is not used: it needs PostgreSQL and covers `tests/` and `src/be/` only. Node is v22; the harness uses no dependencies. Each command is its own file `harness/commands/<name>.mjs` exporting `{name, run(argv)}`; `exp.mjs` (T1) loads that folder, so tasks never edit `exp.mjs` again.

## Task order
<!-- Status: Not started / In progress / Done / Blocked / Post-merge (a human step after the merge) -->
| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 Schemas and check | - | T2 | 1 | Done |
| T2 Isolation spike | - | T1 | 1 | Done |
| T3 Launcher and driver | T1, T2 | T5, T8 | 2 | Not started |
| T5 Extractor | T1, T2 | T3, T8 | 2 | Not started |
| T8 Pilot bundle | T1, T2 | T3, T5 | 2 | Not started |
| T4 Sheet answerer | T3 | - | 3 | Not started |
| T6 Grader | T3, T4, T5 | T10 | 4 | Not started |
| T10 Bank and queue | T4 | T6 | 4 | Not started |
| T7 Report | T5, T6 | - | 5 | Not started |
| T9 Pilot run and review | T3, T4, T6, T7, T8 | - | 6 | Not started |

Executor note: run inline, task by task in table order. Tasks in one wave share no files, so a wave may be split across subagents, one per task. T3 is the largest task (about 17 files); commit it per slice (steps 3, 5, 7, 8) rather than once. Task order differs from the numbering: T10 comes before T7.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1, T8 | `schema.test.mjs` (valid and invalid arm files); `exp check` on the three shipped arms |
| F2 | T1, T8 | `check.test.mjs` (sheet-mode without sheet, bank-mode without seeded file) |
| F3 | T3 | `clone.test.mjs` (no remotes, stripped and overlaid `.claude/`, distinct paths) |
| F4 | T2, T3 | `isolation.test.mjs` with the recorded init record and a mutated copy; T2 findings |
| F5 | T3 | `classify.test.mjs` (six fixtures) |
| F6 | T3 | `state.test.mjs`, `driver.test.mjs` (`--continue` after kill, `max_parallel`, next free rep) |
| F7 | T4 | `answerer.test.mjs` (fixed text byte-equal) |
| F8 | T10 | `bank.test.mjs` (pair table), `queue.test.mjs` |
| F9 | T5 | `extract.test.mjs` (dedupe, subagent fixture, hand-computed cost) |
| F10 | T5 | `phases.test.mjs` (precedence fixtures) |
| F11 | T4, T6 | `questions.test.mjs`; `grade.test.mjs` (issue ids set after grading) |
| F12 | T6 | `grade.test.mjs`, judge self-test on the calibration set (run for real in T9) |
| F13 | T7 | `report.test.mjs` (worked tables 1 and 2) |
| F14 | T3 | `budget.test.mjs`, `driver.test.mjs` (stub CLI scripted costs) |
| F15 | T1, T3, T8 | `check.test.mjs`; `driver.test.mjs` (exit 7); pilot experiment file committed |
| F16 | T1, T8 | `check.test.mjs` (E56 fixtures); `exp check` on `pilot-pinned-note` |
| F17 | T3 | `containment.test.mjs`, `spawn.test.mjs`, `driver.test.mjs` (exit 10) |
| N1 | T2, T5, T9 | T2 records the reference field; `extract.test.mjs`; T9 compares real runs |
| N2 | T3 | `state.test.mjs` (manifest contents and hashes) |
| N3 | T1, T6, T7 | `secrets.test.mjs` (positive and negative fixtures); `report.test.mjs` (exit 9) |
| N4 | T4, T6 | `answerer.test.mjs`, `judge.test.mjs` (launch flags, prompt contents) |
| N5 | T5 | `metrics.test.mjs` (timeline fixture) |
| N6 | T5 | `metrics.test.mjs` (five cost classes) |
| N7 | T1, T3 | `spawn.test.mjs` (hostile argv, launcher refusal); Windows 11 test run |
| N8 | T3, T5 | `state.test.mjs` (fault injection); `extract.test.mjs` (twice identical) |
| E1, E2, E3, E5, E6, E7, E8, E9, E10, E56 | T1 | `schema.test.mjs`, `check.test.mjs` (one test per row) |
| E4, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20, E21, E22, E23 | T3 | `driver.test.mjs`, `classify.test.mjs`, `state.test.mjs` |
| E24, E25, E71, E26, E27, E28, E29, E57, E58, E59, E60, E61, E64 | T3 | `isolation.test.mjs`, `containment.test.mjs`, `spawn.test.mjs`, `clone.test.mjs`, `driver.test.mjs` |
| E53, E54, E55, E65, E66 | T3 | `budget.test.mjs`, `driver.test.mjs` |
| E30, E31, E32, E36, E62 | T4 | `answerer.test.mjs`, `sanitize.test.mjs`; E32 on the real model through `exp answerer --self-test` in T9 |
| E39, E40, E41, E42, E43, E63, E69 | T5 | `extract.test.mjs`, `phases.test.mjs`, `metrics.test.mjs`; E42 on real runs in T9 |
| E38, E44, E45, E46, E47, E48, E67, E68 | T6 | `grade.test.mjs`, `judge.test.mjs`; E46 canary on the real model in T9 |
| E49, E50, E51, E52 | T7 | `report.test.mjs`, `stats.test.mjs` |
| E33, E34, E35, E37, E70 | T10 | `bank.test.mjs`, `queue.test.mjs` |

## Verification gates
- Per task: `<TEST x>` for the touched module while working, then `<BUILD>`; `git diff --stat` shows only paths under `workflow/experiments/`, `workflow/config.json`, `.gitignore`, `docs/telemetry/experiments/`, `workflow/plans/`, `workflow/specs/` and the branch state.
- Before finishing: `<BUILD>` green on Windows 11; `exp check --secrets` clean; T9 pass criteria met (spec `implementation-order.md`); each F and N acceptance criterion has a passing test or a recorded manual check.

---

### T1: Schemas, layout and `exp check`
**Delivers:** validators, cost function, command loader and `exp check` | **Satisfies:** F1, F2, F15, F16, N3, N7 | **Depends on:** - | **Wave:** 1

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/README.md` | layout and commands in 30 lines; points at the spec |
| Create | `workflow/experiments/config.json` | `worktrees_root` `../exp-runs`, `claude_bin` `claude`, `auth_mode` `login`, `isolation_ignore` `[]` (data-model § Config) |
| Create | `workflow/experiments/pricing.json` | `{"schema_version":1,"models":{}}`; T2 fills it |
| Create | `workflow/experiments/harness/paths.mjs` | `REPO_ROOT` (git top level), `EXP_ROOT` (two levels above `exp.mjs`), `resolveWorktreesRoot()` |
| Create | `workflow/experiments/harness/schema.mjs` | validators for config, arm, task, experiment, pricing, seeded issues; id, path and sha rules |
| Create | `workflow/experiments/harness/pricing.mjs` | `eventCost(usage, price)` from the four buckets, unrounded; `runCost(events)` rounded once to 4 decimals |
| Create | `workflow/experiments/harness/secrets.mjs` | the six credential patterns, `scan(text)`, `redact(text)` |
| Create | `workflow/experiments/harness/check.mjs` | `exp check [--secrets]` logic: validate every file, `git check-ignore`, F2 and F16 rules |
| Create | `workflow/experiments/harness/exp.mjs` | entry point: loads every `harness/commands/*.mjs` and dispatches by `name` |
| Create | `workflow/experiments/harness/commands/check.mjs` | thin command wrapper around `check.mjs` |
| Modify | `.gitignore` | append `workflow/experiments/local/` |
| Modify | `workflow/config.json` (`test_commands`) | add `"experiments": "node --test \"workflow/experiments/**/*.test.mjs\""` after W1's four entries |
| Test | `workflow/experiments/harness/schema.test.mjs` | E1, E2, E3, E6, E7, E8, E9, E10 |
| Test | `workflow/experiments/harness/check.test.mjs` | E5, E56, F2 and F16 rules, ignore assertions |
| Test | `workflow/experiments/harness/secrets.test.mjs` | six positive patterns, negatives (a git sha, a base64 image header), redaction |
| Test | `workflow/experiments/harness/pricing.test.mjs` | hand-computed event and run cost under a stub price table |

**Checklist**
- [x] 1. Write failing `schema.test.mjs`: arm id differs from file name (E1); `plugins` of `../x`, an absolute path or a path outside `plugins/` (E2); bypass-all `permission_mode` (E3); non-hex or missing `base_commit` (E6); duplicate seeded issue id (E7); arm stage differs from task stage (E8); `review.max_rounds` 3 (E9); arm model absent from pricing (E10); `isolation_ignore` naming a plugin or hook (F1). Run `<TEST schema>`; expect FAIL because `schema.mjs` does not exist.
- [x] 2. Implement `paths.mjs` and `schema.mjs` (hand-written validators returning `{ok, errors[]}`; ids `[a-z0-9-]{3,24}`; paths relative with no `..`; a resolved path must stay inside its root). Intended shape: `export function validateArm(obj, {fileName, pricing})`.
- [x] 3. Run `<TEST schema>`; expect PASS.
- [x] 4. Write failing `secrets.test.mjs` (the six patterns from spec `runtime.md` § Credential patterns, one positive each, the two negatives, redaction) and `pricing.test.mjs` (three events under a stub price table with hand-computed costs; the run total rounded once); implement `secrets.mjs` and `pricing.mjs`. Intended cost shape: `(in*p.input + out*p.output + cr*p.cache_read + cw5*p.cache_write_5m + cw1*p.cache_write_1h) / 1e6`. Expect PASS.
- [x] 5. Write failing `check.test.mjs` on a temp `EXP_ROOT`: sheet-mode experiment with a task lacking `answer-sheet.md` exits 3 (E5); bank-mode with no seeded file is clean (F2); pilot seeded set with fewer than 6 issues or a missing category exits 3 (E56, F16); an anchor not found in brief or sheet exits 3; `--secrets` with a planted `sk-ant-` string exits 9; `local/` not covered by `git check-ignore` is reported.
- [x] 6. Implement `check.mjs`, `commands/check.mjs` and `exp.mjs` (directory loader); run `<TEST check>`; expect PASS.
- [x] 7. Create `config.json`, `pricing.json`, `README.md`; modify `.gitignore` and `workflow/config.json`; run `node workflow/experiments/harness/exp.mjs check`; expect exit 0; confirm `git check-ignore -v workflow/experiments/local/x` matches.
- [x] 8. `<BUILD>` green; update branch state: Progress, Changes line.
- [x] 9. Commit: `feat: schemas, cost function, layout and exp check for the experiment framework (experiment framework)`.

### T2: Isolation and transcript spike
**Delivers:** verified CLI facts, scrubbed fixtures, `pricing.json` filled, per-arm toy costs | **Satisfies:** F4, F9, N1 | **Depends on:** - | **Wave:** 1

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/spike/run-spike.mjs` | throwaway script that runs the probes below and writes raw outputs to `workflow/experiments/local/spike/` |
| Create | `workflow/experiments/harness/isolation.md` | the verified flag set, init-record fields, expected-set derivation rule, reference cost field, transcript location, OpenTelemetry result, Windows launcher result, toy costs per arm |
| Create | `workflow/experiments/harness/fixtures/init-record.json` | scrubbed real init record |
| Create | `workflow/experiments/harness/fixtures/transcript-main.jsonl` | scrubbed real main transcript with duplicated message ids if the CLI produces them |
| Create | `workflow/experiments/harness/fixtures/transcript-subagent.jsonl` | scrubbed real subagent transcript |
| Create | `workflow/experiments/harness/fixtures/cli-result.json` | scrubbed real `--output-format json` result |
| Modify | `workflow/experiments/pricing.json` | models used by the three arms and the judge, five price fields, `source`, `checked` |

**Checklist**
- [x] 1. GATE: ask the operator for a spend limit for the spike (a few dollars at most) and confirm they are on the subscription login; do not start real calls before the yes.
- [x] 2. Write `run-spike.mjs` to run, from a throwaway clone of this repo: (a) a probe with `--setting-sources project --strict-mcp-config --output-format stream-json` and a one-line prompt; (b) the same with one `--plugin-dir`; (c) a resume of (a) by session id; (d) a prompt that launches one subagent; (e) one toy spec-and-plan run per arm flow (superpowers, lite, full) on a small request, recording each run's `total_cost_usd`; (f) the same flags with `claude_bin` pointing at an npm `.cmd` shim, if one exists, to see how Windows spawns it.
- [x] 3. GATE: run the spike (real model calls). Save raw outputs under `workflow/experiments/local/spike/` (ignored by git).
- [x] 4. Read the outputs and write `isolation.md`: which of the six sets (skills, plugins, agents, hooks, MCP servers, tools) the init record carries and how each is named; the derivation of expected sets from an arm; the reference cost field name and whether it sums across resumed invocations; where the main and subagent transcripts are and how subagents link to parents; whether duplicate message ids occur; whether OpenTelemetry can write a file in headless mode (set `CLAUDE_CODE_ENABLE_TELEMETRY` and the exporter variables, run, look); whether a `.cmd` launcher works without a shell.
- [x] 5. If any finding contradicts the spec (a missing set in the init record, no cost field, a flag that does not exist), stop: write a Deviation in the branch state, amend the spec with the operator (`writing-specs-lite` change control), then continue.
- [x] 6. Scrub the four fixtures (remove paths, user names, keys; keep structure and ids) and verify with `exp check --secrets`.
- [x] 7. Fill `pricing.json` from the current Anthropic pricing page for each model the arms and judge use; record `source` and `checked`; cross-check against the table in the ponytail plugin's `hooks/ponytail-band-import.js` and note any difference.
- [x] 8. Record in the branch state: findings note and the three toy costs. The ceiling rule used by T8 is this plan's own choice: run ceiling = 3 times the highest toy cost of any arm; batch ceiling = 5 times the run ceiling; the operator confirms both at the T9 gate, and any extra replicates need a new confirmation.
- [x] 9. Commit: `docs: isolation and transcript spike findings, fixtures and pricing (experiment framework)`.

### T3: Run launcher and driver
**Delivers:** `exp run` end to end against the fake CLI | **Satisfies:** F3, F4, F5, F6, F14, F15, F17, N2, N7, N8 | **Depends on:** T1, T2 | **Wave:** 2

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/clone.mjs` | local clone with `--no-hardlinks`, remote removed, empty hooks path, `.claude/` stripped and overlaid, instruction files kept |
| Create | `workflow/experiments/harness/spawn.mjs` | native executable resolution (refuse `.cmd`, `.bat`, `.ps1`), environment allowlist, argument-array launch with `--`, stdin prompts, process-tree kill; also the shared no-tools launch builder used by T4 and T6 |
| Create | `workflow/experiments/harness/isolation.mjs` | mandated flag list, probe, six-set comparison per `isolation.md` |
| Create | `workflow/experiments/harness/classify.mjs` | `classifyTurn(text)` returning `done`, `question` or `empty` |
| Create | `workflow/experiments/harness/state.mjs` | atomic writes with a fault-injection hook, `manifest.json`, `state.json`, hashes, approvals file |
| Create | `workflow/experiments/harness/containment.mjs` | hash recording and comparison of the F17 path set |
| Create | `workflow/experiments/harness/budget.mjs` | spend by cost class (uses `pricing.mjs`), per-invocation cap, ceilings, overshoot |
| Create | `workflow/experiments/harness/driver.mjs` | the run loop: probe, prompt, classify, answer hook, resume, parallelism, timeouts, abort reasons |
| Create | `workflow/experiments/harness/commands/run.mjs` | `run`, `run --continue`, `--dry`, `--rep`, `--yes <arm>=<hash>` |
| Create | `workflow/experiments/harness/fixtures/fake-claude.mjs` | replays a scripted conversation as the CLI would (init record, assistant messages, result JSON, budget stop, hang, crash); used by T4, T6 and T10 tests |
| Test | `workflow/experiments/harness/clone.test.mjs` | E29, E60 |
| Test | `workflow/experiments/harness/spawn.test.mjs` | E57, E61, N7 hostile argv |
| Test | `workflow/experiments/harness/isolation.test.mjs` | E24, E25, E58, E71 |
| Test | `workflow/experiments/harness/classify.test.mjs` | E14, E15 |
| Test | `workflow/experiments/harness/state.test.mjs` | E20, E21, E22, N2, N8 |
| Test | `workflow/experiments/harness/containment.test.mjs` | hash record and compare (unit part of E26, E27, E64) |
| Test | `workflow/experiments/harness/budget.test.mjs` | E53, E54, E55, E65, E66 |
| Test | `workflow/experiments/harness/driver.test.mjs` | E4, E11, E12, E13, E16, E17, E18, E19, E23, E26, E27, E28, E59, E64 |

**Checklist**
- [ ] 1. Write `fake-claude.mjs` first (test support): it reads a script file named by `FAKE_CLAUDE_SCRIPT` and emits stream-json shaped like the T2 fixtures. Write failing `classify.test.mjs` (the six fixtures: `done`, `marker-quoted-mid-text`, `question-then-marker-last-line`, `marker-then-question-last-line`, `question`, `blank`) and implement `classify.mjs`; expect PASS. Intended rule: last non-empty line trimmed equals `EXP-DONE` means done; whitespace-only means empty; anything else is a question.
- [ ] 2. Write failing `spawn.test.mjs`: environment keys equal the allowlist (`PATH`, `SystemRoot`, `USERPROFILE`/`HOME`, `TEMP`/`TMP`, `APPDATA`, `LOCALAPPDATA`, telemetry variables; the key only in API-key mode) and the deny flags for `WebFetch` and `WebSearch` are present (E57); `.cmd`, `.bat`, `.ps1` launchers exit 3 (E61); a session id, plugin path, model and run id containing `& | ^ " %` reach the child unchanged (N7). Implement `spawn.mjs`; expect PASS.
- [ ] 3. Write failing `clone.test.mjs` and `containment.test.mjs`: after preparation `git remote` is empty, `--no-hardlinks` was used, `.claude/` holds only the arm's skills and agents, `settings*.json` is gone (E60), two runs get different paths (E29); the F17 hash set is recorded and a change to the main `.git/config`, a temp-home `~/.claude/settings.json`, or a run's `state.json` is reported with its path. Implement `clone.mjs`, `containment.mjs`. Commit this slice: `feat: run clone preparation and containment hashes (experiment framework)`.
- [ ] 4. Write failing `isolation.test.mjs` with `fixtures/init-record.json`: an extra plugin gives `isolation_mismatch` before any task prompt (E24); a hook event naming a hook that no arm plugin declares for SessionStart aborts `isolation_mismatch` before any task prompt (E71); a record lacking one of its five sets, or a `claude_code_version` unlike the fixture's, stops the run and names the gap (E25); a resumed launch carries the same isolation flags as the first (E58). Implement `isolation.mjs` following `isolation.md`; expect PASS.
- [x] 5. Write failing `state.test.mjs` and `budget.test.mjs`: a kill during a `state.json` write leaves the previous file (fault-injection hook) (E21, N8); `--continue` reloads spend and session id and sends `Continue from where you stopped.` when `turn_state` is `in_turn` (E20); `--continue` on a terminal run exits 2 (E22); the manifest holds every hash of N2; the CLI budget-stop result maps to `budget` (E65); `--max-budget-usd` equals ceiling minus spend; run and batch ceilings, mixed exit codes and `not_started: batch_ceiling` (E53, E54, E55, E66). Implement `state.mjs`, `budget.mjs`; expect PASS. Commit this slice: `feat: run state, manifest and budget enforcement (experiment framework)`.
- [ ] 6. Write failing `driver.test.mjs` using `fake-claude.mjs`: experiment file untracked, staged only, or modified exits 7 (E12); stage `implementation` exits 8 before any clone (E11); clone path over 200 characters exits 3 (E13); two empty replies abort `turn_cap` (E16); the 41st question aborts `turn_cap` (E17); an error stop aborts `crash` (E18); a hanging turn is killed at `turn_timeout_s` and a run past `run_timeout_s` aborts `timeout`, with no orphan process (E19); `--rep 2` for an existing run exits 2 and a command without `--rep` creates the next free rep or exits 0 with a note (E23); `max_parallel` 2 never has three runs active; the child environment lacks the key outside API-key mode (E28); `--continue` after the arm file, a plugin file or `config.json` changed exits 7, and a session id of `--dangerously-skip-permissions` exits 3 (E59); an unseen approval hash exits 2 until `--yes <arm>=<hash>` (E4); a fake agent appending to the main `.git/config`, writing a temp-home `~/.claude/settings.json`, or changing the run's `state.json` mid-turn ends `aborted`, reason `containment`, exit 10, path named, and every run with a turn in flight aborts (E26, E27, E64). Run `<TEST driver>`; expect FAIL because `driver.mjs` does not exist.
- [x] 7. Implement `driver.mjs` slice one: preflight (F15 check, approvals, stage and path checks), clone, probe, prompt with the appended `EXP-DONE` block, classify loop, question hook (a function T4 plugs the answerer into), abort reasons `isolation_mismatch`, `turn_cap`, `crash`, `budget`. Commit: `feat: run driver loop (experiment framework)`.
- [ ] 8. Implement `driver.mjs` slice two and `commands/run.mjs`: `max_parallel` scheduling, `turn_timeout_s` and `run_timeout_s` with process-tree kill, containment checks at each turn boundary, `--continue`, `--rep` rules, `--dry`. Run `<TEST driver>`; expect PASS. Commit: `feat: parallel runs, timeouts and containment aborts (experiment framework)`.
- [ ] 9. `<BUILD>` green; `node workflow/experiments/harness/exp.mjs run --dry` on a temp experiment prints planned run ids; update branch state: Progress, Changes line, Deviations if T2 changed a contract.

### T5: Extractor
**Delivers:** `exp extract` and the metrics | **Satisfies:** F9, F10, N1, N5, N6, N8 | **Depends on:** T1, T2 | **Wave:** 2

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/extract.mjs` | copy and hash transcripts, one event per distinct message id, subagent linking, `events.csv`, `usage.json` (cost through T1's `pricing.mjs`) |
| Create | `workflow/experiments/harness/phases.mjs` | phase precedence |
| Create | `workflow/experiments/harness/metrics.mjs` | `wall_s`, `wait_s`, `answerer_s`, `agent_s`, `peak_prompt_tok`, `cache_read_share`, `total_tok`, `review_rounds`, `fix_iterations`, five cost classes |
| Create | `workflow/experiments/harness/commands/extract.mjs` | `extract <run-id>`; statuses `done`, `aborted`, `extracted` allowed, `running` exits 2 |
| Test | `workflow/experiments/harness/extract.test.mjs` | E39, E40, E41, E42, E69, N1, N8 |
| Test | `workflow/experiments/harness/phases.test.mjs` | E43 |
| Test | `workflow/experiments/harness/metrics.test.mjs` | E63, N5, N6 |

**Checklist**
- [ ] 1. Write failing `extract.test.mjs` on the T2 fixtures plus synthetic variants: repeated message ids give one row, last usage kept (E39); a subagent file and two parallel subagents carry agent and parent ids and totals equal the independent fixture count (E40); a truncated last line sets `truncated` (E41); three events under a stub `pricing.json` give hand-computed event costs and a run total rounded once (E69); a priced-model difference over 2 percent against `cli-result.json` is printed (E42); running extract twice gives byte-identical files (N8). Run `<TEST extract>`; expect FAIL.
- [ ] 2. Implement `extract.mjs`; expect PASS.
- [ ] 3. Write failing `phases.test.mjs`: a skill sets the phase until the next skill; a subagent type's mapping wins inside a subagent; nested subagents inherit the parent; unmatched is `other`; a map entry for a skill that never fires is not an error (E43). Implement `phases.mjs`; expect PASS.
- [ ] 4. Write failing `metrics.test.mjs`: timeline with a 100 s run, 30 s wait and a 4 s answerer call ending exactly when the wait starts gives `wall_s` 100, `wait_s` 30, `answerer_s` 4, `agent_s` 66 (E63); rounding once per term; five cost classes stay separate and arm cost excludes the other four (N6); `peak_prompt_tok` and `cache_read_share` formulas from spec `runtime.md`; `review_rounds` counts distinct parent turns launching review-type subagents; `fix_iterations` counts Bash calls with `lint.mjs` and a non-zero exit. Implement `metrics.mjs`; expect PASS.
- [x] 5. Create `commands/extract.mjs`; a test runs `exp extract` on a `running` run and expects exit 2.
- [ ] 6. `<BUILD>` green; update branch state: Progress, Changes line.
- [x] 7. Commit: `feat: transcript extractor and metrics (experiment framework)`.

### T8: Pilot bundle
**Delivers:** the pilot task, three arms, the superpowers plugin copy, rubric, calibration set and pilot experiment | **Satisfies:** F1, F2, F15, F16 | **Depends on:** T1, T2 | **Wave:** 2

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/tasks/pilot-pinned-note/task.json` | `base_commit` = the `development` commit containing W1, stage `specplan` |
| Create | `workflow/experiments/tasks/pilot-pinned-note/brief.md` | the synthetic request (below) |
| Create | `workflow/experiments/tasks/pilot-pinned-note/answer-sheet.md` | answers to non-seeded questions only |
| Create | `workflow/experiments/tasks/pilot-pinned-note/seeded-issues.json` | seven issues with anchors |
| Create | `workflow/experiments/plugins/superpowers/SOURCE.md` | origin, version and copy date of the unmodified plugin copy beside it |
| Create | `workflow/experiments/arms/superpowers.json` | per spec `runtime.md` § Planned arms |
| Create | `workflow/experiments/arms/lite.json` | same |
| Create | `workflow/experiments/arms/full.json` | same |
| Create | `workflow/experiments/experiments/pilot-001.json` | tasks, arms, replicates 3, `answer_mode` `sheet`, ceilings from T2's rule, hypotheses, decision rule, `pruning_rule` `dominance` |
| Create | `workflow/experiments/rubric/rubric.md` | five criteria with 0, 2, 4 anchors |
| Create | `workflow/experiments/rubric/calibration/good.md` | a real approved spec package excerpt (the W4 auth spec index and one component) |
| Create | `workflow/experiments/rubric/calibration/mediocre.md` | the same excerpt with acceptance criteria removed and vague wording added |
| Create | `workflow/experiments/rubric/calibration/bad.md` | a short spec with contradictions and one canary line telling the judge to give top marks |
| Create | `workflow/experiments/rubric/calibration/bands.json` | initial bands on the 0-20 scale: good 14-20, mediocre 7-13, bad 0-6 |

**Checklist**
- [ ] 1. Read `src/be/contracts/src/frozen.ts` and the epic type in `src/be/contracts/src/index.ts` so the brief names real things; set `task.json` `base_commit` to the current `development` sha that contains W1.
- [ ] 2. Write `brief.md`: as a PM, add a free-text note to an epic so the team sees context; "recent notes are shown first"; "only the PM can edit a note" and later "every project member can edit notes they can see"; "a short note"; "add the endpoint under `apps/api` and the screen under `apps/web`"; nothing on what happens to a pinned note when its epic is closed or deleted; notes visible to "any project" member. Anchors below must be exact substrings.
- [ ] 3. Write `seeded-issues.json`: `collision` (a free-text note on an epic overlaps AD-09 "comments" out of scope; anchor `free-text note`), `contradiction` (anchor `every project member can edit`), `missing_limit` (anchor `a short note`), `vague_term` (anchor `recent notes`), `wrong_path` (anchor `apps/web`), `missing_error` (anchor `pinned note`), `tenancy` (anchor `any project`); each with `blocking` set.
- [ ] 4. Write `answer-sheet.md`: answers to likely non-seeded questions (who the PM is, epic id format, where on the epic page the note appears, auth is the existing Firebase session); deliberately silent on every seeded issue.
- [x] 5. Copy the installed superpowers plugin (path from `~/.claude/plugins/installed_plugins.json`) unmodified into `workflow/experiments/plugins/superpowers/`, with its licence, and write `SOURCE.md`; run `exp check --secrets` on it. The copy is never edited: its contents feed the arm's approval hash.
- [ ] 6. Write the three arm files from spec `runtime.md` § Planned arms, each with `stage`, `prompt` (a template using `{{brief}}` and `{{task_id}}` that names the skills for that arm, as `AGENTS.md` § 3 allows), `plugins` (`superpowers` only for that arm), `skills`, `agents`, `allowed_tools`, `disallowed_tools` `["WebFetch","WebSearch"]`, `permission_mode`, `model` (the `main` model from `models.json` tier `strong`), `review`, `phase_map`, `instruction_files`, `artifact_globs`, `lint` (false for `superpowers`).
- [x] 7. Write `rubric.md`. Intended criteria and anchors (0 = absent, 2 = partial, 4 = full): completeness (problem, goals, non-goals, components all present); testability (every requirement has an observable acceptance criterion); unambiguity (no vague terms, no choice left to the implementer); consistency (no contradiction between files, no collision with recorded decisions or guardrails); traceability (requirements map to edge cases and tasks, paths are real). Write the three calibration artifacts and `bands.json`.
- [ ] 8. Write `pilot-001.json` with `run_ceiling_usd` and `batch_ceiling_usd` from the rule recorded by T2 (3 times the highest toy cost; 5 times the run ceiling); hypotheses as one sentence each (for example "`full` finds more seeded issues than `lite` at higher cost"); `decision_rule` text; `pruning_rule` `dominance`.
- [ ] 9. Run `node workflow/experiments/harness/exp.mjs check --secrets`; expect exit 0 with F16 satisfied (7 issues, all six required categories, anchors found); update branch state: Progress, Changes line.
- [ ] 10. Commit the bundle: `feat: pilot task, arms, plugin copy, rubric and experiment file (experiment framework)`.

### T4: Sheet answerer
**Delivers:** sheet-mode answers, the question log and the answerer self-test | **Satisfies:** F7, F11, N4 | **Depends on:** T3 | **Wave:** 3

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/sanitize.mjs` | control-character stripping, 2000-character cap, path replacement, credential redaction |
| Create | `workflow/experiments/harness/answerer.mjs` | sheet-mode answerer: T3's no-tools launch builder, nonce delimiters, `{covered, answer}` JSON, fixed text on `covered: false` |
| Create | `workflow/experiments/harness/questions.mjs` | append to `questions.jsonl` with source and note fields; `setIssueIds(runDir, mapping)` used by T6 |
| Create | `workflow/experiments/harness/commands/answerer.mjs` | `answerer --self-test`: runs the fixtures against the real model and checks 3 of 3 silent and at least 2 of 3 covered |
| Create | `workflow/experiments/harness/fixtures/answerer-fixtures.json` | 3 covered and 3 silent questions with a small sheet for E32 |
| Modify | `workflow/experiments/harness/driver.mjs` | plug the answerer into the question hook; count answerer time and cost classes |
| Test | `workflow/experiments/harness/sanitize.test.mjs` | E36 |
| Test | `workflow/experiments/harness/answerer.test.mjs` | E30, E31, E62, N4 |
| Test | `workflow/experiments/harness/questions.test.mjs` | F11 row shape, `setIssueIds` |

**Checklist**
- [ ] 1. Write failing `sanitize.test.mjs`: ANSI escapes and control characters removed, text capped at 2000 characters, `S:\repo\a.txt`, `\\host\share\x` and `/home/u/proj/f` become `<path>`, a key becomes `[REDACTED:type]` (E36). Implement `sanitize.mjs`; expect PASS.
- [ ] 2. Write failing `answerer.test.mjs` with the fake CLI: a silent question gets the exact fixed text and source `assumption` (E30); non-JSON output retries once, then sends the fixed text and logs `answerer_error` (E31); the launch flags are no tools, neutral temp cwd, no session persistence, no user settings, strict MCP, no plugins, and a probe shows empty tool, hook and MCP sets (E62); the prompt contains the question and the sheet only, no repo path, key or arm id (N4). Run `<TEST answerer>`; expect FAIL.
- [ ] 3. Implement `answerer.mjs` (random nonce per call, removed from inputs; JSON output validated) and `questions.mjs`; expect PASS.
- [ ] 4. Plug the answerer into `driver.mjs` for `sheet` mode; add a driver test where the fake CLI asks two questions (one covered, one not) and the run reaches done with both stored.
- [x] 5. Write `questions.test.mjs`: each stored question has one source and, before grading, null `issue_id` and `issue_alt`; `setIssueIds` fills them and rejects an unknown issue id.
- [ ] 6. Write `commands/answerer.mjs` and `answerer-fixtures.json`; a unit test with the fake CLI checks the pass rule (all silent, at least 2 of 3 covered). It runs for real in T9.
- [x] 7. `<BUILD>` green.
- [ ] 8. Update branch state: Progress, Changes line.
- [ ] 9. Commit: `feat: sheet-mode answerer, question log and self-test (experiment framework)`.

### T6: Grader
**Delivers:** `exp grade` and the judge self-test | **Satisfies:** F11, F12, N3, N4 | **Depends on:** T3, T4, T5 | **Wave:** 4

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/artifacts.mjs` | find spec and plan by `artifact_globs` among files changed since `base_commit`; copy to `artifacts/` |
| Create | `workflow/experiments/harness/lintrun.mjs` | run the main checkout's `lint.mjs spec` and `plan` over artifact copies; count `ERROR` lines |
| Create | `workflow/experiments/harness/judge.mjs` | T3's no-tools launch builder, nonce delimiters, rubric call (two per artifact, criteria order shuffled), seeded-issue call, range-checked JSON |
| Create | `workflow/experiments/harness/grade.mjs` | combine lint, issues, rubric, review rounds, fix iterations; write `grades.json`; set `complete` |
| Create | `workflow/experiments/harness/commands/grade.mjs` | `grade <run-id>` and `grade --self-test` |
| Create | `workflow/experiments/harness/fixtures/judge-script.json` | scripted judge replies for the fake CLI |
| Test | `workflow/experiments/harness/judge.test.mjs` | E44, E45, E46 (unit part), N4 |
| Test | `workflow/experiments/harness/grade.test.mjs` | E38, E47, E48, E67, E68 |

**Checklist**
- [ ] 1. Write failing `grade.test.mjs`: `exp grade` on an `aborted` or non-extracted run exits 2 (E48); an arm with `lint` false leaves lint fields empty and flagged (E67); artifacts are found by globs and none found sets `missing_artifact` with null rubric (E68); a credential pattern in an artifact is redacted in the copy sent to the judge and sets `secret_in_artifact` (E47); a question matching two seeded issues stores the closer in `issue_id` and the other in `issue_alt` through T4's `setIssueIds` (E38). Run `<TEST grade>`; expect FAIL.
- [ ] 2. Write failing `judge.test.mjs`: non-rubric text twice gives `judge_error`, null rubric, exit 6 (E44); two scores differing by more than 4 set `judge_unstable` (E45); an artifact containing the nonce has it removed, and an artifact telling the judge to give top marks is delimited as data (E46 unit part); the launch flags equal the answerer's because both use T3's builder (N4); `judge_same_model` is set when models match.
- [ ] 3. Implement `artifacts.mjs` and `lintrun.mjs` (lint code always from the main checkout, never from the run clone).
- [ ] 4. Implement `judge.mjs` (two calls per artifact, criteria order shuffled by a seeded shuffle recorded in `grades.json`; mean and gap; seeded-issue call returning an outcome per issue and `issue_id` or `issue_alt` per question).
- [x] 5. Implement `grade.mjs` and `commands/grade.mjs`; run `<TEST judge>` and `<TEST grade>`; expect PASS.
- [ ] 6. Add `grade --self-test`, which scores the three calibration artifacts and checks order and bands; unit-test it with the fake CLI (it runs for real in T9).
- [x] 7. `<BUILD>` green.
- [ ] 8. Update branch state: Progress, Changes line.
- [ ] 9. Commit: `feat: grader with judge and self-test (experiment framework)`.

### T10: Bank and queue
**Delivers:** `bank` answer mode with pause and resume | **Satisfies:** F8, F11, N4 | **Depends on:** T4 | **Wave:** 4

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/bank.mjs` | bank entries, normalised exact match (case-fold, strip punctuation, drop `a`, `an`, `the`, collapse whitespace), `supersedes` |
| Create | `workflow/experiments/harness/queue.mjs` | queue items in `local/queue/`, suggestion call, polling, `arm_codes` |
| Create | `workflow/experiments/harness/commands/queue.mjs` | `queue [--experiment E] [--audit]` |
| Create | `workflow/experiments/harness/commands/answer.mjs` | `answer <question-id> (<text> \| --file \| --stdin \| --same-as <bank-id>)` |
| Modify | `workflow/experiments/harness/answerer.mjs` | add `bank` mode beside `sheet` |
| Modify | `workflow/experiments/harness/driver.mjs` | `waiting_operator`, `wait_timeout_s`, resume by session id |
| Test | `workflow/experiments/harness/bank.test.mjs` | E33, E37 |
| Test | `workflow/experiments/harness/queue.test.mjs` | E34, E35, E70 |

**Checklist**
- [ ] 1. Write failing `bank.test.mjs`: the pair table of E33 (`Max length of note?` and `max length of the note` match; `Can the PM edit?` and `Can the Dev Lead edit?` do not; `Is the note required?` and `Is the note not required?` do not; the two rewordings about epic removal do not match and a suggestion is shown); `exp answer` with empty text, 4001 characters or an unknown id exits 2 and stores nothing (E37). Expect FAIL; implement `bank.mjs`; expect PASS.
- [ ] 2. Write failing `queue.test.mjs` with two fake runs: the same question at once creates one item linked to both and one answer resumes both (E34); an answer for an aborted run is stored without a resume, exit 0 (E35); `--same-as <bank-id>` sets the item's `bank_id` and both runs resume (E70); a suggestion is never applied without `--same-as`; `exp queue` shows run codes, not arm ids.
- [ ] 3. Implement `queue.mjs` (polling every 5 seconds, resume only when `bank_id` is set); expect PASS.
- [ ] 4. Add `bank` mode to `answerer.mjs` and the pause and resume path to `driver.mjs`; add a driver test where a bank miss pauses the run, `exp answer` resumes it, and waiting time is excluded from `agent_s`.
- [x] 5. Write `commands/queue.mjs` and `commands/answer.mjs`; `--audit` lists automatic matches with both texts.
- [ ] 6. `<BUILD>` green.
- [x] 7. Update branch state: Progress, Changes line.
- [ ] 8. Commit: `feat: answer bank, queue and pause-resume (experiment framework)`.

### T7: Report
**Delivers:** `exp report` | **Satisfies:** F13, N3 | **Depends on:** T5, T6 | **Wave:** 5

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/stats.mjs` | medians, min and max, geometric mean with exclusions, pair verdicts |
| Create | `workflow/experiments/harness/report.mjs` | write `runs.csv`, `events.csv`, `medians.csv` through temp files and rename; secret scan before rename |
| Create | `workflow/experiments/harness/commands/report.mjs` | `report <experiment-id>` |
| Test | `workflow/experiments/harness/stats.test.mjs` | E49, E50 |
| Test | `workflow/experiments/harness/report.test.mjs` | E51, E52, columns of data-model.md |

**Checklist**
- [ ] 1. Write failing `stats.test.mjs`: worked table 1 gives geometric means 4.00 and 4.00; worked table 2 gives `dominated(X by Y)`, `dominated(X by Z)`, Z vs Y `inconclusive`, and every pair with W `inconclusive` (E49); one replicate, one task or a zero median set `n=1`, `single_task`, `gm_excluded` and print `inconclusive` (E50). Run `<TEST stats>`; expect FAIL.
- [ ] 2. Implement `stats.mjs`; expect PASS.
- [ ] 3. Write failing `report.test.mjs`: the three CSVs have exactly the columns in spec `data-model.md` § Reports; a run without grades is listed and skipped for quality columns (E52); a credential pattern in any output exits 9 and nothing is renamed, with a git sha and a base64 header not matching (E51); aborted runs count in cost medians and `n_aborted` only.
- [ ] 4. Implement `report.mjs` and `commands/report.mjs`; expect PASS.
- [x] 5. `<BUILD>` green.
- [ ] 6. Update branch state: Progress, Changes line.
- [x] 7. Commit: `feat: report with medians, geometric means and verdicts (experiment framework)`.

### T9: Pilot run and review
**Delivers:** the pilot dataset and the operator's arm decision | **Satisfies:** N1, N5, F12 | **Depends on:** T3, T4, T6, T7, T8 | **Wave:** 6

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `docs/telemetry/experiments/runs.csv` | generated by `exp report pilot-001` |
| Create | `docs/telemetry/experiments/events.csv` | generated |
| Create | `docs/telemetry/experiments/medians.csv` | generated |
| Modify | `workflow/project-state/branch-states/w7-pm-plan-flow.md` | pilot findings, verdicts and the arms chosen for the real W7 run |

**Checklist**
- [ ] 1. `<BUILD>` green; `exp check --secrets` exits 0; `exp run pilot-001 --dry` lists 9 run ids.
- [ ] 2. GATE: ask the operator to confirm the ceilings in `pilot-001.json` (computed from the T2 toy costs) and that they are available while the batch runs; do not start real calls before the yes.
- [ ] 3. GATE: run `exp grade --self-test` and `exp answerer --self-test` against the real model (real calls); require the order good over mediocre over bad, scores inside `bands.json`, the canary keeping its band, 3 of 3 silent and at least 2 of 3 covered answers (E32, E46); if a band is wrong, change `bands.json` once, record why in the branch state and rerun.
- [ ] 4. GATE: run `exp run pilot-001` (9 real runs, three arms by three replicates). Do not edit files under `workflow/experiments/` during the batch.
- [x] 5. Run `exp grade` for every run that ended `done` (extraction runs automatically at the end of `exp run`); compare each run's extracted cost with the CLI total (E42, N1).
- [ ] 6. Check the T9 pass criteria in spec `implementation-order.md`: at least 7 of 9 `complete`; at least 6 of 9 with a CLI reference total and all within 2 percent; no `judge_error`; coefficient of variation of `arm_cost_usd` per arm; GATE: add 2 replicates (cap 5) for any arm above 0.5 only after the operator confirms the extra spend.
- [x] 7. Run `exp report pilot-001`; cross-check total cost against the ponytail board's CSV for the same days and note any difference.
- [ ] 8. Record the verdicts and findings in the branch state; GATE: ask the operator which arms run on W7 (top two if time is short). Do not choose for them.
- [ ] 9. Commit the CSVs and the branch state: `docs: pilot results for the experiment framework (experiment framework)`.

### Close-out
- [ ] Every Traceability row verified; `<BUILD>` green on Windows 11; `exp check --secrets` exits 0.
- [ ] Spec index status and this plan's Task order reflect reality; amendments (including any from T2) recorded in the branch state.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines complete; the containment Known Gap and the harness layout Convention written; Handover items added: the owner assigns a permanent workstream id (commit trailers use it), the real W7 comparison needs its own spec and plan, a Codex driver with a provider seam and the implementation-stage runner are later phases, W17 consumes `docs/telemetry/experiments/`.
- [ ] `guide out of date: no developer-guide section covers process tooling` noted in the branch state.
- [ ] GATE: ask the operator to review the branch (`AGENTS.md` § 8, gate 3); write `Approved` only on their yes; nothing is pushed and no pull request is opened before it.
