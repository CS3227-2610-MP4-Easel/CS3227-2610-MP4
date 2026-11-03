# Runtime Mechanics

Contract-level rules the data model and API depend on. `EXP_ROOT` is the folder two levels above `harness/exp.mjs` (default `workflow/experiments`); every path in this spec resolves from it, so moving the folder needs no code change.

## Process model
- One `exp run <experiment-id>` process starts every queued run of the experiment, at most `max_parallel` at once (experiment field, 1-6, default 3), and stays alive until all runs are terminal.
- A run in `waiting_operator` holds its session id in `state.json`. The process polls `local/bank/` every 5 seconds; when a matching answer appears it invokes `claude --resume <session-id>` with the answer. `exp answer` only writes the bank entry; it starts no agent.
- If the process dies, `exp run --continue <run-id>` reloads `state.json` (status, session id, spend, turn count) and continues. A run whose `state.json` says `running` with no live process is `--continue`-able; a terminal run is not.
- `state.json`, `manifest.json` and every CSV are written to a temp file and renamed.

## Driver rules
- The harness appends this block to every arm prompt: `When the artifact is complete, end your final message with a last line that is exactly EXP-DONE. Ask the operator in plain text if you need a decision; your turn ends when you ask.`
- Classification of a turn's final assistant message: **empty** = only whitespace; **done** = its last non-empty line, trimmed, equals `EXP-DONE` (case-sensitive; the marker inside a quote or code fence earlier in the text does not count); **question** = anything else non-empty. A done message that also contains a question is done; the question is stored with note `ignored_after_done`.
- A CLI result that reports an error or a stop other than normal completion aborts the run as `crash`.
- An empty message gets one retry with `Continue, ask a question, or finish with EXP-DONE`; a second empty message aborts as `turn_cap`. Retries do not count as questions. The 41st question aborts as `turn_cap`.
- Timeouts: `turn_timeout_s` (default 1800) per invocation and `run_timeout_s` (default 5400) per run; on expiry the whole process tree is killed (Windows: `taskkill /T /F`) and the run aborts as `timeout`.

## Isolation procedure (F4)
1. Spawn the probe: the arm's flags, a one-line prompt, `--output-format stream-json`; read the init record.
2. Compare six sets (skills, plugins, agents, hooks, MCP servers, tools) as sorted string sets against the arm manifest, ignoring names in `config.json` `isolation_ignore`.
3. Mismatch: abort, exit 4, no task prompt sent. Hooks that run at session start have already run; the mandated flags are what prevent that.
4. If T2 finds the init record lacks any of the six sets, this spec is amended before T3 starts and the gap is recorded as a Deviation; there is no silent downgrade.

## Containment (F17)
- Environment allowlist: `PATH`, `SystemRoot`, `USERPROFILE`/`HOME`, `TEMP`/`TMP`, `APPDATA`, `LOCALAPPDATA`, the telemetry variables, and `ANTHROPIC_API_KEY` only in API-key mode. Everything else is dropped.
- Denied by default: `WebFetch`, `WebSearch`; an arm may list them in `allowed_tools`.
- Permission mode and allowed tools come from the arm; the bypass-all mode is rejected by schema.
- Residual risk, stated plainly: without an OS sandbox, a Bash tool can write anywhere the user can. Containment is detection after the fact plus the clone isolation; the subscription credentials under the user profile are readable by the agent. See open question Q5.
- Lint and judge code always run from the main checkout, never from the run's clone; they read copies of the artifacts.

## Credential patterns (N3)
`sk-ant-[A-Za-z0-9_-]{20,}`, `AKIA[0-9A-Z]{16}`, `-----BEGIN [A-Z ]*PRIVATE KEY-----`, `Bearer [A-Za-z0-9._-]{20,}`, `ghp_[A-Za-z0-9]{30,}`, `xox[abp]-[A-Za-z0-9-]{10,}`. A hit in an artifact is replaced by `[REDACTED:<type>]` in the copy sent to the judge and flags `secret_in_artifact` on the run; a hit in a committed output blocks the write (exit 9).

## Model calls outside the arm
| Call | Input | Output | Launch |
|---|---|---|---|
| Answerer (sheet) | question, sheet | JSON `{covered, answer}` | no tools, neutral temp cwd, no session persistence |
| Matcher suggestion | new question, bank questions | JSON `{bank_id or null}` shown to the operator, never applied | same |
| Probe | one-line prompt | init record | the arm's flags |
| Judge | rubric, delimited artifacts, seeded issues | strict JSON, range-checked | same as answerer |

All delimiters carry a per-call random nonce; any occurrence of the nonce inside inputs is removed first. Question text is stripped of control characters and escape sequences and capped at 2000 characters before storing or printing. Paths in questions become `<path>`: a path is `[A-Za-z]:\\[^\s]+`, `\\\\[^\s]+`, or `/[^\s]+` with two or more segments. The defence against judge injection is mitigation: a canary artifact in the calibration set contains an instruction to give top marks and must keep its band.

## Metrics
- `wall_s`: run start (first task prompt sent) to terminal time. `wait_s`: summed time in `waiting_operator`. `answerer_s`: summed duration of answerer and matcher calls that blocked the run. `agent_s = wall_s - wait_s - answerer_s`.
- `peak_prompt_tok`: maximum over events of `in_tok + cache_read_tok + cache_write_tok`. `cache_read_share`: sum of `cache_read_tok` over the sum of all three prompt buckets.
- `review_rounds`: count of distinct parent turns that launched one or more subagents whose type is in the arm's `review.agent_types`. Over `review.max_rounds` sets `review_cap_exceeded`.
- `fix_iterations`: count of Bash tool calls whose command contains `lint.mjs` and whose result exit code is not 0.
- Phase precedence: a skill invocation sets the phase for events until the next skill invocation; inside a subagent the subagent type's mapping wins; nested subagents inherit their parent's phase; unmatched is `other`.
- Rubric (`rubric/rubric.md`): five criteria scored 0-4 with written anchors, so a total is 0-20: completeness, testability, unambiguity, consistency with constraints, traceability. The spec and the plan are scored separately, pointwise. Each is scored in two separate calls with the criteria order shuffled; `rubric_*` is the mean and `rubric_gap` the difference; a gap above 4 sets `judge_unstable`. If the judge model equals the arm's `main` model, `judge_same_model` is true.

## Reports (F13)
Medians use the middle value (mean of the two middle values for even n). Geometric means are taken over per-task medians of `arm_cost_usd`, `agent_s` and total tokens only; a zero or empty task median is excluded and the row carries `gm_excluded`. With one task the geometric mean equals that median and the row carries `single_task`. Worked example: task A medians cost 2.00 and 8.00 for arms X and Y, task B 8.00 and 2.00; geometric mean X = sqrt(2 x 8) = 4.00 and Y = 4.00. Dominance: arm X is dominated by Y when both have `n >= 3`, `median(cost X) > median(cost Y)`, `median(rubric X) < median(rubric Y)`, `issues_raised(X) <= issues_raised(Y)`, and the min-max ranges of cost or rubric do not overlap. The operator makes the final choice; no winner is declared by the harness.

## Planned arms for v1 (confirm with Q2)
| Arm | Workflow | Plugins | Agents | Review |
|---|---|---|---|---|
| `superpowers` | brainstorming, then writing-plans | superpowers | none | none beyond the skills' own |
| `lite` | writing-specs-lite, then writing-plans-lite, run by the main agent | none | `reviewer` | Implementer lens, 1 round |
| `full` | role agents: spec-writer, reviewer lenses by risk tier, planner | none | spec-writer, planner, reviewer | Implementer and Tester, plus Attacker when triggered, 2 rounds |
