# Experiment Implementation Stage Implementation Plan

- **Status:** Approved (Xiao-Congchen, 2026-11-05)

> **For agents:** tick `- [ ]` -> `- [x]` as you finish each step, in this file, in the same commit as the work. Keep the branch state's Progress cell current. Spec: [experiment implementation stage design](../specs/2026-11-05-experiment-implementation-stage-design.md).

## Scope
**Goal:** the harness builds finished plans with a cheaper model in history-free clones, checks every attempt in a harness-owned verify tree, and reports pass@1, pass@2 and cost to green per plan.
**In scope:** F1-F15, N1-N4, edge cases E1-E104 (spec `requirements.md`, `edge-cases.md`), decisions SD1-SD13.
**Non-goals:** a Codex driver or any other provider; a real W7 comparison; statistical verdicts or a ranking; a sandbox, container or network block; fixing the specplan question-classifier overcount (a handover item in the branch state); the framework's spec-and-plan path stays unchanged (its tests must stay green).
**Risk tier:** Medium with the Attacker lens. Verification: every module is test-first against the fake CLI (`harness/fixtures/fake-claude.mjs`) and a toy implementation task, so no test spends money; real model calls happen only in T1 and T8 and start with `GATE:`; the filesystem, lockfile, process and verdict rules each have a test in T4, T5 or T6.

**Commands used below.** `<TEST x>` = `node --test "workflow/experiments/harness/x.test.mjs"`. `<BUILD>` = `node --test "workflow/experiments/**/*.test.mjs"` (the `experiments` entry of `workflow/config.json` `test_commands`); the full run takes about ten minutes on this machine, so run it in the background. `<LINT plan>` = `node .claude/skills/writing-specs-lite/scripts/lint.mjs plan workflow/plans/2026-11-05-experiment-implementation-stage.md`. All paths are under the repository root; `harness/` means `workflow/experiments/harness/`. `exp.mjs` loads every `commands/*.mjs` by file name, so no task edits it.

## Task order
<!-- Status: Not started / In progress / Done / Blocked / Post-merge (a human step after the merge) -->
| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 Feasibility spike | - | - | 1 | Done |
| T2 Schema, validation and testkit | T1 | - | 2 | Done |
| T3 `exp snapshot` | T2 | T4, T5 | 3 | Done |
| T4 Check runner and `exp baseline` | T2 | T3, T5 | 3 | Done |
| T5 Shared checks and adapters | T2 | T3, T4 | 3 | Done |
| T6 Implementation driver | T3, T4, T5 | - | 4 | Done |
| T7 Code review and `exp grade` | T6 | - | 5 | Done |
| T8 Report and pilot run | T7 | - | 6 | Not started |

Executor note: run inline, task by task in table order. T3, T4 and T5 share no files, so wave 3 may be split across subagents, one per task. The spec's `implementation-order.md` lists E93 to E104 under no task; this plan assigns them (E93 to T2; E94 to E98, E103, E104 to T4; E99 to E102 to T6) and the close-out records that in the branch state. Two other departures from the spec's file hazards are recorded the same way: T4 edits `clone.mjs` (`historyFreeTree`) and T6 edits it again (`prepareImplClone`), and review spend uses the existing `judge` cost class.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T3 | `snapshot.test.mjs` (kinds, hashes, path refusals, scan, exit codes) |
| F2 | T2, T5 | `schema.test.mjs`, `check.test.mjs` (task validation); `exp check` on `pilot-pinned-note-impl` |
| F3 | T2, T6 | `schema.test.mjs` (experiment validator); `impldriver.test.mjs` (hash and baseline preflight) |
| F4 | T4 | `implbaseline.test.mjs` (two runs, flaky, exit 3 cases) |
| F5 | T1, T6 | T1 findings; `impldriver.test.mjs` (history-free clone, plan commit, setup) |
| F6 | T4, T6 | `impldriver.test.mjs` (sweep, outside-clone flag, canary, disk poll); T1 findings |
| F7 | T6 | `impldriver.test.mjs` (question policy, notes, `turn_cap`) |
| F8 | T4 | `safefs.test.mjs`, `implchecks.test.mjs` (verify tree, lockfile validation, order, sweep) |
| F9 | T5 | `implacceptance.test.mjs` (parent and host through IPC, toy adapter) |
| F10 | T4 | `implchecks.test.mjs` (green rule rows) |
| F11 | T6 | `impldriver.test.mjs` (attempt 2, restore, `--continue`) |
| F12 | T4 | `implchecks.test.mjs` (adherence metrics) |
| F13 | T7 | `implreview.test.mjs`, `grade.test.mjs` |
| F14 | T6, T7, T8 | `impldriver.test.mjs` (cost classes); `implreport.test.mjs` (formulas, CSV, guard) |
| F15 | T4, T6 | `implchecks.test.mjs` (output caps); `impldriver.test.mjs` (disk poll) |
| N1 | T1, T6, T8 | `impldriver.test.mjs` (summed final totals); T8 compares real runs |
| N2 | T7 | `grade.test.mjs` (twice, clone deleted) |
| N3 | T1, T4 | `implchecks.test.mjs` (environment allowlist, `node` argv, no shell); T1 records the final list |
| N4 | T8 | `implreport.test.mjs` (`underpowered`, no verdict) |
| E1, E2, E3, E4, E5, E6, E7 | T3 | `snapshot.test.mjs` (one test per row) |
| E8, E9, E10, E13, E93 | T2 | `schema.test.mjs`, `check.test.mjs` (one test per row) |
| E14, E15, E16, E17, E18 | T4 | `implbaseline.test.mjs` (E17 through `baselineProblem`) |
| E11, E12 | T6 | `impldriver.test.mjs` (exit 7 before any call) |
| E19, E20, E21, E22, E23, E24 | T6 | `impldriver.test.mjs` |
| E25, E26, E27, E28, E29, E30 | T6 | `impldriver.test.mjs` (questions, empties, notes parsing) |
| E31, E32, E34, E35, E36, E37, E39, E40 | T4 | `implchecks.test.mjs`, `safefs.test.mjs` |
| E33 | T4, T6 | `implchecks.test.mjs` (tree deleted); `impldriver.test.mjs` (`--continue` after a kill in `checking`) |
| E38, E101 | T6 | `impldriver.test.mjs` (clone-size and free-disk poll) |
| E41, E42, E43, E44, E45, E46, E47, E48 | T4 | `implchecks.test.mjs` (one test per row; E47 detection in T4, restore in T6) |
| E49, E50, E51, E52, E53 | T6 | `impldriver.test.mjs` |
| E54, E55, E56, E58, E59, E60, E61 | T5 | `implacceptance.test.mjs` |
| E57 | T4 | `implchecks.test.mjs` (diff grep sets `result_tampering_suspected`) |
| E62, E63, E64 | T4 | `implchecks.test.mjs` |
| E65, E66, E67, E68, E69, E70 | T7 | `implreview.test.mjs` |
| E71, E72, E73, E74 | T6 | `impldriver.test.mjs`, `implcost.test.mjs` (ceilings, summed totals, attempt attribution) |
| E75, E76, E77, E78, E79, E80 | T8 | `implreport.test.mjs` |
| E81, E82 | T7 | `grade.test.mjs` |
| E83, E84, E85, E86, E87, E88, E89, E90, E91, E92 | T4, T5, T6 | rows above; E90 and E91 are recorded Known Gaps, reviewed at the T8 gate |
| E94, E95, E96, E97, E98, E103, E104 | T4 | `safefs.test.mjs`, `implchecks.test.mjs` |
| E99, E100, E102 | T6 | `impldriver.test.mjs` (canary, `claude`/`curl` calls, link at restore) |

## Verification gates
- Per task: `<TEST x>` for the touched module, plus every older test file the task edits (for `driver.test.mjs` run only the tests whose names the step lists, with `--test-name-pattern`).
- Before finishing: `<BUILD>` green on Windows (background run); `exp check --secrets` clean; each F/N acceptance criterion has a passing test or a recorded manual check; the real batch of T8 recorded.

---

### T1: Feasibility spike
**Delivers:** Windows facts the design relies on, the implementer model's prices, and a toy cost | **Satisfies:** F5, F6, N1, N3 | **Depends on:** - | **Wave:** 1

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/spike/impl-spike.mjs` | throwaway script that runs steps 2 to 5 and prints JSON findings |
| Modify | `workflow/experiments/harness/isolation.md` | new section "Implementation stage findings": variable list, timings, sweep behaviour, loader |
| Check | `workflow/experiments/pricing.json` | the `claude-sonnet-5-5` entry equals the operator's prices (amended per C~6: no new entry; `checked` date refreshed if the operator confirms) |

**Checklist**
- [x] 1. GATE (answered 2026-11-05, C~6): the implementer is `claude-sonnet-5-5` at `low` effort; the operator gave prices equal to the existing `pricing.json` entry (input 2, output 10, cache read 0.1, cache write 5m 2.5, 1h 4 per Mtok) and an overall soft cap of $40 that must not interrupt a running build. The spike limit is 3 USD. Record this in the branch state. State at this gate that the spike's build runs a real agent with Bash in a throwaway tree under the same flags as the harness.
- [x] 2. Write `impl-spike.mjs`. It builds a history-free tree of the pilot base commit (`git archive 160053ce006b6a54bc85d87f9cf380242fdef95a`, then `git init` and one commit) and asserts `git log --all` shows one commit and no other ref.
- [x] 3. In that tree run `npm ci --ignore-scripts`, `node node_modules/typescript/bin/tsc -b` and `node --import tsx --test --test-reporter=tap <one existing test file>` with only `PATH`, `PATHEXT`, `ComSpec`, `SystemRoot`, `TEMP`, `TMP`, `HOME`, `USERPROFILE`, `APPDATA`, `npm_config_cache` set. Record which variables were needed (add any missing one and re-run), the TAP line format, whether `tsx` resolves from the tree, and the seconds for setup, typecheck, one test file and a recursive copy of `node_modules`.
- [x] 4. Start a detached grandchild through an intermediate process that exits, then call `killTree` on the parent: record whether it survives. Then find it by a PowerShell `Get-CimInstance Win32_Process` filter on command line and working directory and kill it: record the command that works.
- [x] 5. Run one real toy build with `claudeArgs` from `spawn.mjs` (so `--setting-sources project`, `--strict-mcp-config`, the tool allowlist and the denied tools apply), `--model claude-sonnet-5-5`, `--effort low` (appended by the spike script, since `claudeArgs` gains the option only in T2) and `--max-budget-usd 3`, in a throwaway history-free tree, and record the cost from `total_cost_usd`, and that the token-based cost computed from `pricing.json` is within 2% of it.
- [x] 6. Write the findings (final variable list, TAP format, timings, sweep command, junction behaviour of `fs.lstat` on this machine, the toy cost) into `isolation.md`; check that `pricing.json` carries the confirmed entry.
- [x] 7. Update branch state: Progress, a Changes line with the findings and the cost.
- [x] 8. Commit: `chore: implementation stage feasibility findings and implementer prices (experiment framework)` with `Task: T1`.

### T2: Schema, validation and testkit
**Delivers:** validators for the implementation task, arm and experiment; toy implementation fixtures; the stage switch | **Satisfies:** F2, F3, E8, E9, E10, E13, E93 | **Depends on:** T1 | **Wave:** 2

**Files**
| Action | Path | What changes |
|---|---|---|
| Modify | `workflow/experiments/harness/schema.mjs` (`validateArm`, `validateTask`, `validateExperiment`, `STAGES`) | when `stage` is `implementation`: the arm's prompt allows only `{{plan_path}}`, `{{spec_paths}}`, `{{task_id}}`; the task has the F2 fields (`setup_command`, `checks.typecheck` and `lint` as arrays of `{argv, cwd, timeout_s}` or null, `checks.tests`, `checks.shared`, `protected_globs`, `acceptance`) and every `argv` is a string array whose first element is `node` (or the fixed `npm ci` for `setup_command`; the optional `post_setup` also starts with `node`); the experiment is checked by a second function `validateImplExperiment` (data-model.md fields, defaults and ranges) |
| Modify | `workflow/experiments/harness/check.mjs` (`runCheck`, the task loop near lines 104 to 128 and the experiment loop near lines 142 to 151) | the `pilot-` rule (seeded-issues file, 6 issues, required categories) applies to `specplan` tasks only; an experiment file picks `validateImplExperiment` only when `stage` is `implementation` (absent means `specplan`, so `experiments/pilot-001.json` is unchanged); for implementation experiments it checks that `task_id` and `implementer_arm_id` exist and that both stages equal `implementation`, that adapter, `checks.json` and snapshot paths exist, and that the implementer and review models have a price (E13) |
| Modify | `workflow/experiments/harness/spawn.mjs` (`claudeArgs`), `workflow/experiments/harness/spawn.test.mjs` | optional `effort` (`low`, `medium`, `high`; anything else is a `ConfigError`) appended as `--effort <value>`; the driver passes `arm.effort`; absent means no flag, so specplan launches are unchanged (test: args identical without it) |
| Modify | `workflow/experiments/harness/testkit.mjs` | `makeImplRepo()`: a toy repo with a toy implementation task, a toy adapter exporting `planFiles` and `createHarness`, a toy `acceptance/runner.mjs` stub, `arms/implementer-one.json`, `experiments/impl-one.json` |
| Modify | `workflow/experiments/harness/driver.mjs` (`runBatch`, right after `const experiment = readJson(expFile)` at line 97) | read `experiment.stage` (absent means `specplan`) and branch before `experiment.arm_ids` is read at line 100: `ablation`, `model_tier` and, until T6, `implementation` throw exit 8 there; the existing line-102 check stays for `specplan` |
| Create | `workflow/experiments/arms/implementer-cheap.json` | stage `implementation`, `model.main` `claude-sonnet-5-5`, `effort` `low`, `permission_mode` `acceptEdits`, empty `artifact_globs`, the F7 prompt text, `allowed_tools` Read, Write, Edit, Bash, Glob, Grep, `disallowed_tools` WebFetch, WebSearch |
| Test | `workflow/experiments/harness/schema.test.mjs`, `workflow/experiments/harness/check.test.mjs`, `workflow/experiments/harness/driver.test.mjs` | cases: E8, E9, E10, E13, E93; exit 8 regression for `ablation`, `model_tier`, `implementation` |

**Checklist**
- [x] 1. Write failing tests in `schema.test.mjs`: a valid implementation task, arm and experiment pass; E8 (missing adapter path is for `check.test.mjs`; here a `checks` entry with no `argv`, a string argv), E10 (`samples` 0 and 6, `attempts` 3, `max_questions` 11, `max_parallel` 4, `plans` empty and 13, a `{{brief}}` placeholder), E93 (an argv that starts with `sh` or `cmd`, an argv that is a string). Run `<TEST schema>`; expect FAIL.
- [x] 2. Implement the validators in `schema.mjs`; run `<TEST schema>`; expect PASS. The specplan validators and their tests stay unchanged.
- [x] 3. Add `makeImplRepo()` to `testkit.mjs` (toy implementation task, a toy adapter, stub `acceptance/runner.mjs` and `host.mjs`, `arms/implementer-one.json`, `experiments/impl-one.json`); `makeExperimentRepo` stays untouched. T3 to T6 add their own test files and do not edit `testkit.mjs`.
- [x] 4. Write failing tests in `check.test.mjs` using `makeImplRepo()`: E8 (adapter path missing), E9 (plan with no snapshot, no adapter, duplicate plan id), E13 (model without a price), an implementation task without `issues_file` passes while a `pilot-` specplan task without one still fails, `experiments/pilot-001.json` still validates. Implement the `runCheck` changes; run `<TEST check>`; expect PASS.
- [x] 5. In `driver.test.mjs` keep the existing test `E11: an arm with stage implementation exits 8 before any clone or run folder exists` and add cases for an experiment with `stage` `ablation` and `model_tier` (no `arm_ids` needed) expecting exit 8 before any call; run only these with `node --test --test-name-pattern "stage" workflow/experiments/harness/driver.test.mjs`; expect PASS.
- [x] 6. Write a failing `spawn.test.mjs` case (`effort: 'low'` adds `--effort low`, an invalid value throws, no `effort` leaves the args unchanged) and an arm-validator case in `schema.test.mjs` (`effort` allowed values); implement in `spawn.mjs` and `schema.mjs`; run `<TEST spawn>` and `<TEST schema>`; PASS. Create `arms/implementer-cheap.json`; run `node workflow/experiments/harness/exp.mjs check`; expect exit 0.
- [x] 7. Update branch state: Progress, Changes line.
- [ ] 8. Commit: `feat: implementation stage schemas, validation and toy fixtures (experiment framework)` with `Task: T2`.

### T3: `exp snapshot`
**Delivers:** frozen plan snapshots | **Satisfies:** F1, E1, E2, E3, E4, E5, E6, E7 | **Depends on:** T2 | **Wave:** 3

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/snapshot.mjs` | `snapshotRun({expRoot, runId, acceptFindings})`: reads `local/runs/<id>/artifacts/{spec,plan}/**`, assigns `kind`, validates every path (absolute, drive letter, `..`, `:`, reserved device name, symlink), scans for URLs, `curl`, `wget`, `Invoke-WebRequest`, `~/`, `%USERPROFILE%`, `..\` and base64 runs of 200 characters or more, scans credentials with `secrets.mjs`, writes `snapshot.json` to a temp folder then renames |
| Create | `workflow/experiments/harness/commands/snapshot.mjs` | `exp snapshot <run-id>... [--accept-findings]`; exit codes 2 and 9; prints `plan_id`, the sha256 of each `snapshot.json` and every scan hit |
| Test | `workflow/experiments/harness/snapshot.test.mjs` | E1 to E7 |

**Checklist**
- [x] 1. Write failing tests for E1 (status `extracted`, unknown id), E2 (no plan file, `missing_artifact`, `cost_mismatch`), E3 (existing target with another hash), each expecting exit 2 and nothing written. Run `<TEST snapshot>`; expect FAIL.
- [x] 2. Implement `snapshotRun` for the happy path and these refusals; run; expect PASS for E1 to E3.
- [x] 3. Add failing tests for E4 (a key pattern in a plan file, exit 9, the type named and the value absent from the message) and E5 (each refused path form, a symlink fixture skipped on a machine that cannot create one with a recorded reason). Implement; run; expect PASS.
- [x] 4. Add failing tests for E6 (`curl http://x`, `~/.ssh`, a 300-character base64 line: exit 2 listing file and line; with `--accept-findings` the file is written) and E7 (two plan-kind files: `snapshot.json` keeps `files` order). Implement; run; expect PASS.
- [x] 5. Add `commands/snapshot.mjs`; run `node workflow/experiments/harness/exp.mjs snapshot` with no argument; expect usage and exit 2.
- [x] 6. Update branch state: Progress, Changes line. Commit: `feat: exp snapshot freezes plan artifacts (experiment framework)` with `Task: T3`.

### T4: Check runner and `exp baseline`
**Delivers:** the verify-tree builder, the stripped-environment runner, parsers, the green rule, adherence metrics and the baseline | **Satisfies:** F4, F8, F10, F12, F15, N3, E14 to E18, E31 to E48, E62 to E64, E94 to E98, E103, E104 | **Depends on:** T2 | **Wave:** 3

**Files**
| Action | Path | What changes |
|---|---|---|
| Modify | `workflow/experiments/harness/clone.mjs` | add `historyFreeTree({repoRoot, baseCommit, dest})`: `git archive` of the base commit into `dest`, `git init`, one commit named `base`, no other ref; used by the baseline and, in T6, by the agent clones |
| Create | `workflow/experiments/harness/safefs.mjs` | `walkClone(dir, limits)` with `lstat` and no link following (skips `.git`, `node_modules`, `dist`, `*.tsbuildinfo` at any depth; returns files or `{unsafe: reason}` for a link, hardlink above 1, non-regular file, name outside `^[A-Za-z0-9_][A-Za-z0-9_./-]*$`, device name, file above 5 MB, above 20000 files or 120 s, any `.npmrc`); `copyFileSafe` |
| Create | `workflow/experiments/harness/testparse.mjs` | `parseTap(text, file)` giving `{id, result}` with the id rule of data-model.md; `countTsErrors(text)` counting lines that match `error TS[0-9]+` |
| Create | `workflow/experiments/harness/implchecks.mjs` | `buildVerifyTree`, `validateLockfile`, `runChecks`, `isGreen`, `adherence`, `sweepProcesses`, `checkEnv`, `baselineProblem`; commands run with `process.execPath` in place of `node`, without a shell |
| Create | `workflow/experiments/harness/implbaseline.mjs` | `buildBaseline({expRoot, repoRoot, task})`: history-free tree, `setup_command` then `post_setup`, checks twice, writes the baseline JSON atomically |
| Create | `workflow/experiments/harness/commands/baseline.mjs` | `exp baseline <task-id>` |
| Test | `workflow/experiments/harness/clone.test.mjs`, `workflow/experiments/harness/safefs.test.mjs`, `workflow/experiments/harness/testparse.test.mjs`, `workflow/experiments/harness/implchecks.test.mjs`, `workflow/experiments/harness/implbaseline.test.mjs` | see steps |

Intended shape of the tree build (a snippet, adapt to the code):
```js
// reference = base tree + snapshot plan files (harness-owned folder, never the clone's git)
const walk = walkClone(clone, LIMITS);            // unsafe -> red attempt, flag unsafe_path
for (const f of walk.files) if (!sameBytes(f, ref(f))) copyFileSafe(f, verify);
for (const f of refFiles) if (!walk.has(f)) rmSync(join(verify, f));   // deletions (E94)
// node_modules: a copy of the pristine tree, never a link; the agent's is never read
```

**Checklist**
- [x] 1. Write a failing `clone.test.mjs` case for `historyFreeTree` (one commit `base`, `git log --all` lists nothing else, no tags or other branches) and implement it; then write failing `testparse.test.mjs`: TAP ids for nested tests, skip and pending directives, a file that prints nothing (`<file>::load`), duplicate names (`#2`), error counts (E48 rows). Implement `testparse.mjs`; `<TEST testparse>` PASS.
- [x] 2. Write failing `safefs.test.mjs`: unsafe names (`a&calc.test.ts`, trailing dot, `aux`, an alternate-stream name), a file above the size cap, nested `node_modules` skipped, a `.npmrc` refused, a symlink and a hardlink (skip with a recorded reason where the machine cannot create them) (E35, E94 to E96, E104). Implement `safefs.mjs`; `<TEST safefs>` PASS.
- [x] 3. Write failing `implchecks.test.mjs` for the tree: patched `node_modules` has no effect (E31), deleted source file is deleted in the tree (E94), plan files are not changes (reference rule), changed dependencies run validation and a `file:` or foreign-registry or altered-integrity lockfile is `unsafe_deps` with no install (E32, E97). Implement `buildVerifyTree` and `validateLockfile`; run; PASS.
- [x] 4. Add failing tests for running: all steps run after a typecheck failure (E34), timeout gives `check_timeout` (E36), 20 MB output is killed and flagged (E37), a key pattern in output gives `secret_in_check_output` with empty lines (E39), line caps (E40), environment allowlist and `node` argv without a shell (N3, E93), the sweep kills an orphan and a survivor is `containment`, and the adapter file is added only after a clean sweep (E98). Implement `runChecks`, `checkEnv`, `sweepProcesses` with the T1 sweep command; run; PASS.
- [x] 5. Add failing tests for the green rule: one test per row E41 to E46 and E48 (new test under a protected glob allowed, edits to `tsconfig*.json` or existing tests or `.git/config` bytes protected, `package.json` scripts without effect, no test file, regression and missing, baseline-failing and flaky excluded, own-test file that does not load), `plan_modified` when a plan file is edited or deleted (E47 detection), and `result_tampering_suspected` when the diff contains `process.exit`, `process.stdout`, `process.stderr`, `process.argv`, `child_process` or `eval` (E57). Implement `isGreen` and the two detectors; run; PASS.
- [x] 6. Add failing tests for `adherence` (E62 to E64: off-plan files, missing planned files, notes and lockfiles excluded, `gates_skipped` from `## Skipped` bullets only, `gates_in_plan`) and for the pristine-toolchain re-hash (E103: changed manifest, `checks.json` or acceptance folder gives exit 7). Implement; run `<TEST implchecks>`; PASS.
- [x] 7. Write failing `implbaseline.test.mjs` with the toy repo: typecheck errors exit 3 and no file (E14), tests that cannot run exit 3 (E15), a test that flips between the two runs is `flaky_tests` (E16), `baselineProblem` reports a stale `checks_sha256`, `setup_sha256` or `lockfile_sha256` (E17), setup failure and timeout exit 3 (E18). Implement `implbaseline.mjs` and `commands/baseline.mjs`; run `<TEST implbaseline>`; PASS.
- [x] 8. Run `node workflow/experiments/harness/exp.mjs baseline` with no argument; expect usage and exit 2.
- [x] 9. Update branch state: Progress, Changes line. Commit in two slices: `feat: safe verify-tree builder and parsers (experiment framework)` (steps 1 to 3 files) and `feat: check runner and exp baseline (experiment framework)`, each with `Task: T4`.

### T5: Shared checks and adapters
**Delivers:** the pilot implementation task, shared runner (parent and host), canary tokens and one adapter per pilot plan | **Satisfies:** F2, F9, E54, E55, E56, E57, E58, E59, E60, E61 | **Depends on:** T2 | **Wave:** 3

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/tasks/pilot-pinned-note-impl/task.json` | `stage` `implementation`; `base_commit` and `brief_file` copied from `tasks/pilot-pinned-note`; `setup_command` `["npm","ci","--ignore-scripts"]`, `post_setup` the `prisma generate` argv from the data model (T1 finding); checks: typecheck `node node_modules/typescript/bin/tsc -b` at the root and `node node_modules/typescript/bin/tsc --noEmit -p .` in `src/fe` (use the real scripts' content from the root `package.json`), `lint` null, tests prefix `node --import tsx --test --test-reporter=tap`, shared runner argv; `protected_globs` `**/tsconfig*.json`, `tests/**`, `**/*.test.ts` |
| Create | `workflow/experiments/tasks/pilot-pinned-note-impl/brief.md` | a copy of the pilot brief |
| Create | `workflow/experiments/tasks/pilot-pinned-note-impl/acceptance/checks.json` | CHK1 to CHK8 with `required` and a one-sentence `requirement` each (requirements.md) |
| Create | `workflow/experiments/tasks/pilot-pinned-note-impl/acceptance/runner.mjs` | parent: starts `host.mjs`, sends `{id, method, args}`, receives `{id, result}`, decides CHK1 to CHK8 from plain values, prints one JSON object on stdout; a host that exits early or hangs makes the affected ids `error` |
| Create | `workflow/experiments/tasks/pilot-pinned-note-impl/acceptance/host.mjs` | child: imports the adapter named by `--adapter` and answers calls; never imports `checks.json` |
| Create | `workflow/experiments/tasks/pilot-pinned-note-impl/acceptance/adapters/superpowers-r2.mjs`, `lite-r2.mjs`, `full-r2.mjs` | one per plan id, written from the `artifacts/` of the three source runs: `planFiles` and `createHarness(root, {clock})` over the layer each plan names as its deliverable |
| Create | `workflow/experiments/harness/canary.mjs` | `plantCanary(files)` writes one random token as a comment into each acceptance file; `findCanary(files)` returns it |
| Test | `workflow/experiments/harness/implacceptance.test.mjs`, `workflow/experiments/harness/canary.test.mjs` | E54 to E61 on a toy adapter written into each test's own temp folder; the tests import the real `acceptance/runner.mjs` by path and do not edit `testkit.mjs` |

The IPC contract (data-model.md, a snippet): parent sends `{id: 1, method: "createNote", args: [{role, epicId, text}]}`; host answers `{id: 1, result: {ok, data, reason}}`; any other output from the host is ignored.

**Checklist**
- [x] 1. Write failing `implacceptance.test.mjs` with the toy adapter from `testkit.mjs`: all CHK ids pass for a correct adapter; a missing module gives `error` with `module missing` (E54); a throwing adapter, an early exit and a missing id give `error` and `adapter_error` (E55); a required `error` counts as failed and an informational failure does not (E56) (E56 decides in the parent); a host that prints verdict-shaped JSON or exits at once is ignored or `error` (E58); same-millisecond notes order by `clock.tick()` (E60); CHK4 fails when the second pin is rejected (E61); E59 uses a toy adapter that tests a service layer for a plan with no route. Run `<TEST implacceptance>`; expect FAIL.
- [x] 2. Implement `runner.mjs` and `host.mjs`. The runner starts the host with `process.execPath`, adding `--import tsx` only when `tsx` resolves from `--root` (so the toy tests run on plain Node with a `.mjs` adapter and the real task runs TypeScript). Run; expect PASS. E57 (the diff grep) is tested in T4.
- [x] 3. Write failing `canary.test.mjs` (plant a `// canary:` comment into `.mjs` files and a `_canary` field into `.json` files, find both, a second plant keeps the same token); implement `canary.mjs`; run; expect PASS.
- [x] 4. Create `task.json`, `brief.md` and `checks.json`; run `node workflow/experiments/harness/exp.mjs check`; expect exit 0 once the three adapters exist (step 5).
- [x] 5. Copy the three source run folders from `S:\CS3227\CS3227-2610-MP4-w7\workflow\experiments\local\runs\` (`20261103-113753-pilot-pinned-note-superpowers-r2`, `20261103-114628-pilot-pinned-note-lite-r2`, `20261104-095259-pilot-pinned-note-full-r2`) into this worktree's `workflow/experiments/local/runs/` (`local/` is ignored and per worktree) and check each manifest says `complete`. Read the three source plans (`local/runs/20261103-113753-pilot-pinned-note-superpowers-r2/artifacts`, `local/runs/20261103-114628-pilot-pinned-note-lite-r2/artifacts`, `local/runs/20261104-095259-pilot-pinned-note-full-r2/artifacts`) and write one adapter each: declare `planFiles` from the plan's file lists and implement the five adapter methods over what the plan says it builds. Run each adapter against a stub of its declared modules for its CHK1 to CHK8 wiring only (no implementation exists).
- [x] 6. Run `plantCanary` over `acceptance/`; commit the files with the token inside.
- [x] 7. GATE: show the operator the three adapters and `checks.json` and wait for a yes (they decide what each plan is tested on). Fold in changes; do not proceed on silence.
- [x] 8. Update branch state: Progress, Changes line. Commit: `feat: pilot implementation task, shared checks and adapters (experiment framework)` with `Task: T5`.

### T6: Implementation driver
**Delivers:** `exp run` for implementation experiments | **Satisfies:** F3, F5, F6, F7, F11, F14, N1, E11, E12, E19 to E30, E33, E38, E49 to E53, E71 to E74, E83 to E92, E99 to E102 | **Depends on:** T3, T4, T5 | **Wave:** 4

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/impldriver.mjs` | `runImplBatch(ctx)`: plans x samples; per sample history-free clone (`git archive`, `git init`, commits `base` and `plan`), arm overlay, `setup_command` and `post_setup`, probe, attempt 1, checks, attempt 2, ceilings, `--continue`, end-of-turn sweep, tool-call scan, canary scan, clone-size and free-disk poll every 30 s |
| Create | `workflow/experiments/harness/implfeedback.mjs` | `buildFeedback(checkResult, restored)` with the fixed template; `restoreFiles({ref, clone, paths})` writing harness-owned bytes after `lstat` checks, no git |
| Modify | `workflow/experiments/harness/driver.mjs` (`runBatch`, the branch added in T2 after line 97; helpers `createRun`, `persist`, `abort`, `invoke`, `account`, `containmentDiff`) | export the helpers; the T2 branch calls `runImplBatch` for `implementation` experiments, passing `expFile`, `experiment`, `cfgDir` and `now`; `exp run` filters `--task`, `--arm` and `--rep` exit 2 for implementation experiments; exit 8 stays for `ablation` and `model_tier` |
| Modify | `workflow/experiments/harness/state.mjs` (`newRunState`, `computeHashes`) | `attempt`, `attempt_state`, `attempt2_started`, `cli_total_at_boundary`, `plan_gap_questions`; hashes of adapter, `checks.json`, baseline, arm |
| Modify | `workflow/experiments/harness/containment.mjs` (`batchPaths`) | add `local/plans` and the baseline JSON file `local/baselines/<task>.json` (not its `tree/`, which F8 step 1 re-hashes before every verify tree); `tasks/` is already hashed whole |
| Create | `workflow/experiments/harness/implcost.mjs` | `splitCosts(events, attempt2_started)` giving `impl_cost_usd` and `fix_cost_usd` (a question turn belongs to its attempt); review spend is recorded in the existing `judge` cost class, so `COST_CLASSES`, `budget.mjs` and the specplan sums do not change |
| Modify | `workflow/experiments/harness/clone.mjs` | `prepareImplClone({repoRoot, baseCommit, dest, arm, planFiles})`: `historyFreeTree` from T4, the arm overlay, the plan files and a second commit named `plan` |
| Test | `workflow/experiments/harness/impldriver.test.mjs`, `workflow/experiments/harness/implfeedback.test.mjs`, `workflow/experiments/harness/implcost.test.mjs`, `workflow/experiments/harness/state.test.mjs`, `workflow/experiments/harness/containment.test.mjs`, `workflow/experiments/harness/clone.test.mjs`, `workflow/experiments/harness/driver.test.mjs` | see steps |

**Checklist**
- [x] 1. Write failing tests for the clone (`clone.test.mjs`) and preflight (`impldriver.test.mjs`): `git log --all` shows `base` and `plan` and no other ref, a plan path that collides exits 3, two samples have separate folders (E19 to E21); a changed snapshot file exits 7 before any call, an adapter, `checks.json` or arm file that is not committed or is modified exits 7 (reuse `experimentFileProblem`), a manifest hash mismatch on `--continue` and before attempt 2 exits 7, a stale baseline exits 3 (E11, E12, E17 wiring). Rewrite the existing `driver.test.mjs` test `E11: an arm with stage implementation exits 8 ...` to expect the dispatch (exit 3 for a missing baseline) and remove its exit-8 assertion for `implementation`. Implement `prepareImplClone` and the preflight; run those files; PASS.
- [x] 2. Write failing tests for the turn loop with the fake CLI: probe mismatch exits 4 (E24); a run reaches `EXP-DONE` in attempt 1 with the plan files in place; six questions with `max_questions` 5 abort `turn_cap` with 5 counted, 1 plus 4 across attempts total 5, two empties abort (E25 to E27); a status line is classified by the framework classifier (E28); notes parsing gives 2, 1 and 0 for the three note layouts (E29) and the notes cap is enforced (E30). Implement the loop in `impldriver.mjs` and the `driver.mjs` exports and dispatch; run `<TEST impldriver>`; PASS.
- [x] 3. Write failing tests for end-of-turn process and path controls using fake CLI steps with effects: a detached child is swept and a survivor aborts `containment` (E23, E87); tool-call text naming another run's clone, `EXP_ROOT`, `local/`, `~/.claude`, `claude -p` or `curl` sets `outside_clone_access` (E22, E100). Implement them; run; PASS.
- [x] 4. Write failing tests for a canary token in a tool result or a clone file (E99) and for the 30 s poll aborting `disk`, with an injected interval and size reader (E38, E101). Implement them; run; PASS.
- [x] 5. Write failing `implfeedback.test.mjs`: the exact template text, section order, `[cut]` at 8000 characters, the fallback line when `secret_in_check_output` is set (E52); restore writes harness bytes and refuses a link target with `containment` (E102, E47 restore). Implement `implfeedback.mjs`; run; PASS.
- [x] 6. Write failing attempt tests: green at attempt 1 stops (E49); `attempts` 1 stops after one (E50); two reds stop at two (E51); attempt 2 resumes the same session after the restore, the prompt equals the template, `attempt2_started` is set once (E52, E53); a kill in `checking` re-runs the checks only with no new turn and no second charge, and deletes any verify tree and acceptance copy first (E33); a kill between attempts resumes at attempt 2 (E53). Implement; run; PASS.
- [x] 7. Write failing cost tests: ceiling mid-attempt aborts `budget`, the cut attempt has no check result (E71); batch ceiling leaves runs queued with exit 5 and counts review spend (E72); the comparison with the CLI is the sum of the final per-session totals and a gap above 2% sets `cost_mismatch` (E73); `splitCosts` puts a question turn in its attempt (E74) and `impl_cost_usd` plus `fix_cost_usd` equals the event rows. The `arm` spend stays the ceiling basis; the driver records `cli_total_at_boundary` when attempt 2 starts. Implement `implcost.mjs` and the attribution; run `<TEST implcost>` and `<TEST impldriver>`; PASS.
- [x] 8. Write failing tests for E83 to E92 wiring that earlier steps do not cover: a hook or `.git/config` byte change is `protected_modified`, no git command runs in the clone after it is created (spy on the spawn helper from that point), sample 2 cannot see sample 1's folder (E92). Implement; run; PASS.
- [x] 9. Extend `state.mjs` and `containment.mjs` as listed with their tests; run `<TEST state>` and `<TEST containment>`; PASS. Run the specplan `driver.test.mjs` in the background (`<BUILD>` subset) and expect it green.
- [x] 10. Update branch state: Progress, Changes line. Commit in slices: clone and preflight; turn loop and controls; feedback and attempts; cost and state. Each `feat: ... (experiment framework)` with `Task: T6`.

### T7: Code review and `exp grade`
**Delivers:** the review call and the implementation grade | **Satisfies:** F13, N2, E65, E66, E67, E68, E69, E70, E81, E82 | **Depends on:** T6 | **Wave:** 5

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/implreview.mjs` | `buildReviewPrompt` (plan files 40000, notes 20000, diff 80000 characters, path list, all inside delimiters with a nonce regenerated until absent), `parseFindings` (labels, control characters stripped, 500-character cut), `reviewRun` (`runNoTools`, the `strong` tier model, `--max-budget-usd` 0.5, one retry); the diff is built from the verify-tree file set against the reference, lockfiles removed |
| Modify | `workflow/experiments/harness/grade.mjs` (`gradeRun`, the guard at line 21 and the spend fallback at line 26) | for runs with `plan_id`: an aborted run is allowed (false `pass1` and `pass2`, empty check fields, no review); otherwise read the last `checks/attempt-<n>.json`, `state.json`, `events.csv` and the manifest and write the F13 fields, `green_attempt`, `pass1`, `pass2`, the adherence fields and `impl_cost_usd` and `fix_cost_usd` (through `splitCosts`); review failure or missing clone gives `review_error`; batch ceiling gives exit 5 without a review |
| Modify | `workflow/experiments/harness/commands/grade.mjs` | none unless the usage text lists runs; keep `--self-test` unchanged |
| Test | `workflow/experiments/harness/implreview.test.mjs`, `workflow/experiments/harness/grade.test.mjs` | E65 to E70, E81, E82 |

**Checklist**
- [x] 1. Write failing `implreview.test.mjs`: cut at 80000 with `diff_truncated` (E65); the instruction line sits only between the delimiters and the nonce is regenerated when present in the content (E66); an unparseable answer twice gives `review_error` (E67); unknown labels become `other` and `minor`, controls stripped, 900 characters cut to 500 (E68); a key pattern gives `review_error` and a final exit 9 (E69); a blocker on a green run changes no pass field (E70). Run; expect FAIL.
- [x] 2. Implement `implreview.mjs` using `runNoTools` with a fake CLI; run `<TEST implreview>`; PASS.
- [x] 3. Write failing `grade.test.mjs` cases: pass fields are identical when graded twice, also after the agent clone is deleted, with the second review block empty and `review_error` (E81, N2); a run that is not `extracted` exits 2 (E82); an aborted implementation run is graded with false pass fields and no review. Implement the `gradeRun` branch; run `<TEST grade>`; PASS (the specplan grade tests stay green).
- [x] 4. Update branch state: Progress, Changes line. Commit: `feat: advisory code review and the implementation grade (experiment framework)` with `Task: T7`.

### T8: Report and pilot run
**Delivers:** the two CSVs, the committed pilot experiment and the real batch | **Satisfies:** F14, N1, N4, E75, E76, E77, E78, E79, E80 | **Depends on:** T7 | **Wave:** 6

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `workflow/experiments/harness/implreport.mjs` | `writeImplReport({expRoot, outDir, experimentId})`: `impl-runs.csv`, `impl-summary.csv` with the columns of data-model.md, the cost formulas of SD6, `note` order `underpowered;no_green;incomplete`, a leading `'` for cells that start with `=`, `+`, `-` or `@`, credential scan (exit 9, no rename) |
| Modify | `workflow/experiments/harness/report.mjs` (`writeReport`) | when the experiment file's stage is `implementation`, call `writeImplReport`; the specplan columns and output stay unchanged |
| Create | `workflow/experiments/experiments/impl-pilot-001.json` | task `pilot-pinned-note-impl`, arm `implementer-cheap`, the three plans with `source_experiment_id` `pilot-001` and the snapshot hashes, `samples` 2, `attempts` 2, ceilings agreed at the gate |
| Test | `workflow/experiments/harness/implreport.test.mjs` | E75 to E80 and the F14 pass counts |

**Checklist**
- [ ] 1. Write failing `implreport.test.mjs`: the worked example (plan 1.0000, samples 0.3000 green at attempt 2 and 0.2000 never green gives `expected_cost_to_green_usd` 1.5000, `pass1_count` 0, `pass2_count` 1, `underpowered`) (E75); `no_green` and `incomplete` and their order (E76); an aborted run counts in `n`, `n_aborted`, cost sums and has empty check columns (E77); a leading `=` is prefixed (E78); a key pattern exits 9 with no rename (E79); no finished runs exits 2 (E80); printed pass counts equal the CSV counts. Run; expect FAIL.
- [ ] 2. Implement `implreport.mjs` and the dispatch in `report.mjs`; run `<TEST implreport>` and `<TEST report>`; PASS.
- [ ] 3. Check that the three source run folders are in this worktree's `workflow/experiments/local/runs/` (copied in T5 step 5; copy them again if missing). `exp snapshot` the three source runs (`20261103-113753-pilot-pinned-note-superpowers-r2`, `20261103-114628-pilot-pinned-note-lite-r2`, `20261104-095259-pilot-pinned-note-full-r2`); show every scan hit to the operator; GATE: wait for the operator's yes to use `--accept-findings` if any hit appears. Run `exp baseline pilot-pinned-note-impl`; expect exit 0 with 0 typecheck errors.
- [ ] 4. Write `experiments/impl-pilot-001.json` with the snapshot hashes; run `exp check`; commit it (`feat: implementation pilot experiment file`, `Task: T8`) so the framework's committed-and-unmodified rule holds. Run `exp run impl-pilot-001 --dry`; expect six run ids.
- [ ] 5. GATE: ask the operator, in one message, to confirm (a) the run and batch ceilings in the experiment file, with the toy cost from T1 as the basis, (b) how the batch is protected: a separate low-privilege Windows user or explicit acceptance of the exposure, (c) whether a dedicated API key with a console spend cap is used, (d) that they are available while it runs, and (e) the arm approval: the operator reviews `arms/implementer-cheap.json` (it has Bash) and the printed approval hash. Write the answers in the branch state. Do not start a real call without all five.
- [ ] 6. GATE: run `exp run impl-pilot-001 --yes implementer-cheap=<approved hash>` (six runs, each up to two attempts) in the background; do not edit files under `workflow/experiments/` while it runs; handle `--continue` for any interrupted run.
- [ ] 7. GATE: run `exp grade <run-id>` (each makes one real review call, up to 0.5 USD; covered by the step 5 ceilings and answers) for every extracted run; compare each run's cost with the CLI total (N1, E73); run `exp report impl-pilot-001`; cross-check the printed pass counts against the CSV.
- [ ] 8. Record in the branch state the per-plan pass@1 and pass@2 as counts, cost to green, expected cost to green, the review findings by severity, adherence metrics, and the line `underpowered: 2 samples per plan`. State what the numbers do not show; do not rank the arms.
- [ ] 9. Commit the CSVs under `docs/telemetry/experiments/` and the branch state: `docs: implementation pilot result (experiment framework)` with `Task: T8`.

### Close-out
- [ ] Every Traceability row verified; `<BUILD>` green on Windows (background); `exp check --secrets` clean; `<LINT plan> --closeout` passes.
- [ ] Code review of the branch diff (Implementer and Attacker lenses, one round); fix findings.
- [ ] Spec index status, plan Task order and branch state reflect reality; the E93 to E104 assignment recorded as a Changes line; amendments, if any, recorded as decisions.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines complete; Known Gap (agent turn exposure, no sandbox, plausible-value builds, agent spend not counted) written; the layout Convention (new files and CSVs) written; `Handover` items kept: classifier overcount fix, Codex driver, real W7 comparison; note `guide out of date: no developer-guide section covers process tooling`.
- [ ] GATE: ask the operator to review the branch (`AGENTS.md` § 8, gate 3); write `Approved` only on their yes, and never push, open a PR or merge before it.
