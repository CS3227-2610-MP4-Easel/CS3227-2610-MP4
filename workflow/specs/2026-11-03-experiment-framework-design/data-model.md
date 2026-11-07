# Data Model

Files on disk, no database. Paths resolve from `EXP_ROOT` ([runtime.md](runtime.md)). JSON uses two-space indent, UTC ISO-8601 times, money in USD with 4 decimals. Committed: `arms/`, `tasks/`, `experiments/`, `rubric/`, `plugins/`, `harness/`, `config.json`, `pricing.json`. Gitignored: `local/` (holds `runs/`, `bank/`, `experiments/<id>/state.json`). Run clones live under `worktrees_root`.

## Entities
| Entity | Attribute | Type | Null | Default | Range / rule |
|---|---|---|---|---|---|
| Config (`config.json`) | worktrees_root | path | no | `../exp-runs` | outside the repo or covered by `git check-ignore` |
| | claude_bin | path | no | `claude` | resolved to the real executable, never a shell shim |
| | auth_mode | enum | no | `login` | `login` or `api_key` (Q1) |
| | isolation_ignore | string[] | no | `[]` | names skipped in the F4 comparison |
| Arm (`arms/<id>.json`) | id | string | no | - | `[a-z0-9-]{3,24}`, equals the file name |
| | stage | enum | no | `specplan` | `specplan`, `implementation`, `ablation`, `model_tier`; v1 runs only `specplan` |
| | prompt | string | no | - | template with `{{brief}}` and `{{task_id}}` only |
| | plugins, skills, agents, mcp | string[] | no | `[]` | plugins under `plugins/`; everything else disabled |
| | allowed_tools, disallowed_tools | string[] | no | `[]`, `[WebFetch, WebSearch]` | tool names |
| | permission_mode | enum | no | - | any value except bypass-all |
| | model | map role to id | no | - | role `main` plus one per listed agent; every id in `pricing.json` |
| | instruction_files | string[] | no | `["AGENTS.md","CLAUDE.md"]` | files kept in the clone besides the listed skills and agents |
| | artifact_globs | object | no | - | `spec` and `plan`, each a list of repo-relative globs |
| | lint | bool | no | `false` | true only for arms whose artifacts use the lite spec and plan format |
| | review | object | no | `{lenses: [], agent_types: [], max_rounds: 0}` | `max_rounds` 0-2 |
| | phase_map | map name to phase | no | `{}` | phases `spec`, `plan`, `review`, `other` |
| Task (`tasks/<id>/task.json`) | id | string | no | - | `[a-z0-9-]{3,24}` |
| | base_commit | string | no | - | hex sha of 7-40 characters that exists in the repo |
| | brief_file, sheet_file, issues_file | path | sheet, issues null | - | relative to the task folder, no `..` |
| | stage | enum | no | `specplan` | equals the stage of every arm run on it, else exit 3 |
| Seeded issue | id, category, text, anchor | string | no | - | category in `collision`, `contradiction`, `missing_limit`, `vague_term`, `wrong_path`, `missing_error`, `tenancy`; `anchor` is a string found in the brief or sheet |
| | blocking | bool | no | - | |
| Experiment (`experiments/<id>.json`) | id, task_ids, arm_ids | strings | no | - | ids exist |
| | replicates | int | no | 3 | 1-10 |
| | answer_mode | enum | no | `sheet` | `sheet` or `bank` |
| | max_parallel | int | no | 3 | 1-6 |
| | run_ceiling_usd, batch_ceiling_usd | decimal | no | none | above 0, required |
| | turn_timeout_s, run_timeout_s, wait_timeout_s | int | no | 1800, 5400, 86400 | above 0 |
| | hypotheses, decision_rule | string | no | - | text; the operator applies `decision_rule` |
| | pruning_rule | enum | no | `dominance` | the structured rule in runtime.md |
| Run (`local/runs/<run-id>/manifest.json`) | run_id, experiment_id, task_id, arm_id, rep | strings, int | no | - | run id format in conventions.md |
| | status | enum | no | `queued` | see Lifecycle |
| | abort_reason | enum | yes | null | `isolation_mismatch`, `budget`, `turn_cap`, `timeout`, `containment`, `crash` |
| | hashes, versions, model ids, bank hash | strings | no | - | N2 |
| | flags | string[] | no | `[]` | `truncated`, `secret_in_artifact`, `judge_same_model`, `judge_unstable`, `judge_error`, `answerer_error`, `review_cap_exceeded`, `missing_artifact`, `lint_not_applicable` |
| Event (`events.csv` row) | run_id, seq, message_id, agent_id, parent_id, model, phase | strings | parent null for main | - | one row per distinct message id |
| | in_tok, out_tok, cache_read_tok, cache_write_tok | int | no | 0 | 0 or more |
| | tools, started, ended, cost_usd | string, time, time, decimal | cost null | - | cost null only when the model is unpriced mid-run |
| Run state (`local/runs/<id>/state.json`) | status, session_id, turn_state, turn_count, question_count, last_prompt_hash, wait_started, spend by cost class, file hashes | mixed | session_id null before the probe | - | session_id is a UUID; turn_state `idle` or `in_turn` |
| Experiment state (`local/experiments/<id>/state.json`) | arm_codes, batch_spend_usd by cost class | map, decimal | no | assigned at first run | stable per experiment; `exp queue` shows the code, never the arm id |
| Queue item (`local/queue/<qid>.json`) | qid, run_ids, text, suggested_bank_id, bank_id, created | strings | suggested_bank_id, bank_id null until answered | - | text sanitized; `bank_id` set by `exp answer` |
| Approvals (`<user config dir>/exp-harness/approvals.json`) | arm_id, approval_hash | strings | no | - | hash covers the arm file, plugin directory contents and `config.json`; outside the repo |
| Question (`questions.jsonl`) | run_id, turn, text, source, bank_id, issue_id, issue_alt, note | strings | bank_id, issue_id, issue_alt, note null | - | source in `sheet`, `bank`, `assumption`, `operator`; text capped at 2000 characters |
| Bank entry (`bank/<id>.json`) | id, question, answer, answered_by, created, supersedes | strings | supersedes null | - | append-only |
| Grade (`grades.json`) | lint_errors_spec, lint_errors_plan | int | no | - | |
| | issues | map issue id to outcome | no when a seeded file exists | - | `raised_as_question`, `resolved_in_artifact`, `missed` |
| | rubric_spec, rubric_plan, rubric_gap | decimal | judge_error leaves null | - | 0-20 |
| | review_rounds, fix_iterations | int | no | 0 | formulas in runtime.md |
| Pricing (`pricing.json`) | model | string | no | - | one entry per model id |
| | input, output, cache_read, cache_write_5m, cache_write_1h | decimal | no | - | USD per million tokens |
| | source, checked | string, date | no | - | a price older than 30 days at batch start prints a warning (injected clock in tests) |

Fixed assumption text (sheet mode, answerer says not covered): `Not covered by the brief. Use your best judgement, state the assumption in the artifact, and continue.`

## Keys and relationships
| From | To | Cardinality | On delete | Ownership / tenancy scope |
|---|---|---|---|---|
| Experiment | Run | 1 to many | runs kept | local operator only |
| Run | Event, Question, Grade | many, many, 1 | removed with the run folder | local operator only |
| Question | Bank entry | many to 0..1 | entry kept | shared by the runs of one experiment |

## Lifecycle
| From state | To state | Triggered by | Guard |
|---|---|---|---|
| queued | running | `exp run` | preflight and isolation probe passed, batch ceiling not reached |
| running | waiting_operator | driver | `bank` mode, no match |
| waiting_operator | running | driver | an answer for the question exists |
| running | done | driver | `EXP-DONE` seen |
| running, waiting_operator | aborted | driver | an `abort_reason` applies |
| done, aborted | extracted | `exp run` end or `exp extract` | transcripts copied, events written |
| extracted | complete | `exp grade` | status `extracted` and not `aborted` |

An aborted run is extracted (its cost counts) and appears in `runs.csv` with grade fields empty; it never becomes `complete`. A crash is `aborted` with reason `crash`; there is no `failed` state.

## Invariants
- A run's token totals equal the sum of its event rows, and the rows equal the independent count of distinct message ids in the copied transcript.
- `agent_s = wall_s - wait_s - answerer_s`.
- Bank entries are append-only; a correction is a new entry whose `supersedes` names the old one.
- Committed files never contain transcript text, bank text or question text.
- `local/` and the run clones are never committed.

## Reports (committed under `docs/telemetry/experiments/`)
- `runs.csv`: run_id, experiment_id, task_id, arm_id, rep, status, abort_reason, flags, model_main, wall_s, wait_s, answerer_s, agent_s, in_tok, out_tok, cache_read_tok, cache_write_tok, peak_prompt_tok, cache_read_share, arm_cost_usd, answerer_cost_usd, matcher_cost_usd, judge_cost_usd, probe_cost_usd, overshoot_usd, questions, questions_operator, issues_raised, issues_resolved, issues_found, issues_missed, lint_errors_spec, lint_errors_plan, rubric_spec, rubric_plan, rubric_gap, rubric_total, review_rounds, fix_iterations.
- `events.csv`: the Event columns for every extracted run.
- `medians.csv`: experiment_id, task_id, arm_id, n, n_aborted, then `med_` plus each of arm_cost_usd, agent_s, in_tok, out_tok, peak_prompt_tok, questions, issues_found, lint_errors_spec, lint_errors_plan, rubric_spec, rubric_plan, rubric_total, review_rounds, fix_iterations; `min_` and `max_` for arm_cost_usd and rubric_total; then `gm_` for arm_cost_usd, agent_s, total_tok, with `gm_excluded`, `single_task`, `verdict` (per arm pair, see runtime.md). Aborted runs count toward cost medians and `n_aborted`, not toward quality medians.

## Migration and rollback
- Version: `schema_version` 1 in every manifest | Existing rows: none | Regenerate committed data: no | If it fails halfway: files are written to a temp name and renamed, so the previous CSVs stay intact.

## Architecture areas changed
- None in `architecture/<area>.md`; the framework is process tooling. A Conventions entry for the layout is proposed in the branch state when the build lands.
