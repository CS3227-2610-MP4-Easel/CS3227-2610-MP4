# API

Interface: the command line `node workflow/experiments/harness/exp.mjs <command>` (written `exp` below). No network service, no accounts. Caller for every command: the operator on their own machine; the authorization rule is file-system access to the repo. Tenancy: single operator, no cross-tenant data. Compatibility: no existing callers. Tests assert both the exit code and the `abort_reason` in `state.json`.

## Exit codes
| Code | Meaning |
|---|---|
| 0 | success; for `exp run`, every run reached `complete` or `extracted` without an abort |
| 2 | usage error (unknown command, missing argument, run id exists, status not valid for the command) |
| 3 | configuration invalid (schema, missing file, unpriced model, unsafe path, clone path over 200 characters) |
| 4 | isolation mismatch |
| 5 | budget ceiling reached (run or batch) |
| 6 | run failed (crash, timeout, turn cap) or a model call returned unusable output |
| 7 | experiment file not committed or modified |
| 8 | stage not supported in this version |
| 9 | credential pattern found in an output that would be committed |
| 10 | containment violation |

For a batch with mixed outcomes `exp run` exits with the highest code among its runs and prints a table of run id, status and reason.

## exp check [--secrets]
| Field | Definition |
|---|---|
| Inputs | none; `--secrets` also scans `docs/telemetry/experiments/` and `experiments/` for the credential patterns |
| Outputs | one line per file (path, `ok` or the schema error); CLI, Node and harness versions; `git check-ignore` result for `local/` and `worktrees_root` |
| Errors | invalid file, unsafe path, unpriced model, pilot seeded set failing F16 -> 3; pattern with `--secrets` -> 9 |
| Idempotency | read-only |
| Logging | paths and errors, never file contents |

## exp run <experiment-id> [--task T] [--arm A] [--rep N] [--dry] [--yes] | exp run --continue <run-id>
| Field | Definition |
|---|---|
| Inputs | experiment id; optional filters; `--dry` runs preflight and prints planned run ids; `--yes` accepts an arm whose plugin and tool list was not seen before (otherwise the list is printed and exit 2) |
| Outputs | `local/runs/<run-id>/` with `manifest.json`, `state.json`, `transcript/`, `otel.log` when produced, `questions.jsonl`, `artifacts/`; at the end every terminal run is extracted |
| Errors | file not committed -> 7; stage not `specplan` -> 8; invalid config -> 3; isolation -> 4; ceiling -> 5; crash, timeout, turn cap -> 6; containment -> 10; `--rep N` whose run exists -> 2 |
| Idempotency | without `--rep`, creates the next free rep up to `replicates`, then exits 0 with a note; `--continue` resumes a non-terminal run once |
| Transaction boundary | each run is independent; the batch ceiling stops starting new runs, running ones finish |
| Logging | run id, status transitions, spend; never prompt text, keys or environment values |

## exp queue [--experiment E] [--audit]
Lists paused questions: question id, run code (`A`, `B`, `C` from the experiment's `arm_codes`, never the arm id), sanitized text, age, and the suggested duplicate if any. `--audit` lists every automatic exact match with both texts. Read-only.

## exp answer <question-id> (<text> | --file <path> | --stdin | --same-as <bank-id>)
| Field | Definition |
|---|---|
| Inputs | a question id; non-empty text up to 4000 characters, or an existing bank id |
| Outputs | a bank entry (or a link to the existing one); runs paused on that question or an exact match resume |
| Errors | unknown id, empty or oversize text, unknown bank id -> 2 |
| Idempotency | a second answer creates an entry with `supersedes`; finished runs are not re-run |
| Logging | question id, bank id, number of runs resumed; never the answer text |

## exp extract <run-id>
Copies and hashes the transcripts, writes `events.csv` and `usage.json` beside the manifest. Status must be `done`, `aborted` or `extracted`, else exit 2. A truncated last line sets the `truncated` flag. Idempotent.

## exp grade <run-id>
Needs status `extracted` and not `aborted`, else exit 2. Runs lint from the main checkout over artifact copies, scans artifacts for credentials, calls the judge twice for the spec and twice for the plan, and writes `grades.json`; sets status `complete`. Unusable judge output after one retry sets `judge_error`, leaves rubric fields null and exits 6. Judge cost counts toward the batch ceiling; exceeding it -> 5.

## exp report <experiment-id>
Writes the three CSVs through temp files and renames. Runs without grades are listed and skipped for quality columns. A credential pattern in any output -> 9 and nothing is renamed. Prints dominated arms and `inconclusive` rows.

## Security
- Spawning: the harness resolves the real `claude` executable, passes arguments as an array without a shell, and sends prompts through stdin (N7).
- The arm's agent runs in its own clone with the environment allowlist and the containment checks of runtime.md (F17).
- Answerer, matcher and judge receive only their stated inputs, with random-nonce delimiters, no tools and a neutral directory (N4).
- Agent output is untrusted: it is capped, stripped of control characters before printing, and treated as data in every prompt.
- `ANTHROPIC_API_KEY`, in API-key mode, is read from the environment and never written to a file or log.
- `exp answer` text never appears in argv logs when `--file` or `--stdin` is used; the operator chooses.
- The bank is trusted operator input and is not re-sanitized when replayed.
