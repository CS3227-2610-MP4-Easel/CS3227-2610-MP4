# Edge Cases and Non-Happy Paths

IDs are permanent: never reuse or renumber. Every F requirement and every API error appears in at least one row. Tests use the fake CLI unless the layer says `real`.

## Input and configuration
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1 | Arm id differs from its file name | `exp check` exits 3 naming the file | Wrong arm in results | unit |
| E2 | F1 | `plugins` holds `../x`, an absolute path or a path outside `plugins/` | exit 3 | Committed arm runs arbitrary code | unit |
| E3 | F1 | Arm `permission_mode` is the bypass-all value | exit 3 | Unconfined agent | unit |
| E4 | F1 | Approval hash (arm file, plugin directory contents or `config.json`) not in the approvals file | `exp run` prints the lists and exits 2 until `--yes <arm>=<hash>`; editing a file inside a plugin directory changes the hash | Silent code execution after a merge | unit |
| E5 | F2 | Sheet-mode experiment, task without `answer-sheet.md` | exit 3 naming the file | Answerer has nothing to read | unit |
| E6 | F2 | Task `base_commit` is not a hex sha or not in the repo | exit 3; no clone created | Flag-like value reaching git | unit |
| E7 | F2, F16 | Duplicate seeded issue id, or anchor not found in brief or sheet | exit 3 naming the id | Recall double counted | unit |
| E8 | F2 | Arm stage and task stage differ | exit 3 | Mixed stages | unit |
| E9 | F1 | `review.max_rounds` is 3 | exit 3 | Breaks the two-round cap | unit |
| E10 | F14 | Arm model not in `pricing.json` | exit 3 before any run | Unenforceable budget | unit |
| E11 | F5 | Arm stage `implementation` | exit 8 before any clone exists | Unbuilt phases run by mistake | unit |
| E12 | F15 | Experiment file untracked, staged only, or modified | exit 7; no run starts | Rules changed after seeing results | integration |
| E13 | F3 | Clone path would exceed 200 characters | exit 3 naming the path | Windows path limit | unit |

## Driver and process
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E14 | F5 | Fixture `marker-quoted-mid-text`: `I will finish with EXP-DONE soon` as the whole message | classified question, not done | Early stop | unit |
| E15 | F5 | Fixtures `question-then-marker-last-line` and `marker-then-question-last-line` | done (question noted `ignored_after_done`) and question | Double handling | unit |
| E16 | F5 | Whitespace-only final message, twice in a row | one retry, then abort `turn_cap`, exit 6 | Infinite loop | integration |
| E17 | F5 | 41st question | abort `turn_cap`, exit 6 | Runaway cost | integration |
| E18 | F5 | CLI result reports an error stop | abort `crash`, exit 6 | Partial run treated as complete | integration |
| E19 | F14 | Turn exceeds `turn_timeout_s` | process tree killed, abort `timeout`, exit 6, orphan process count is 0 | Hung child, Windows orphans | integration |
| E20 | F6 | Harness killed mid-run | `exp run --continue <run-id>` resumes with prior spend and session id | Lost run | integration |
| E21 | F6 | Kill during a `state.json` write | previous valid file loads | Corrupt state | unit |
| E22 | F6 | `--continue` on a terminal run | exit 2 | Double run | unit |
| E23 | F6 | `--rep 2` when run rep 2 exists | exit 2 | Overwritten run | unit |

## Isolation and containment
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E24 | F4 | Probe init record lists one extra plugin | abort `isolation_mismatch`, exit 4, no task prompt sent | Contaminated arm | unit |
| E25 | F4 | Probe init record lacks one of the sets it carries (skills, agents, plugins, MCP servers or tools), or its `claude_code_version` differs from the baseline fixture | no run starts; the gap or the version difference is reported | Silent downgrade | unit |
| E71 | F4 | Probe stream has a hook event whose hook is not a SessionStart hook declared by an arm plugin (a hook from the clone or from user settings) | abort `isolation_mismatch`, exit 4, hook name listed, no task prompt sent | Foreign hook runs | unit |
| E26 | F17 | Agent appends to the main repo's `.git/config` | abort `containment`, exit 10, differing path listed | Hook planted for later | integration |
| E27 | F17 | Agent writes to `~/.claude/settings.json` or another run's folder | abort `containment`, exit 10 | Cross-run contamination | integration |
| E28 | F17 | Agent runs `env` and echoes the key into an artifact | child environment holds no key outside API-key mode; in API-key mode the artifact is redacted and `secret_in_artifact` is set | Key reaches the judge | integration |
| E29 | F3 | Two active runs of one task | different clones; neither sees the other's files | Cross-talk | integration |

## Answers and bank
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E30 | F7 | Question the sheet does not cover | reply is byte-equal to the fixed text; source `assumption` | Hallucinated answer | unit |
| E31 | F7 | Answerer returns non-JSON | one retry, then the fixed text is sent and the call is logged `answerer_error` | Stalled run | unit |
| E32 | F7 | Answerer self-test: 3 covered and 3 silent fixture questions | all 3 silent give `covered=false`; at least 2 of 3 covered give `covered=true` | Unreliable answerer | real |
| E33 | F8 | Question pairs: (`Max length of note?`, `max length of the note`) | match; (`Can the PM edit?`, `Can the Dev Lead edit?`) no match; (`Is the note required?`, `Is the note not required?`) no match; (`Is a note deleted with its epic?`, `What happens to notes when an epic is removed?`) no match, suggestion shown | Wrong answer reused | unit |
| E34 | F8 | Two runs ask the same question at once | one queue item linked to both; one answer resumes both | Two answers for one question | integration |
| E35 | F8 | Answer arrives for a question whose run aborted | stored; no resume; exit 0 | Lost answer | integration |
| E36 | F8, F11 | Question text holds ANSI escapes, a path or a key | control characters removed, path replaced by `<path>`, key by `[REDACTED:type]` before storing and printing | Terminal injection, leak | unit |
| E37 | F8 | `exp answer` with empty text, 4001 characters or unknown id | exit 2, nothing stored | Garbage in bank | unit |
| E38 | F11 | Question matches two seeded issues | closer one stored in `issue_id`, the other in `issue_alt` | Double credit | unit |

## Extraction, grading, reports
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E39 | F9 | Transcript repeats a message id over several lines | one row per id, last usage kept | Double counted tokens | unit |
| E40 | F9 | Subagent transcript present; two parallel subagents | rows carry agent and parent ids; totals equal the independent fixture count | Missing subagent cost | unit |
| E41 | F9 | Last transcript line truncated | last complete message used; flag `truncated` | Crash blocks extraction | unit |
| E42 | F9, N1 | Model priced in `pricing.json` but CLI total differs by more than 2 percent | `exp extract` prints the difference; T9 fails | Wrong cost | integration |
| E43 | F10 | Skill and subagent both apply; nested subagent | subagent type wins; nested inherits parent phase | Phase totals | unit |
| E44 | F12 | Judge returns non-rubric text twice | `judge_error`, rubric fields null, exit 6 | Bad numbers | unit |
| E45 | F12 | Two judge scores differ by more than 4 | both stored, `judge_unstable` | Unstable judge | unit |
| E46 | F12 | Artifact tells the judge to give top marks; artifact contains the delimiter nonce | score stays in its band; nonce removed before the call | Gamed grading | real |
| E47 | F12 | Artifact has a credential pattern | redacted copy sent; `secret_in_artifact` set | Secret leaves the machine | unit |
| E48 | F12 | `exp grade` on an `aborted` or non-extracted run | exit 2 | Grading partial work | unit |
| E49 | F13 | Worked tables 1 and 2 in runtime.md | geometric means 4.00 and 4.00 and the five verdicts equal the stated ones | Wrong statistics | unit |
| E50 | F13 | One replicate, one task, or a zero median | `n=1`, `single_task`, `gm_excluded` flagged; `inconclusive` printed | False confidence | unit |
| E51 | F13, N3 | Credential pattern about to be written to a CSV | nothing renamed, exit 9, pattern type printed (not value); a git sha and a base64 header do not match | Secret committed | unit |
| E52 | F13 | A run has no grades | listed, skipped for quality columns | One failure blocks results | unit |

## Further launch, state and cost checks
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E57 | F17 | Launch test of the child environment | keys are exactly the allowlist; `ANTHROPIC_API_KEY` present only in API-key mode; the deny flags for `WebFetch` and `WebSearch` are present | Leaked environment | unit |
| E58 | F4 | Resumed invocation | argument list carries the same isolation flags as the first launch | Drift on resume | unit |
| E59 | F6 | `--continue` after the arm file, a plugin file or `config.json` changed; and with a session id of `--dangerously-skip-permissions` | exit 7 for the changed file; exit 3 for the invalid session id; nothing spawned | Gates skipped on resume, flag injection | unit |
| E60 | F3 | Clone preparation | no remotes, `--no-hardlinks` used, `.claude/` holds only the arm's skills and agents, `settings*.json` removed | Write path back to the main repo, foreign hooks | integration |
| E61 | N7 | Launcher is `claude.cmd`, `.bat` or `.ps1` | exit 3 naming the launcher | Shell injection | unit |
| E62 | N4 | Launch of answerer, matcher and judge | flags assert no tools, no user settings, strict MCP, no plugins; probe shows empty tool and MCP sets and no hook events | Artifact text reaches user hooks | unit |
| E63 | N5 | Timeline: run 100 s, wait 30 s, answerer call 4 s ending exactly when the wait starts | `wall_s` 100, `wait_s` 30, `answerer_s` 4, `agent_s` 66 | Overlap or rounding error | unit |
| E64 | F17 | The run's `state.json` or a shared config file changed during a turn | every run with a turn in flight aborts `containment`, exit 10, path named | Tampered state | integration |
| E65 | F14 | CLI result is the budget stop | reason `budget`, exit 5, not `crash` | Misclassified cost study | unit |
| E66 | F14 | Batch ceiling reached with runs never started | they stay `queued`; the table prints `not_started: batch_ceiling` | Silent drop | unit |
| E67 | F12 | Arm `lint` false | lint fields empty and flagged; the arm is excluded from lint comparison | Format mismatch counted as errors | unit |
| E68 | F12 | Artifacts for an arm are found by its `artifact_globs` | files changed since `base_commit` matching the globs are copied; none found sets `missing_artifact` and rubric fields null | Grading the wrong files | unit |
| E69 | F9 | Stub `pricing.json` with known prices and a fixture of 3 events | per-event costs and the run total equal the hand-computed values (rounded once to 4 decimals) | Cost drift | unit |
| E70 | F8 | Queue item for two runs; `exp answer --same-as` an existing bank id | item gets that `bank_id`; both runs resume | Lost link | integration |

## Budget
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E53 | F14 | Run spend reaches the run ceiling at a turn end | abort `budget`, exit 5, `overshoot_usd` recorded; data extractable | Overspend | integration |
| E54 | F14 | Batch spend, including judge, answerer, matcher and probe, reaches the batch ceiling | no new run starts; running ones finish; exit 5 | Overspend across runs | integration |
| E55 | F14 | Mixed outcomes: one run exit 5, one exit 6 | `exp run` exits 6 and prints the table | Ambiguous status | unit |

## Pilot
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E56 | F16 | Pilot seeded set has fewer than 6 issues or misses one of the six categories | `exp check` exits 3 | Weak pilot | unit |
