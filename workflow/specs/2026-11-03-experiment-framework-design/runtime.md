# Runtime Mechanics

Contract-level rules the data model and API depend on. `REPO_ROOT` is the git top level. `EXP_ROOT` is the folder two levels above `harness/exp.mjs` (default `REPO_ROOT/workflow/experiments`); experiment files resolve from `EXP_ROOT`, results (`docs/telemetry/experiments/`) from `REPO_ROOT`, and a relative `worktrees_root` from `REPO_ROOT` (default `../exp-runs`, a sibling of the repo).

## Process model
- One `exp run <experiment-id>` process starts every queued run of the experiment, at most `max_parallel` at once, and stays alive until all runs are terminal.
- A question that matches no bank entry becomes a queue item (`local/queue/<qid>.json`) and the run enters `waiting_operator`. The process polls the queue every 5 seconds; when an item has a `bank_id`, it resumes every run listed on it with `claude --resume <session-id>` and the answer. `exp answer` only writes the bank entry and sets `bank_id`; it starts no agent.
- A run in `waiting_operator` longer than `wait_timeout_s` (default 86400) aborts as `timeout`.
- `exp run --continue <run-id>` works for `running` and `waiting_operator` runs. It reloads `state.json`, repeats the F15 check, recomputes every manifest hash (a difference exits 7), repeats the probe, and validates the session id against a UUID pattern. If the turn state was `in_turn`, it sends `Continue from where you stopped.`; if `idle` or waiting, it re-enters the normal loop.
- Runs never started because the batch ceiling was reached stay `queued`; the batch table prints them as `not_started: batch_ceiling`.
- `state.json`, `manifest.json` and every CSV are written to a temp file and renamed.

## Driver rules
- The harness appends this block to every arm prompt: `When the artifact is complete, end your final message with a last line that is exactly EXP-DONE. Ask the operator in plain text if you need a decision; your turn ends when you ask.`
- Classification of a turn's final assistant message: **empty** = only whitespace; **done** = its last non-empty line, trimmed, equals `EXP-DONE` (case-sensitive, and only that line counts, so a quote earlier in the text does not); **question** = anything else non-empty. A message with a question followed by a final `EXP-DONE` line is done; the question is stored with note `ignored_after_done`.
- A CLI result reporting the budget cap maps to `budget`; any other error or abnormal stop aborts as `crash`.
- An empty message gets one retry with `Continue, ask a question, or finish with EXP-DONE`; a second empty message aborts as `turn_cap`. Retries do not count as questions. The 41st question aborts as `turn_cap`.
- Timeouts: `turn_timeout_s` (default 1800) per invocation and `run_timeout_s` (default 5400) per run; on expiry the process tree is killed (Windows: `taskkill /T /F`) and the run aborts as `timeout`.
- Spend for ceilings is computed from extracted events and `pricing.json` after each turn; the CLI total is used only for N1.

## Isolation procedure (F4)
1. Spawn the probe with the arm's flags, a one-line prompt and `--output-format stream-json`; read the init record.
2. Expected sets (measured in T2; the init record has no hooks field, see step 4): skills = built-in skills plus arm `skills` plus `<plugin>:<skill>` for each skill of each arm plugin; agents = built-in agents plus arm `agents` plus agents declared by arm plugins; plugins = built-in plugins plus the arm plugins, matched by name; MCP = arm `mcp`; tools = the baseline tool list plus arm `allowed_tools` minus `disallowed_tools`. The built-in lists and the baseline tool list are committed constants per CLI version, taken from the plain-probe fixture `harness/fixtures/init-record.json`; `harness/isolation.md` has the exact derivation.
3. Compare as sorted sets, ignoring names in `config.json` `isolation_ignore`. A difference aborts with exit 4 and no task prompt is sent. A `claude_code_version` that differs from the baseline fixture is reported and stops the run until the constants are refreshed. Session-start hooks have already run; the mandated flags and the stripped clone are what prevent untrusted ones from existing.
4. Hooks: the init record carries no hooks set, so the probe runs with `--include-hook-events` and the observed hooks are the `hook_name` values of the `hook_started` events that precede the init record. Each observed hook must be a SessionStart hook declared in the `hooks/hooks.json` of an arm plugin; the clone declares none (settings stripped). Hooks a plugin declares for other events cannot be observed by the probe and are covered by the plugin directory hash in the approval (E4). If the init record lacks any of the five sets it does carry, the run does not start; there is no silent downgrade.
5. Every resumed invocation reuses the same flag list (launch test).

## Containment (F17)
- Environment allowlist: `PATH`, `SystemRoot`, `USERPROFILE`/`HOME`, `TEMP`/`TMP`, `APPDATA`, `LOCALAPPDATA`, the telemetry variables, and `ANTHROPIC_API_KEY` only in API-key mode.
- Permission mode and allowed tools come from the arm; the bypass-all mode is rejected by schema.
- Checked at each turn boundary: `.git/config` and `.git/hooks` of the main repo, `~/.claude/settings.json`, the batch's config files (arms, tasks, experiments, plugins, rubric, harness, `config.json`, `pricing.json`, hashed at batch start), and the run's own state files (hash recorded at each harness write). The main working tree is not hashed (the operator edits it). Operators do not edit those paths during a batch.
- Lint and judge code always run from the main checkout over artifact copies.
- **Residual risk, accepted (SD12):** without an OS sandbox, a shell tool can write anywhere the user can, read the subscription credentials under the user profile, and send them out over the network; the bank and state files share the agent's trust domain, so an agent could forge a bank entry or a state file, which the hash checks catch only after the fact. A VM or a dedicated OS user is the stronger option and stays available.

## Credential patterns (N3)
`sk-ant-[A-Za-z0-9_-]{20,}`, `AKIA[0-9A-Z]{16}`, `-----BEGIN [A-Z ]*PRIVATE KEY-----`, `Bearer [A-Za-z0-9._-]{20,}`, `ghp_[A-Za-z0-9]{30,}`, `xox[abp]-[A-Za-z0-9-]{10,}`. A hit in an artifact is replaced by `[REDACTED:<type>]` in the copy sent to the judge and sets flag `secret_in_artifact`; a hit in a committed output blocks the write (exit 9).

## Model calls outside the arm
All four use the N4 launch: no tools, neutral temp directory, no session persistence, no user settings, no plugins, no MCP.
| Call | Input | Output |
|---|---|---|
| Answerer (sheet) | question, sheet | JSON `{covered, answer}` |
| Matcher suggestion | new question, bank questions | JSON `{bank_id or null}`, shown to the operator, never applied |
| Probe | one-line prompt | init record |
| Judge: rubric | rubric, one delimited artifact | JSON of five scores |
| Judge: seeded issues | issues, all questions, spec and plan | per issue an outcome with evidence; per question `issue_id` and `issue_alt` |

All delimiters carry a per-call random nonce, removed from inputs first. Question text is stripped of control characters and escape sequences and capped at 2000 characters before storing or printing. A path is `[A-Za-z]:\\[^\s]+`, `\\\\[^\s]+`, or `/[^\s]+` with two or more segments, and becomes `<path>`. Judge-injection defence is mitigation: a canary artifact in the calibration set tells the judge to give top marks and must keep its band.

## Matcher normalisation (F8)
Case-fold; remove punctuation; remove the words `a`, `an`, `the`; collapse whitespace; trim. No stemming, no synonyms. Two questions match when the results are equal.

## Cost and metrics
- Event cost = tokens times price per million for each of the four buckets, kept unrounded (6 decimals in `events.csv`); run `arm_cost_usd` is the sum of unrounded event costs, rounded once to 4 decimals.
- `wall_s`: first task prompt sent to terminal time. `wait_s`: time in `waiting_operator`. `answerer_s`: time answerer and matcher calls blocked a `running` run.
- `peak_prompt_tok`: maximum over events of `in_tok + cache_read_tok + cache_write_tok`. `cache_read_share`: sum of `cache_read_tok` over the sum of those three buckets. `total_tok`: all four buckets.
- `issues_found` = seeded issues with outcome `raised_as_question` or `resolved_in_artifact`; `issues_raised` counts only the first.
- `review_rounds`: distinct parent turns that launched one or more subagents whose type is in the arm's `review.agent_types`; over `review.max_rounds` sets `review_cap_exceeded`.
- `fix_iterations`: Bash tool calls whose command contains `lint.mjs` and whose exit code is not 0.
- Artifacts: files created or changed in the clone since `base_commit` that match the arm's `artifact_globs.spec` (spec) and `.plan` (plan). Lint, for arms with `lint` true: the main checkout's `.claude/skills/writing-specs-lite/scripts/lint.mjs` with `spec <index>` or `plan <file>`; the count is the number of output lines that start with `ERROR`.
- Phase precedence: a skill invocation sets the phase until the next skill invocation; inside a subagent its type's mapping wins; nested subagents inherit the parent's phase; unmatched is `other`.
- Rubric (`rubric/rubric.md`): five criteria scored 0-4 with written anchors (completeness, testability, unambiguity, consistency with constraints, traceability), so one artifact scores 0-20. Spec and plan are scored separately and pointwise, each in two calls with the criteria order shuffled; `rubric_*` is the mean, `rubric_gap` the difference (above 4 sets `judge_unstable`), `rubric_total = rubric_spec + rubric_plan`. `judge_same_model` is set when the judge model equals the arm's `main` model.

## Reports (F13)
Medians use the middle value (mean of the middle two for even n). Geometric means cover per-task medians of `arm_cost_usd`, `agent_s` and `total_tok` only; a zero or empty median is excluded and flagged `gm_excluded`; one task flags `single_task`.
Worked table 1 (geometric mean): arm X has task medians 2.00 and 8.00, arm Y 8.00 and 2.00; the geometric mean of each is sqrt(2 x 8) = 4.00.
Verdict for arms X and Y: `inconclusive` if either has `n < 3`. Otherwise `dominated(X by Y)` when `med cost X > med cost Y`, `med rubric_total X < med rubric_total Y`, `med issues_found X <= med issues_found Y`, and the min-max ranges of cost or of rubric_total do not overlap. If neither is dominated, `tradeoff` when the medians disagree in direction and `inconclusive` when both ranges overlap.
Worked table 2 (one task, all `n = 3` except W):
| Arm | cost values | cost range | rubric_total values | rubric range | median issues_found |
|---|---|---|---|---|---|
| X | 3.0, 4.0, 5.0 | 3.0-5.0 | 20, 22, 24 | 20-24 | 4 |
| Y | 1.0, 1.5, 2.0 | 1.0-2.0 | 28, 30, 32 | 28-32 | 5 |
| Z | 1.8, 2.5, 3.5 | 1.8-3.5 | 25, 27, 29 | 25-29 | 5 |
| W | 2.0, 3.0 (`n = 2`) | 2.0-3.0 | 24, 26 | 24-26 | 4 |
Expected: X vs Y is `dominated(X by Y)` (cost ranges do not overlap); X vs Z is `dominated(X by Z)` (rubric ranges do not overlap); Z vs Y is `inconclusive` (cost 1.8-3.5 overlaps 1.0-2.0 and rubric 25-29 overlaps 28-32, so Z is not dominated by Y); every pair with W is `inconclusive`.

## Planned arms for v1 (SD10)
| Arm | Workflow | Plugins | Agents | Review | Lint |
|---|---|---|---|---|---|
| `superpowers` | brainstorming, then writing-plans | superpowers | none | none beyond the skills' own | false |
| `lite` | writing-specs-lite, then writing-plans-lite, run by the main agent | none | `reviewer` | Implementer lens, 1 round | true |
| `full` | role agents: spec-writer, reviewer lenses by risk tier, planner | none | spec-writer, planner, reviewer | Implementer and Tester, plus Attacker when triggered, 2 rounds | true |
All three keep `AGENTS.md` and `CLAUDE.md` (`instruction_files`) so the project's own rules are the same; the `superpowers` arm has `lint` false because its artifacts do not use the lite format, and its lint fields are excluded from comparison.
