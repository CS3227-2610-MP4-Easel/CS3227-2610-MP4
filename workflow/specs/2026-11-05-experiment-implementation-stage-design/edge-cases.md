# Edge Cases and Non-Happy Paths

IDs are permanent: never reuse or renumber. Every F requirement and every API error appears in at least one row. Test layers use the framework's fake CLI (`fixtures/fake-claude.mjs`, whose steps can write files into the working directory) and a toy implementation task with a toy adapter, which T2 adds to the testkit; no test calls a real model.

## Snapshot input
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1 | `exp snapshot` on a run with status `extracted`, or an unknown run id | Exit 2, message names the run id and its status, nothing written | A plan from an unfinished run is not a fixed input | unit |
| E2 | F1 | Source run folder has a spec file but no plan file, or carries `missing_artifact` or `cost_mismatch` | Exit 2, nothing written | The implementer would build from a half plan, or on a cost figure that is not trusted | unit |
| E3 | F1 | Snapshot target exists with a different hash | Exit 2, the existing snapshot untouched | Results already recorded stay tied to the plan they used | unit |
| E4 | F1 | A plan file contains a key pattern | Exit 9, nothing written, the pattern type is named and the value is not | Plans are agent output and may echo an environment value | unit |
| E5 | F1 | A snapshot path is absolute, has a drive letter, `..`, a `:`, a reserved device name, or is a symlink | Exit 2, nothing written | A plan file name must not write outside the destination or into the clone at another place | unit |
| E6 | F1 | A plan file contains `curl http://x`, `~/.ssh` or a 300-character base64 blob | Exit 2 listing file and line; with `--accept-findings` the snapshot is written and the hits stay in the output | Plan text is the implementer's instruction; a poisoned plan is an injection route | unit |
| E7 | F1 | A snapshot with one plan file in two folders (`kind` plan) | `plan_path` is the first plan-kind file in `files` order; all are placed in the clone | The prompt needs one entry point and the plan may span files | unit |

## Task and experiment validation
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E8 | F2 | Task lists an adapter path that does not exist, a `checks` entry with no `argv`, or a check argv that is a string | `exp check` exits 3 and names the field | A run must not start on a half-defined task | unit |
| E9 | F3 | Experiment lists a plan id with no snapshot, no adapter, or twice | Exit 3 before any call, names the plan id | A run must not start on a plan nobody froze | unit |
| E10 | F3 | `samples` 0 or 6, `attempts` 3, `max_questions` 11, `max_parallel` 4, `plans` empty or above 12, a prompt with `{{brief}}` | Exit 3, names the field and the range or placeholder | Out-of-range counts change cost and the meaning of pass@2 | unit |
| E11 | F3 | A file inside a snapshot is edited after the experiment file was committed (its `snapshot.json` is unchanged) | Exit 7 before any call, names the plan id and the file | Same plan must be built every time | unit |
| E12 | F3 | An adapter or `checks.json` is modified in the working tree, or differs from the manifest on `--continue` | Exit 7, names the file | Results must come from one adapter | unit |
| E13 | F3, F14 | An implementer arm or review model has no entry in `pricing.json` | Exit 3 before any call | A missing price corrupts the cost columns | unit |

## Baseline
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E14 | F4 | Baseline typecheck has 2 errors | `exp baseline` exits 3, prints the first 10 lines, writes no file | A broken base makes every build look red | integration |
| E15 | F4 | Baseline test files exit non-zero with no `ok` lines | Exit 3, names the file | A runner that cannot run gives no baseline | integration |
| E16 | F4 | A baseline test passes in the first run and fails in the second | Recorded in `flaky_tests` and excluded from the pass rule | A flaky test would fail builds at random and break N2 | integration |
| E17 | F4, F3 | `exp run` with no baseline file, or with a changed `checks_sha256`, `setup_sha256` or `lockfile_sha256` | Exit 3 naming `exp baseline` | A stale baseline makes `newly_failing` wrong | unit |
| E18 | F4 | The setup command fails, or a check times out in the baseline | Exit 3, names the command | A baseline that cannot be built gives no reference | integration |

## Agent clone and turn
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E19 | F5 | `git log --all`, `git tag` and `git branch -a` in an agent clone | Two commits (`base`, `plan`), no tags, one branch | No history, no acceptance files in objects, no other arm's plan | integration |
| E20 | F5 | A plan path collides with a tracked base file | Exit 3 naming the path | The plan would overwrite source | unit |
| E21 | F5 | Two samples of one plan | Two separate folders; no path shared | Independence of samples | integration |
| E22 | F6, E21 | A turn runs a command whose text names another run's clone, `EXP_ROOT`, `local/` or `~/.claude` | `outside_clone_access` set; every attempt of the run is red | Reading hidden checks or siblings breaks the measure | integration |
| E23 | F6 | A detached child is still running at the end of a turn | Swept; if it cannot be killed the run aborts `containment`, exit 10 | A survivor can touch the clone during checks | integration |
| E24 | F6 | The isolation probe returns an unexpected tool or hook | Exit 4 before the task prompt | Same arm configuration as claimed | integration |
| E25 | F7 | A fake CLI asks 6 questions, `max_questions` 5 | 5 answered with the fixed text, the 6th aborts `turn_cap`, `plan_gap_questions` 5 | A plan that makes the agent ask forever must stop | integration |
| E26 | F7 | One question in attempt 1 and 4 in attempt 2 | Total 5, within the limit; the next one aborts | The limit is per sample | integration |
| E27 | F7 | Two empty replies in a row | Abort `turn_cap` as in the framework | A stuck agent must stop | integration |
| E28 | F7 | The agent ends with a status line such as "waiting for the subagent" | The framework classifier decides; if it says `question` it is answered and counted | Known classifier limit, recorded in Known Gaps of the branch state | unit |
| E29 | F7, F12 | `IMPLEMENTATION-NOTES.md` has 2 bullets under `## Skipped`, one under a second `## Skipped` heading, or is missing | 2, then the first heading only, then 0 | The metric must not depend on formatting luck | unit |
| E30 | F7, F15 | The notes file exceeds 20000 characters | Cut at 20000 for parsing and review; flag `output_truncated` | An unbounded file | unit |

## Verify tree and checks
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E31 | F8 | The agent patched a file in its clone's `node_modules` | The verify tree has the pristine toolchain; the patch has no effect | A patched compiler would pass everything | integration |
| E32 | F8 | The agent changed a dependency or the lockfile | The verify tree runs `npm ci --ignore-scripts` from the agent's lockfile; `deps_changed` set | A plan may need a package; lifecycle scripts must not run | integration |
| E33 | F8 | Acceptance files while the agent runs, on `--continue` after a kill in `checking` | Never in a clone; `--continue` deletes any verify tree, re-runs the checks, starts no agent turn, charges nothing twice | A kill must not leak the checks | integration |
| E34 | F8 | Typecheck fails | The lint, test and shared steps still run and are recorded | Full results feed the feedback | unit |
| E35 | F8 | An own-test file name starts with `-` or holds a control character | The attempt is red; the file is not passed to the runner | Option injection into the test runner | unit |
| E36 | F8, F15 | A check exceeds its timeout, or the attempt exceeds `check_total_s` | Process tree killed, `check_timeout`, the attempt is red | A hung test must not hang the batch | integration |
| E37 | F15 | A check prints 20 MB | Killed at 10 MB, `output_truncated`, the attempt is red | Memory and disk exhaustion | integration |
| E38 | F15 | The agent clone exceeds `max_clone_mb` after a turn | The run aborts `disk`, no checks | Disk exhaustion | integration |
| E39 | F8, N3 | Check output contains a key pattern | That attempt is red with `secret_in_check_output`, the output is not stored, the batch continues and the final exit is 9; `--continue` does not repeat the check | The agent must not be able to stop the batch by printing a pattern | integration |
| E40 | F8 | `lines` of a failing check exceed 40 lines or 300 characters | Cut to those limits | Feedback and files stay bounded | unit |

## Pass rule
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E41 | F10 | The agent adds `tests/pinned-note.test.ts` | Not a protected change | A new test under a protected glob is what the plan asks for | unit |
| E42 | F10 | The agent edits `src/be/api/tsconfig.json`, deletes or edits an existing test, or changes `.git/config` | `protected_modified` lists it; red | Editing the checks is cheating | unit |
| E43 | F10 | The agent changes the `scripts` of `package.json` | No effect on any check (the harness runs its own commands); not a protected change | SD5 | unit |
| E44 | F10 | The build adds no test file, or only skipped or pending tests | Red | A build with no tests passes trivially | unit |
| E45 | F10 | A test that passed at baseline fails or is missing after the build | Listed in `newly_failing` or `missing`, red | Regressions count | unit |
| E46 | F10 | A test failing at baseline still fails, or a flaky one fails | Not counted as newly failing | Baseline faults are not the plan's fault | unit |
| E47 | F10, F5 | The agent deletes or edits a plan file | `plan_modified` lists it; red; restored before attempt 2 | The agent must not edit its instructions | integration |
| E48 | F10 | An own-test file does not load (syntax error), or two tests share a name in one file | `<file>::load` failed test; duplicate ids get `#2` | Counting must be exact | unit |
| E49 | F11 | Attempt 1 green | No attempt 2; `green_attempt` 1, `pass1` and `pass2` true | A second attempt after a pass would cost money and change the result | unit |
| E50 | F11 | Attempt 1 red, `attempts` 1 | No attempt 2; `pass2` false | The experiment file decides how many attempts count | unit |
| E51 | F11 | Attempt 2 also red | `pass2` false, no attempt 3, the review still runs, `cost_to_green_usd` empty | Two attempts is the cap | unit |
| E52 | F11 | Attempt 2 feedback with a protected edit and a failed required check | The prompt holds the exact template text, the restored paths, and the check's `requirement` sentence, never check code | A retry with no information measures luck; showing code lets the agent write to the check | unit |
| E53 | F11 | `--continue` after a kill between attempt 1 checks and the attempt 2 turn | Resumes at attempt 2 from `checks/attempt-1.json`; attempt 1 is not run again; `attempt2_started` is set once | Cost and result must not double | integration |

## Shared checks
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E54 | F9 | The adapter imports a module the build did not create | The checks that need it are `error` with `module missing`; the run is graded | A plan that was not followed is a fail, not a crash | integration |
| E55 | F9 | The adapter throws anything else, exits early, writes no verdict file, or omits a CHK id | Missing ids `error`, flag `adapter_error`, red | A broken adapter must not read as a pass | integration |
| E56 | F9 | A required check is `error`, an informational check fails | `error` counts as failed for F10; the informational failure is only counted in `shared_info_failed` | CHK5, CHK7 and CHK8 depend on decisions the brief leaves open | unit |
| E57 | F9 | The agent's diff contains `process.exit`, `process.stdout` or `EXP_` | `result_tampering_suspected` set; red | Forged verdicts | unit |
| E58 | F9 | The agent's code writes a verdict-shaped JSON to stdout or to a file in the clone | Ignored; only the nonce-named file outside the verify tree is read | Forged verdicts | integration |
| E59 | F9 | A plan declares routes but never mounts them, and its adapter tests the plan's declared service layer | The checks pass at the layer the plan names as its deliverable; a missing route is not tested | The `full` plan states that no route is live until a later workstream | integration |
| E60 | F9 | Notes created in the same millisecond | The adapter's `clock.tick()` gives each a distinct time | CHK2 must not tie | unit |
| E61 | F9 | CHK4 and the second pin is rejected | CHK4 fails (the second pin must be accepted) | A vacuous pass | unit |

## Plan adherence and review
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E62 | F12 | One file created outside `planFiles`, one listed file missing | `files_off_plan` 1, `plan_files_missing` 1 | Shows how far the build strayed from the plan | unit |
| E63 | F12 | The only extra files are the notes file and a lockfile, or `dist/` output | `files_off_plan` 0 | Expected files and build output | unit |
| E64 | F12 | The plan has 3 lines with the word GATE and the notes list 1 skipped | `gates_in_plan` 3, `gates_skipped` 1 | The agent-reported figure is cross-checked | unit |
| E65 | F13 | The diff exceeds 80000 characters | Cut at 80000, `diff_truncated` | A cheap model that writes much code must not blow the review cost | unit |
| E66 | F13 | The diff, notes or a file name contains the nonce or an instruction to the reviewer | The nonce is regenerated until absent; the text sits only between the delimiters; scripted findings are stored as returned | The diff is agent-written text | unit |
| E67 | F13 | Review output not parseable after the retry, the clone is missing, or the batch ceiling is reached | `review_error`, empty findings, grade written | One bad call must not block the report | unit |
| E68 | F13 | Review returns an unknown category or severity, control characters, or a 900-character field | `other` and `minor`, controls stripped, cut at 500 | Review text is untrusted and goes to `grades.json` | unit |
| E69 | F13 | Review text contains a key pattern | `review_error`, nothing stored, final exit 9 | Review text is model output and may echo a value | unit |
| E70 | F13, F10 | The review reports a blocker on a green run | `green`, `pass1` and `pass2` unchanged | The review is advisory | unit |

## Cost and reports
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E71 | F14 | A run exceeds `run_ceiling_usd` mid-attempt | Aborted `budget`, attempts after it not started, cost counted, no check result for the cut attempt | The ceiling is the owner's cost limit | integration |
| E72 | F14 | Batch ceiling reached, including review calls | Remaining runs stay `queued`, exit 5 | The batch ceiling is the owner's cost limit | integration |
| E73 | F14, N1 | Attempt 2 resumes the same session | The comparison with the CLI is the sum of the final `total_cost_usd` per session; a gap above 2% sets `cost_mismatch` | The CLI total is cumulative per session | integration |
| E74 | F14 | A question turn inside attempt 1 | Its events belong to attempt 1 (`impl_cost_usd`) | Attribution rule | unit |
| E75 | F14 | Plan 1.0000, samples 0.3000 (green at attempt 2) and 0.2000 (never green) | `pass1_count` 0, `pass2_count` 1, `expected_cost_to_green_usd` 1.5000, `note` `underpowered` | The estimator in SD6 | unit |
| E76 | F14, N4 | Plan with `pass2_count` 0, or fewer finished runs than `samples` | `expected_cost_to_green_usd` empty and `no_green`; `incomplete` added; order `underpowered;no_green;incomplete` | A plan that never passes has no finite expected cost | unit |
| E77 | F14 | An aborted run among a plan's samples | Counted in `n`, `n_aborted`, the cost sums; `pass1` and `pass2` false; check columns empty | Aborted runs cost money and must not vanish from the rates | unit |
| E78 | F14 | A plan id or flag that starts with `=` | The CSV cell is prefixed with `'` | Spreadsheet formula injection | unit |
| E79 | F14, N4 | A key pattern in any report output | Exit 9, no rename, the type is named, the value is not | Reports are committed | unit |
| E80 | F14 | No finished runs | Exit 2 | An empty report is a usage error | unit |
| E81 | N2 | `exp grade` run twice, once after the agent clone was deleted | Identical pass fields; the second review block empty with `review_error` | Grading is a pure function of `checks/` | integration |
| E82 | F2 | `exp grade` on a run that is not `extracted` | Exit 2 | Only extracted runs have finished checks | unit |

## Security: threat list (Attacker lens)
| ID | Requirement | Actor and abuse | Mitigation | Test layer |
|---|---|---|---|---|
| E83 | F5 | The agent recovers hidden files or other arms' plans from git objects | History-free clone (E19) | integration |
| E84 | F8 | The agent hides edits from git (`assume-unchanged`, `info/exclude`) or sets `core.fsmonitor` or a hook to run a command in a harness git call | The harness never uses the clone's git; it hashes bytes (F8); a changed `.git/config`, hook or `.gitattributes` is `protected_modified` | integration |
| E85 | F8 | A patched `node_modules`, `.bin` or `.npmrc` | The verify tree has the pristine toolchain (E31) | integration |
| E86 | F9 | Forged verdicts, or acceptance files copied out at check time | The verify tree is deleted after the attempt; the verdict channel is a nonce-named file outside it (E58); residual: agent code runs in the same process as the adapter, so `result_tampering_suspected` is a detector, not a proof | integration |
| E87 | F6 | A background process outlives its turn | End-of-turn sweep by command line and working directory (E23); T1 confirms the Windows behaviour | integration |
| E88 | F15 | Output, disk or time exhaustion | Caps (E36 to E38) | integration |
| E89 | F7, F13 | The notes file, plan text or file names inject into the reviewer or inflate metrics | Everything inside nonce delimiters (E66), caps, `gates_skipped` labelled agent-reported and cross-checked (E64) | unit |
| E90 | F6 | The agent reads credentials or the operator's repo during its turn, or the plan tells it to | Not blocked: no sandbox. Mitigations: plan scan (E6), the prompt rule, outside-clone detection (E22), containment hashes, an explicit operator acknowledgement at the T1 and T8 gates, and the recommendation of a separate low-privilege user | review |
| E91 | F6 | The agent calls the network or sends data out | Not blocked; recorded as a Known Gap in the branch state | review |
| E92 | F10 | Sample 2 copies sample 1's solution | Separate folders (E21), outside-clone detection (E22) | integration |
| E93 | F2 | A task or experiment file names a command outside the clone, or an argv with a shell string | Argv arrays from committed files only, no shell (E8) | unit |
