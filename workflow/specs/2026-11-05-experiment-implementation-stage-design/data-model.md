# Data Model

Files on disk, no database, under the framework's `EXP_ROOT` (`workflow/experiments/`). JSON uses two-space indent, UTC ISO-8601 times, money in USD with 4 decimals (rounded once, at the end of each formula). Everything not listed here is unchanged from the framework's data-model. `schema_version` stays 1: every addition is a new optional field or a new file. Delimiter inside CSV cells that hold lists: `;`.

Committed: `tasks/<id>/` (including `acceptance/`), `arms/implementer-*.json`, `experiments/<id>.json`, the `harness/` modules, `pricing.json`. Gitignored under `local/`: `plans/`, `baselines/`, run folders, check outputs.

## Entities
| Entity | Attribute | Type | Null | Default | Range / rule |
|---|---|---|---|---|---|
| Snapshot (`local/plans/<source-experiment-id>/<plan-id>/snapshot.json`) | plan_id | string | no | - | `<arm-id>-r<rep>` |
| | source_run_id, source_experiment_id, arm_id | string | no | - | the run is `complete` |
| | rep | int | no | - | 1-10 |
| | plan_cost_usd | decimal | no | - | the source run's `arm_cost_usd` only; carried, never counted against a ceiling |
| | files | array of {path, kind, sha256} | no | - | `kind` `spec` or `plan`; at least one of each; paths as F1 |
| Implementation task (`tasks/<id>/task.json`) | stage | enum | no | - | `implementation` |
| | base_commit, brief_file | string, path | no | - | as in the framework |
| | setup_command | argv array | no | - | run in a new tree; the pilot task: `["npm","ci","--ignore-scripts"]` |
| | checks.typecheck | array of {argv, cwd, timeout_s} | no | - | run in order; `cwd` repo-relative; errors counted as in § Parsing rules |
| | checks.lint | array like typecheck, or null | yes | null | null means no lint command (the pilot task: null, because its lint script equals typecheck) |
| | checks.tests | {own_argv, baseline_files, timeout_s} | no | - | `own_argv` is the argv prefix that runs one test file when the file path is appended after `--`; `baseline_files` is a list of globs of the test files that exist at base |
| | checks.shared | {argv, timeout_s} | no | - | the shared runner argv (`node` plus the runner path), run with the verify-tree root as working directory |
| | protected_globs | string[] | no | `[]` | repo-relative, forward slashes, `**` crosses folders, no other depth is implied; a file is protected when it exists at `base_commit`, matches a glob, and is modified, deleted or renamed. The pilot task: `**/tsconfig*.json`, `tests/**`, `**/*.test.ts` |
| | acceptance | {folder, checks_file, adapters} | no | - | `adapters` maps plan id to a path; every path exists |
| Acceptance canary | canary | string | no | - | a random string written once into every committed acceptance file by `exp check`'s helper and never shown to an agent; the harness scans tool results and the clone for it (F6) |
| Acceptance `checks.json` | entries | array of {id, required, requirement} | no | - | `id` `CHK<n>`; `requirement` one sentence, shown in attempt-2 feedback |
| Adapter (module, one per plan id) | exports | `planFiles`, `createHarness(root, {clock})` | no | - | see § Adapter contract |
| Implementer arm (`arms/implementer-*.json`) | stage | enum | no | - | `implementation` |
| | prompt | string | no | - | placeholders `{{plan_path}}`, `{{spec_paths}}`, `{{task_id}}` only; `plan_path` is the first file of kind `plan` in the snapshot order, `spec_paths` all files of kind `spec` joined by a space |
| | model | map | no | - | `{main: "claude-haiku-5-5"}`; the id has an entry in `pricing.json` before T2 |
| | artifact_globs | object | no | `{spec: [], plan: []}` | empty for this stage |
| Implementation experiment (`experiments/<id>.json`) | stage, id | enum, string | no | - | `implementation` |
| | task_id, implementer_arm_id | string | no | - | exist; stages equal `implementation` |
| | plans | array of {source_experiment_id, plan_id, snapshot_sha256} | no | - | 1-12 entries, no duplicate plan id, each has an adapter |
| | samples | int | no | 2 | 1-5 |
| | attempts | int | no | 2 | 1-2 |
| | max_questions | int | no | 5 | 1-10, per sample across attempts |
| | turn_timeout_s | int | no | 1800 | above 0; per agent turn |
| | run_timeout_s | int | no | 5400 | above 0; agent time only, check time does not count |
| | check_timeout_s | int | no | 600 | above 0; fallback for a command with no `timeout_s` |
| | check_total_s | int | no | 1800 | above 0; all checks of one attempt |
| | max_clone_mb | int | no | 2048 | above 0 |
| | max_parallel | int | no | 2 | 1-3 |
| | run_ceiling_usd, batch_ceiling_usd | decimal | no | none | above 0, required; review calls count in the batch spend |
| | answer_mode | enum | no | `fixed` | only `fixed` |
| Baseline (`local/baselines/<task-id>.json`) | base_commit, created | string, time | no | - | |
| | checks_sha256, setup_sha256, lockfile_sha256 | string | no | - | hashes of the task's check and setup commands and of `package-lock.json`; compared at run start |
| | typecheck_errors, lint_errors | int | no | 0 | must be 0 |
| | passing_tests, failing_tests, flaky_tests | string[] | no | `[]` | test ids; flaky = result differs between the two baseline runs and is excluded from the pass rule |
| Run manifest additions | plan_id, plan_arm_id, plan_snapshot_sha256, sample | string, string, string, int | no | - | `arm_id` is the implementer arm and `rep` equals `sample`; the run id is `<ts>-<task>-<plan-id>-s<sample>` |
| | adapter_sha256, checks_sha256, baseline_sha256, arm_sha256 | string | no | - | compared at attempt 2 and on `--continue` |
| | flags | string[] | no | `[]` | adds `protected_modified`, `plan_modified`, `diff_truncated`, `check_timeout`, `output_truncated`, `secret_in_check_output`, `outside_clone_access`, `result_tampering_suspected`, `adapter_error`, `unsafe_path`, `unsafe_deps`, `deps_changed`, `review_error`, `cost_mismatch` |
| Run state additions | attempt | int | no | 1 | 1 or 2 |
| | attempt_state | enum | no | `agent` | `agent`, `checking`, `done` |
| | attempt2_started | time | yes | null | the attempt boundary: set before the resume prompt is sent |
| | plan_gap_questions | int | no | 0 | 0 to `max_questions` |
| Check result (`local/runs/<id>/checks/attempt-<n>.json`) | typecheck, lint | {errors, status, lines} | no | - | `status` `ok`, `fail` or `error`; `lines` at most 40 lines of 300 characters |
| | own_tests | {files, passed, failed, skipped, failing} | no | - | `failing` holds `{id, lines}` with at most 20 output lines each |
| | baseline_tests | {newly_failing, missing} | no | - | ids that passed at baseline and now fail, or are not found |
| | shared | map CHK id to {status, message} | no | - | status `pass`, `fail` or `error`; message at most 300 characters |
| | protected_changed, plan_changed | string[] | no | `[]` | paths |
| | changed_files, deleted_files | string[] | no | `[]` | repo-relative paths against the reference, at most 200 listed |
| | files_off_plan, plan_files_missing, gates_skipped, gates_in_plan | int | no | 0 | computed at the end of the attempt (F12) |
| | notes_truncated, secret_in_check_output | bool | no | false | when `secret_in_check_output` is true the `lines` fields are empty and `green` is false |
| | green | bool | no | - | the F10 rule |
| Grade additions (`grades.json`) | green_attempt | int | yes | null | 1, 2 or null |
| | pass1, pass2 | bool | no | - | |
| | files_off_plan, plan_files_missing, gates_skipped, gates_in_plan | int | no | 0 | copied from the last `checks/attempt-<n>.json`; 0 for a run with no check result |
| | review | {findings: [{category, severity, where, issue}]} | no | `{findings: []}` | labels as F13; an unknown label is stored as `other` and `minor` |

## Parsing rules
- **Typecheck and lint:** `errors` is the number of output lines that match `error TS[0-9]+`. A command that exits non-zero with 0 such lines, or times out, or cannot start, gives `status` `error` and the attempt is not green. Commands run in order; all run even when an earlier one fails; `errors` is the sum.
- **Tests:** files run one at a time through `own_argv` with the Node test reporter `tap`. A test id is `<file>::<names of enclosing tests and the test, joined by " > ">`. `ok` is passed, `not ok` is failed, a TAP skip or pending directive makes it skipped. A file that exits non-zero and prints no `ok` or `not ok` line counts as one failed test with id `<file>::load`. Duplicate ids in one file get a `#2`, `#3` suffix in output order. Skipped tests do not count toward "at least one test ran".
- **Baseline test set:** every file matched by `checks.tests.baseline_files` run as above, at baseline and after the build. A baseline passing id that is not found after the build is `missing` and counts as newly failing.

## Adapter contract
An adapter is an ES module (run with `node --import tsx`) that exports:
- `planFiles`: string array of repo-relative paths or folders (a folder entry matches every file under it) the plan says it creates or changes.
- `createHarness(root, {clock})`: returns an object with these async methods, each resolving to `{ok, data, reason}` where `reason` is one of `forbidden`, `not_found`, `invalid`, `other` when `ok` is false:
  `createEpic()` -> `{id}`; `createNote({role, epicId, text})` -> note `{id, text, pinned}`; `listNotes({role, epicId})` -> array of notes in the order the plan's own view returns them, pinned flag included; `pinNote({role, epicId, noteId})`. `role` is `PM` or `Developer`; the Developer is a member of the project. `clock.tick()` advances time by 1 ms so ordering never ties.
The shared runner is `acceptance/runner.mjs`, started by the harness with `node` and the arguments `--adapter <absolute path> --checks <absolute path> --root <verify-tree root>`. It is the parent of F9: it starts a host child (`acceptance/host.mjs`, run with `node --import tsx` in the verify-tree root, which loads the adapter) and calls the adapter methods through IPC messages `{id, method, args}` answered by `{id, result}`; the parent decides each CHK verdict and prints one JSON object `{CHK<n>: {status, message}}` on its stdout. The host needs the loader `tsx`; T1 confirms that it resolves from the pristine baseline tree. A missing module gives `error` with message `module missing`; any other throw gives `error` with the error's name only.

## Fixed texts
- Answer to an implementer question: `The plan is the specification. If it is silent, make the smallest change that satisfies the plan's task, record the assumption in IMPLEMENTATION-NOTES.md under Assumptions, and continue.`
- Notes file: `IMPLEMENTATION-NOTES.md`, at most 20000 characters, headings `## Skipped` and `## Assumptions`, one bullet (`- `) per item; only bullet lines under `## Skipped` count for `gates_skipped`; a missing file or heading gives 0.
- Attempt-2 feedback (at most 8000 characters, cut with the line `[cut]`): `Your build is not green. Fix these and end with EXP-DONE. Do not ask questions.` then, in this order and only the sections that apply (when `secret_in_check_output` is set, the single line `The check output could not be shown. Re-read the plan and fix any step that fails.` replaces every section except `Restored files:`): `Typecheck errors:` and `Lint errors:` with their lines; `Failing tests:` with each failing id and its lines; `Existing tests that no longer pass:` with ids; `Required checks that failed:` with each check's `requirement` sentence; `Restored files:` with the paths the harness restored. Before the resume the harness restores every `protected_globs` file that was modified or deleted and every plan file to its `plan` commit content and lists them under `Restored files:`.

## Cost formulas (SD6)
- Events are assigned to attempt 1 if their time is before `attempt2_started`, else to attempt 2; a question turn inside an attempt belongs to that attempt.
- `run_cost_usd` = `impl_cost_usd` + `fix_cost_usd`; review cost is excluded from every cost-to-green figure.
- `cost_to_green_usd` (run) = `plan_cost_usd` + `impl_cost_usd` if green at attempt 1, `plan_cost_usd` + `run_cost_usd` if green at attempt 2, empty otherwise.
- `expected_cost_to_green_usd` (plan) = `plan_cost_usd` + (sum of `run_cost_usd` over all n samples, aborted included) / `pass2_count`; empty when `pass2_count` is 0. Worked example: plan 1.0000, samples 0.3000 (green at attempt 2) and 0.2000 (never green): 1.0000 + 0.5000 / 1 = 1.5000.
- `min_` and `max_cost_to_green_usd` are over green runs only.

## Keys and relationships
| From | To | Cardinality | On delete | Ownership / tenancy scope |
|---|---|---|---|---|
| Snapshot | Implementation run | 1 to many | runs kept | local operator only |
| Implementation experiment | Run | 1 to many (plans x samples) | runs kept | local operator only |
| Run | Check result | 1 to 0, 1 or 2 | removed with the run folder | local operator only |

## Lifecycle
The framework's run lifecycle applies (`queued`, `running`, `done`, `aborted`, `extracted`, `complete`). Inside `running`, `attempt_state` moves `agent` -> `checking` -> (`agent` for attempt 2, only if not green and `attempt` is 1) -> `done`. The agent clone is kept until `exp grade` has written the review; if it is gone, `exp grade` writes the grade without a review and sets `review_error`. A run is `complete` after `exp grade`. An aborted run (budget, timeout, `turn_cap`, containment, crash, disk) is red even if its code was fine, has no check result for the attempt that was cut off, has empty check columns in the CSV, skips the review, is extracted and counts in cost columns and in `n_aborted`; its `pass1` and `pass2` are false. After `turn_cap` the checks do not run.

## Invariants
- A run's `impl_cost_usd` plus `fix_cost_usd` equals the sum of its event rows; the review call is not an event row and is recorded only in `review_cost_usd`.
- `pass1` implies `pass2`; `green_attempt` is 1 exactly when `pass1`, and 2 exactly when `pass2` and not `pass1`.
- `cost_to_green_usd` is empty exactly when `pass2` is false.
- Acceptance files and adapters are only ever in a verify tree, never in an agent clone.
- Committed files never contain agent-written code, diffs, check output or review text; `docs/telemetry/experiments/` holds counts only.

## Reports (committed under `docs/telemetry/experiments/`)
- `impl-runs.csv`: run_id, experiment_id, task_id, plan_id, plan_arm_id, sample, status, abort_reason, flags, model_main, attempts_used, green_attempt, pass1, pass2, wall_s, in_tok, out_tok, cache_read_tok, cache_write_tok, impl_cost_usd, fix_cost_usd, review_cost_usd, plan_cost_usd, cost_to_green_usd, typecheck_errors, lint_errors, own_tests_failed, newly_failing_tests, shared_required_failed, shared_info_failed, plan_gap_questions, files_off_plan, plan_files_missing, gates_skipped, gates_in_plan, review_blockers, review_majors, review_minors, review_bugs.
- `impl-summary.csv`: one row per `plan_id`: experiment_id, plan_id, plan_arm_id, n, n_aborted, pass1_count, pass2_count, plan_cost_usd, mean_run_cost_usd, expected_cost_to_green_usd, min_cost_to_green_usd, max_cost_to_green_usd, mean_gaps, mean_review_majors, note. `n` is the number of finished runs. `note` holds, `;`-joined in this order, any of `underpowered` (n below 5), `no_green` (`pass2_count` 0), `incomplete` (n below `samples`).
- `events.csv` of the framework includes implementation runs with the framework columns unchanged.

## Migration and rollback
- Version: `schema_version` 1, additive | Existing rows: none touched | Regenerate committed data: no | If it fails halfway: CSVs are written to a temp name and renamed, so previous CSVs stay intact (the framework rule).

## Architecture areas changed
- None in `architecture/<area>.md`; process tooling. Known Gap (extends the framework's containment entry) is proposed in the branch state.
