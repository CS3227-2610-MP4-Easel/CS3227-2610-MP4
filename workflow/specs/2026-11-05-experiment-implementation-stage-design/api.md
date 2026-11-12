# API

The command line only; no network surface. Principal: the local operator, running `node workflow/experiments/harness/exp.mjs`. Exit codes are the framework's (2 usage, 3 config, 4 isolation, 5 budget, 6 run failed, 7 experiment, inputs or hashes changed or not committed, 8 unsupported stage, 9 credential in output, 10 containment). Exit 8 for stage `implementation` is removed by this stage; it stays for `ablation` and `model_tier` (a regression test pins that).

## `exp snapshot <run-id>... [--accept-findings]`
| Field | Definition |
|---|---|
| Caller and principal | Operator; no role |
| Authorization rule | Reads only `local/runs/<run-id>/artifacts/`; writes only under `local/plans/` |
| Tenancy scope | Local files of one operator |
| Inputs | One or more run ids of `complete` spec-and-plan runs; a source run that carries `cost_mismatch` is refused |
| Outputs | One `snapshot.json` per run; stdout lists `plan_id` and the sha256 of each `snapshot.json` for pasting into an experiment file, and every scan hit with file and line |
| Errors | unknown run id, run not `complete`, flag `missing_artifact` or `cost_mismatch`, no spec file or no plan file, path refused by F1, scan hits without `--accept-findings` -> exit 2, nothing written; a credential pattern in a copied file -> exit 9, nothing written |
| Idempotency | Re-running on the same run rewrites an identical file; if the target exists with a different hash, exit 2 (never overwritten) |
| Transaction boundary | Files copied to a temp folder, then renamed |
| Events / audit | none |
| Logging | Prints paths, hashes and scan hits; never file text |
| Compatibility | New command |

## `exp baseline <task-id>`
| Field | Definition |
|---|---|
| Caller and principal | Operator |
| Authorization rule | Runs only commands from the committed `task.json` (N3 environment) |
| Tenancy scope | A harness-owned tree under `local/baselines/` |
| Inputs | A task with stage `implementation` |
| Outputs | `local/baselines/<task-id>.json` and the pristine tree; stdout the counts |
| Errors | task not found or wrong stage -> 3; setup command fails -> 3; typecheck or lint errors above 0 -> 3 with the first 10 lines; tests that cannot run -> 3; a check times out -> 3 |
| Idempotency | Rebuilds the tree and overwrites the file |
| Transaction boundary | Temp name then rename |
| Events / audit | none |
| Logging | Counts and the first lines of failures, credential-scanned (a hit exits 9, nothing written) |
| Compatibility | New command |

## `exp run <experiment-id>` (implementation experiments)
| Field | Definition |
|---|---|
| Caller and principal | Operator |
| Authorization rule | The experiment file, the arm file, the adapters and `checks.json` must be committed and unmodified; the snapshot hashes in the experiment file must match; the baseline must match the task (`checks_sha256`, `setup_sha256`, `lockfile_sha256`); the arm approval hash must match; the manifest records the adapter, `checks.json`, baseline and arm hashes for later comparison |
| Tenancy scope | One history-free agent clone per sample under `worktrees_root` |
| Inputs | `--dry` lists the run ids (plans x samples); `--continue` resumes; other flags as the framework |
| Outputs | Run folders as the framework plus `checks/attempt-<n>.json`; stdout one line per attempt: run id, attempt, green or not, cost |
| Errors | file changed or not committed, a snapshot file hash differs, or a manifest hash differs on `--continue` or before attempt 2 -> 7; baseline missing or stale at run start, invalid experiment, task, arm or an implementer or review model with no price -> 3; isolation mismatch -> 4; ceiling -> 5; run failed -> 6; run `containment` -> 10; a credential pattern in agent-controlled output (checks, review) does not stop the batch: that attempt is red with `secret_in_check_output` (or `review_error` for the review), nothing is stored, and the final exit is 9 |
| Idempotency | A run id that exists is skipped unless `--continue` names it. `--continue` first removes any acceptance folder and verify tree, then resumes at the recorded `attempt` and `attempt_state`: in `checking` it re-runs the checks only (no new agent turn, no second charge); in `agent` of attempt 2 it uses `checks/attempt-1.json` for the feedback |
| Transaction boundary | Per run: state written atomically at each attempt boundary |
| Events / audit | `state.json` and `manifest.json` as the framework |
| Logging | Run ids, counts, cost; never agent text, check output or code |
| Compatibility | The spec-and-plan path of `exp run` is unchanged; `driver.mjs` gains a stage switch and the validators a second experiment validator |

## `exp grade <run-id>` (implementation runs)
| Field | Definition |
|---|---|
| Caller and principal | Operator |
| Authorization rule | Reads the run folder, `checks/` and, for the review, the agent clone |
| Tenancy scope | Local |
| Inputs | A run in `extracted` |
| Outputs | `grades.json` with the fields in data-model.md; the review call's cost in `review_cost_usd` |
| Errors | run not `extracted` -> 2; review output unparseable after the retry, the clone missing, or a credential pattern in the review text -> flag `review_error`, grade written without findings, exit 0 (the credential case exits 9 at the end of a batch only); batch ceiling reached before the review -> grade written without a review, flag `review_error`, exit 5 |
| Idempotency | Pass fields are a pure function of `checks/` and the manifest (N2); a second run replaces the `review` block and `review_cost_usd` |
| Transaction boundary | Temp name then rename |
| Events / audit | none |
| Logging | Counts only |
| Compatibility | The spec-and-plan path of `exp grade` is unchanged; `exp grade --self-test` is unchanged |

## `exp report <implementation-experiment-id>`
| Field | Definition |
|---|---|
| Caller and principal | Operator |
| Authorization rule | Reads run folders; writes `docs/telemetry/experiments/impl-runs.csv` and `impl-summary.csv` |
| Tenancy scope | Local |
| Inputs | An implementation experiment id; runs in `extracted` or `complete` are listed, others are left out |
| Outputs | The two CSVs; stdout one line per plan with `pass@1` and `pass@2` as counts, the expected cost to green, and the `note` values |
| Errors | no finished runs -> 2; credential pattern in any output -> 9, nothing renamed |
| Idempotency | Same input gives byte-identical CSVs except `review_*` columns |
| Transaction boundary | Temp name then rename |
| Events / audit | none |
| Logging | Counts only |
| Compatibility | Spec-and-plan `exp report` output and columns are unchanged |

## Security: checks, adapters and the verify tree
- Adapters and `checks.json` are committed, human-authored and hash-recorded; the harness never reads an adapter or a command from an agent clone or from agent text. Command arguments are argv arrays from committed files, run without a shell; the harness appends test files after `--` only.
- Check commands come only from `task.json` (the agent cannot change which commands run); checks run only on the verify tree (a harness-made copy of source files, with a copied pristine toolchain), never in the agent clone. Only the adapter is in the verify tree, after a clean process sweep, and the tree is deleted after each attempt. The builder never follows links, never copies unsafe names or an agent `.npmrc`, and validates an agent lockfile before installing.
- The shared runner's parent process lives outside the verify tree and decides every verdict; agent code runs only in a host child that answers adapter calls over IPC. There is no verdict file. `checks.json` and the check assertions are never in the verify tree.
- The agent clone is history-free (F5). The harness reads only bytes of files in it, never its git state, config or hooks.
- Agent-written code runs only in the N3 environment with a timeout, output cap and process-tree kill, plus an end-of-turn sweep of processes whose command line or working directory is inside the clone.
- Residual risk (a Known Gap in the branch state): an agent turn has the operator's file access and network, and its own spend through `claude` or direct API calls is not in the run total. The harness detects reads and calls outside the clone by scanning tool calls, planted canary tokens and the containment hash set (extended with `local/baselines`, `local/plans` and `tasks/<id>/acceptance`); it cannot prevent them. At the T8 gate the operator chooses, in writing in the branch state, how the real batch is protected: (a) a separate low-privilege Windows user, or (b) an explicit acceptance of the exposure; and whether it runs on a dedicated API key with a console spend cap to bound spend the harness cannot see.
