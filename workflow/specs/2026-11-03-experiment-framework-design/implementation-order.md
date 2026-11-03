# Implementation Order

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T1 | Schemas, layout and `exp check` | validators for config, arm, task, experiment, pricing; path and id safety; `exp check` with `--secrets` and the credential patterns; `.gitignore` entry; test command in `workflow/config.json` | F1, F2, F15, F16 (checks), N3, N7 |
| T2 | Isolation and transcript spike (real model calls, a few cents) | verified flags for `--setting-sources`, `--plugin-dir`, MCP, permission mode; the init record's fields; the reference cost field in the JSON result; transcript location and subagent file layout; whether OpenTelemetry writes a file headless; Windows spawn of a native executable; the exact expected-set derivation written to `harness/isolation.md`; scrubbed real fixtures committed under `harness/fixtures/`; findings note in the branch state | F4, F9, N1 |
| T3 | Run launcher, driver and fake CLI | clone creation and preparation (no remotes, stripped and overlaid `.claude/`, instruction files), probe, headless driver, marker and question rules, timeouts, process-tree kill, containment snapshots, environment allowlist, ceilings, `manifest.json`, atomic `state.json`, `--continue`, `fake-claude.mjs` | F3, F4, F5, F6, F14, F17, N2, N7, N8 |
| T5 | Extractor | transcript copy and hash, dedupe, subagent linking, pricing, phases, metrics, `events.csv`, `usage.json` | F9, F10, N1, N5, N6 |
| T8 | Pilot bundle | task `pilot-pinned-note` (brief, answer sheet, 6 or more seeded issues with anchors), three arm files per runtime.md, pilot experiment file (hypotheses, decision rule, ceilings from Q1), `rubric/rubric.md` with anchors, three calibration artifacts with bands | F1, F2, F15, F16 |
| T4 | Sheet answerer and question log | sheet mode, fixed text, answerer self-test, question sanitizer, `questions.jsonl` | F7, F11, N4 |
| T6 | Grader | lint runner (from the main checkout), credential scan, seeded-issue judge, two-call rubric, review rounds, fix iterations, judge self-test on the calibration set | F12, N3, N4 |
| T10 | Bank, queue and pause-resume | bank, exact matcher, model suggestion, `exp queue`, `exp answer`, polling resume | F8, F11, N4 |
| T7 | Report | three CSVs, medians and geometric means, dominance and `inconclusive` | F13, N3 |
| T9 | Pilot run and review | GATE: 3 replicates of each arm; pass criteria below | N1, N5 |

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Schemas and check | - | T2 | 1 |
| T2 Isolation spike | - | T1 | 1 |
| T3 Launcher and driver | T1, T2 | T5, T8 | 2 |
| T5 Extractor | T1, T2 | T3, T8 | 2 |
| T8 Pilot bundle | T1, T2 | T3, T5 | 2 |
| T4 Sheet answerer | T3 | T6 | 3 |
| T6 Grader | T5 | T4 | 3 |
| T7 Report | T5, T6 | T10 | 4 |
| T10 Bank and queue | T4 | T7 | 4 |
| T9 Pilot run and review | T3, T4, T6, T7, T8 | - | 5 |

Shared-file hazards: T3 and T4 both edit `harness/driver.mjs` and T4 and T10 both edit `harness/answerer.mjs`; each pair is ordered by dependency, so they never overlap. T1 owns `harness/schema.mjs`; later tasks only import it. T6 and T7 read `grades.json` and write different files.

## T9 pass criteria
- At least 7 of 9 runs end `complete`; every other run is `aborted` for a recorded reason that is not `isolation_mismatch`, `containment` or `crash`, and has extractable data.
- At least 6 of 9 runs have a CLI reference total and every one is within 2 percent of the extracted arm cost.
- The judge self-test passes and no run has `judge_error`.
- The coefficient of variation of `arm_cost_usd` is reported per arm; above 0.5, that arm gets 2 more replicates (hard cap 5 per arm).
- The operator reads `runs.csv`, `medians.csv` and the dominated-arms list and decides which arms run on W7.

## Cut line and schedule
The pilot needs T1 to T9 without T10. T10 is needed only for the real W7 comparison. Nine tasks in five waves must land before the 10 Nov freeze; if time runs short, T10 and the OpenTelemetry cross-check move to the real-run plan. The real W7 task bundle and its run are not part of this plan: they start when W1 and its dependencies have merged, and get their own spec and plan.
