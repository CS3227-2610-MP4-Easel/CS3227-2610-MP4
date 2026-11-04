# Branch State — w7-pm-plan-flow

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7-pm-plan-flow (from `INT` at `2139533`)
- **Base:** 160053c
- **Owner:** Xiao-Congchen (PM)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-03 by Claude Sonnet 5.5 — T1 done, T2 awaiting spend-limit gate

**Untouched:** Architecture, Conventions

---

**Scope.** Two things share this branch. (1) W7 PM plan flow, the owner's slice: **not started**. Its spec and plan need only W1's frozen interfaces (W1 is in review as PR #5, not yet merged); W2, W3, W5 and W6 gate its build. (2) A new workstream, `W~1` Experiment framework: a harness and schema to run the same task under different agent-workflow configurations and compare tokens, cost, runtime, pass rates and artifact quality. The framework goes in first because it needs none of W7's dependencies; W7 later becomes its first test subject. Worktree: `../CS3227-2610-MP4-w7`.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S2 | 2026-11-04 | Claude Sonnet 5.5 | W~1 | Active | T9: rerunning `full` r1-r3 after the usage-limit crash | After the rerun: T9 step 5 (`exp grade` per done run), 6 (pass criteria), 7 (`exp report pilot-001`), 8 (ask the owner which arms), 9 commit; then the close-out | 2026-11-04 |
| S1 | 2026-11-03 | Claude Sonnet 5.5 | W~1 | Paused | Plan approved (gate 2); no task started; handed to a new session by the owner | New session: read STATE.md, guardrails.md and this file, run `lint.mjs plan workflow/plans/2026-11-03-experiment-framework.md --approved`, add your own session row, then run executing-plans-lite from T1 step 1 (T1 and T2 may run together; T2 step 1 is a GATE for the owner's spend limit) | 2026-11-03 |

**Remaining**

- [ ] Spec for W~1, then gate 1; then plan, gate 2.
- [ ] When PR #5 (W1) merges: merge `development` into this branch and move Base, then T1 of the framework; the pilot `base_commit` is the post-W1 `development` commit. W7's own spec and plan can then be run through the framework; its build waits for W2, W3, W5, W6 (STATE.md §3).
- [ ] **Handover:** tell the Dev Lead that W~1 overlaps W17 (telemetry aggregation script, AD-31) and AD-23b / Q4 (model experiment).

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W~1 | Experiment framework (agent-workflow evaluation) | Planned | [spec](../../specs/2026-11-03-experiment-framework-design.md) (approved 2026-11-03; amended C~10) | [plan](../../plans/2026-11-03-experiment-framework.md) (approved 2026-11-03) | Big · all tasks except T9 done; T9 is the pilot run (gates) | — |
| W7 | PM plan flow (proposals, pm) | Not started | — | — | untouched on this branch; spec stage needs only W1 merged, build waits on W2, W3, W5, W6 | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-03 | Branch and worktree created from `INT`; branch state written | W~1 | `32b641b` |
| 2026-11-03 | Experiment framework spec drafted (index plus six components), lint clean | W~1 | `2cc3ec3` |
| 2026-11-03 | Plan drafted for the experiment framework (T1 to T10 plus close-out), reviewed once, lint clean | W~1 | this commit |
| 2026-11-03 | Spec dependency table corrected (T6 depends on T3, T4 and T5; six waves; pricing.mjs moves to T1) | W~1 | `this commit` |
| 2026-11-03 | Spec approved at gate 1 by the owner | W~1 | this commit |
| 2026-11-03 | Spec amended for W1 (PR #5): W7 spec stage needs only W1's frozen interfaces; pilot base_commit and config.json handling noted | W~1 | this commit |
| 2026-11-03 | Spec revised after two review rounds: runtime.md added, containment, isolation, bank, metrics, cost and reporting rules tightened | W~1 | this commit |
| 2026-11-03 | Pilot dry run listed 9 runs; both self-tests passed (answerer 3/3 silent and 3/3 covered; judge good 16.5, mediocre 8, bad 1 with the canary held). First real batch: all nine runs aborted at the probe with `isolation_mismatch` (feature-gated built-ins absent); fixed by C~12 (built-ins optional), 13 isolation tests pass; the nine aborted run folders were moved to `local/runs-aborted-isolation/` so the reps are free again | W~1 | this commit |
| 2026-11-03 | T4, T10, T6, T7 done (waves 3 to 5): sheet answerer with sanitizer and question log; answer bank, queue, pause and resume (`exp queue`, `exp answer`); grader with judge, lint, seeded-issue outcomes and `grade --self-test`; report with medians, geometric means and verdicts. Plan-level notes: the bank mode lives in `driver.mjs` (`bankAnswer`, `waitForAnswer`) beside the sheet mode, not in `answerer.mjs`; report verdicts are over pooled replicates, `medians.csv` has one row per task and arm plus one arm-level row (task_id `*`) holding the geometric means and pair verdicts; two flags added to the spec's list: `missing_artifact`, `lint_not_applicable`; an arm needs 3 graded runs for any verdict other than inconclusive; `exp run` extracts every finished run | W~1 | this commit |
| 2026-11-03 | T3 done: classifier, spawn (native launcher only, environment allowlist, tree kill, shared no-tools builder), clone, containment hashes, isolation check, run state and manifest, approvals, budget, the run driver and `exp run` (33 driver tests with the scripted fake CLI, plus 119 others). Plan-level notes: the tools comparison ignores `allowed_tools` (they are permission rules) and ignores denied names on both sides; a batch stopped by its ceiling exits 5; the 40-question cap is a `deps.maxQuestions` seam so its test needs 4 spawns not 42; driver slices one and two were committed together; `exp run --dry` is covered by the driver test, since the real tree has no experiment until T8; `--setting-sources ""` and `--tools ""` verified on the real CLI (0.01 USD) | W~1 | this commit |
| 2026-11-03 | Spec amended for the T2 findings (C~11): F4, E25, E62, N4 and `runtime.md` § Isolation use a built-in baseline and observed SessionStart hook events; E71 added; plan updated (E71 in T3, traceability). Pricing confirmed against the Anthropic pricing page; T2 Done | W~1 | this commit |
| 2026-11-03 | T2 spike run for real (owner approved a 3 USD cap on the subscription login; 0.88 USD used) against Claude Code 2.1.316: findings in `harness/isolation.md`, five scrubbed fixtures, `pricing.json` filled for `claude-sonnet-5-5`. Toy costs per arm: superpowers 0.1312, lite 0.1358, full 0.2113 USD; ceilings by the plan's rule: run 0.6338, batch 3.169 USD. Key facts: `total_cost_usd` is cumulative over resumes and includes subagents (transcript sums match to the token); `--max-budget-usd` is per invocation; duplicate message ids occur; the init record has no hooks set (D~1); OpenTelemetry console export gave no output; the npm `.cmd` shim fails without a shell (EINVAL) | W~1 | this commit |
| 2026-11-03 | T1 done: schema validators, secrets scan, cost function, `exp check` and the command loader (50 tests green). Plan-level notes: `--secrets` scans all of `EXP_ROOT` except `local/` (not only `experiments/`) so T8 can scan the plugin copy; `exp check` prints the CLI version line only once T3 adds the launcher; a task whose id starts with `pilot-` is held to F16 | W~1 | this commit |
| 2026-11-05 | Blind review of the three replicate-2 plans (`exp blindreview pilot-001 --rep 2`: reviewer sees request, spec and plan with no arm name; 2 calls per plan; 0.86 USD): superpowers 18 and 26 findings, lite 18 and 16, full 22 and 21 (blockers 1 to 2 per plan, majors 10 to 16). Counts barely separate the arms: the two calls of one plan differ by up to 8, more than the gap between arms. What differs is the kind of finding: superpowers has the most `missing_step` (3 and 7; membership and soft-delete checks assigned to no task), lite has blockers on guessing an unseen transaction API and on building before the owner's yes, full has the most `scope_creep` (63 edge cases, a 15-rule text policy for a note the request called light). All three raise the same unconfirmed brief conflicts (cross-project visibility, `apps/*` paths, no epic page, pin vs edit widening). Cost and rubric for the same runs: superpowers 0.35 USD, rubric 28.5; lite 1.74 USD, 32.5; full 4.49 USD, 33.5. One replicate per arm: a pointer, not a ranking. Files: `docs/telemetry/experiments/pilot-001/blind-review.{md,json}` | W~1 | this commit |

---

## 6. Known Gaps

- **Experiment harness containment is detection plus isolation, not a sandbox.** An agent with a shell tool can write outside its clone, read the credentials under the user profile and use the network; forged bank or state files are caught only after the fact. A VM or dedicated OS user is the stronger option. (Accepted by the owner 2026-11-03; adds to `guardrails.md`.)

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

| ID | Date | Decision | Why / who asked |
|---|---|---|---|
| C~1 | 2026-11-03 | The experiment framework is built on branch `w7-pm-plan-flow`, ahead of W7 | Asked by the owner: W1 is still in review so W7 cannot start, but the framework has no dependency on it and W7 is its intended first test subject |
| C~2 | 2026-11-03 | The framework is a new workstream that extends AD-31, not a replacement: AD-31's OpenTelemetry export is one input, transcripts add per-agent detail, results land under `docs/telemetry/`, W17 later consumes them. It governs data generation and storage only; the run flow is the framework's own harness | Owner chose this over folding into W17 or a separate schema; rejected: pulling W17 forward (re-sequences the slicing), a second telemetry path (two sources that can disagree) |
| C~3 | 2026-11-03 | First build covers the spec-and-plan stage only; implementation, ablation ladder and model-tier stages are specified as later phases | Owner chose it given feature freeze on 10 Nov (AD-69); rejected: all four stages (cannot finish and still run), schema-only (no repeatability) |
| C~4 | 2026-11-03 | A synthetic mini task is the proof of concept: it validates the harness, extractor and variance and prunes dominated arms, but does not pick the winning configuration. The real comparison runs on W7 once W1 and its dependencies land, with the arms that survive the pilot (top two if time is short). The pruning rule is written in the spec before any run | Owner asked whether the mini task is proof or selection; chosen because a toy task does not exercise contracts or a Big-sized spec; rejected: replaying W4 (couples the pilot to W4's lite-flow authorship), waiting for W7 (no harness proof before the freeze) |
| C~5 | 2026-11-03 | Question handling: the pilot uses a scripted answer sheet with seeded gaps (a separate answerer model, cost logged apart); the real W7 run uses a shared answer bank with pause and resume (parallel arms, unmatched questions queue for the owner, answers reused across arms, waiting time excluded from runtime) | Owner chose it because questions arise throughout a run; rejected: two-phase autonomous-then-answer (later questions rest on assumed answers), live per-arm answering (unequal attention), always defaulting to the agent's suggestion (never rewards surfacing real issues) |
| C~6 | 2026-11-03 | The AD-31 relationship is extension, not replacement: data generation and storage only (see C~2) | Owner asked whether the AD-31 choice meant all tests run through that flow; answered no |
| C~7 | 2026-11-03 | v1 arms are `superpowers`, `lite` and `full` as in the spec; the harness lives in `workflow/experiments/`; containment is detection plus isolation with the residual risk accepted | Owner answered the spec questions Q2, Q4 and Q5; rejected: `src/tools/experiments/` (mixes tooling into the product tree), a VM now (setup time before the freeze) |
| C~8 | 2026-11-03 | The SoCLaaS key is not used for experiment runs; the arms run on Claude models through the Claude CLI | Owner asked whether to use it; reasons: SoCLaaS is OpenAI-compatible with open-weight models and reports no cache split, Claude Code needs the Anthropic API, and results on other models would not transfer to the Claude and Codex implementation runs; the key is also shared with the app (architecture §12) |
| C~9 | 2026-11-03 | Gate 1 approved for the experiment framework spec (Medium tier, SD1 to SD14, lenses Implementer, Tester, Attacker) | Owner approval in chat |
| C~14 | 2026-11-04 | Relax the cost limit: run ceiling 25 USD, batch ceiling 100 USD (effectively off; a run only has to finish) | Asked by the owner after total spend passed their 10 USD cap with the six-run batch: "as long as each individual run finishes is good". Cause of the three `full` crashes: the subscription's 5-hour usage limit ("You've hit your 5-hour limit", in the main session and a subagent of each run; the CLI reports it as subtype success with is_error true), not a harness bug; `abort_detail` now keeps the CLI's own message. The three crashed `full` runs were moved to `local/runs-aborted-usage-limit/` and rerun. Spend through the crash: 10.59 USD since the go-ahead |
| C~13 | 2026-11-03 | The pilot's run and batch ceilings are both 10 USD (the owner's hard cap); no run is cut off for cost before that. The cost of every run is reported | Asked by the owner after the second batch cut `lite` runs off at the 0.6338 USD run ceiling (the plan's rule from toy costs): they want to know what the runs really cost. Limits stay as honest: the batch ceiling only stops runs that have not started, so runs in flight may pass it; the run ceiling makes each invocation's `--max-budget-usd` the remaining 10 USD. Superpowers r1 to r3 finished under the old ceiling and are kept; lite r1 and r2 (stopped by the old ceiling at 0.65 and 0.66 USD), lite r3 and the full runs (killed unfinished) were moved to `local/runs-aborted-ceiling/` and rerun. Spend counted toward the 10 USD since the go-ahead: 3.53 USD (runs, probes, self-tests, the two stopped batches) |
| C~12 | 2026-11-03 | Built-ins are optional in the isolation comparison: arm and plugin entries are required, the CLI built-ins may be absent, and nothing outside both may appear (F4, `runtime.md` § Isolation, `isolation.md`) | The first pilot batch (approved by the owner) aborted all nine runs at the probe, before any task prompt, because feature-gated built-ins (`slides`, the artifact skills, `claude-code-guide`, the `Artifact*` tools) were present in the spike session and absent in the batch session; nothing extra was present. This tightens C~11 only in the direction of the approved intent; rejected: re-recording the built-in constants per session (the same drift would recur) and ignoring them in the check (extra entries must still be caught). Cost of the failed batch: 0.37 USD of probes, which stays in the batch spend |
| C~11 | 2026-11-03 | Amend the approved spec for the T2 findings: the init record has no hooks set and always lists built-ins, so F4 compares skills, agents, plugins, MCP servers and tools against a built-in baseline plus arm and plugin entries, and checks hooks as observed `hook_started` events (probe launched with `--include-hook-events`) that must be SessionStart hooks declared by arm plugins; other plugin hook events are covered by the plugin directory hash; E25 reworded, E71 added, E62 and N4 now say "no hook events" | Found by the T2 spike (D~1); the owner approved the amendment in chat; rejected: dropping the hooks comparison (weaker: nothing observes a foreign SessionStart hook) |
| C~10 | 2026-11-03 | Amend the approved spec: T6 depends on T3, T4 and T5 (fake CLI, answerer, question log), T9 moves to wave 6, `pricing.mjs` moves to T1, commands load from `harness/commands/`, T3 also satisfies F15 | Found by the plan review (Implementer lens); no behaviour changes; the owner chose "plan as is" for the provider seam, so no provider field was added; rejected: duplicating helpers in T6 to keep five waves |

## 8. Deviations

> Legend: `D` = Deviation, where reality diverged from a spec or plan. Not to be confused with
> AD-nn, an Architecture Decision.

| ID | Date | What diverged | Consequence | What was done | Status |
|---|---|---|---|---|---|
| D~1 | 2026-11-03 | Found by the T2 spike (CLI 2.1.316). (a) The `system/init` record has **no hooks set**; spec F4, E25 and `runtime.md` § Isolation assume six sets. Hook activity is visible only as `hook_started`/`hook_response` stream events for hooks that fired, before the init record. (b) The `skills`, `agents` and `plugins` lists always contain built-in entries (20 skills, 6 agents, 3 plugins) that `--setting-sources project` does not remove, so "arm skills plus plugin skills" never equals the record. | Without an amendment F4 cannot pass on any real run: E25 stops every run, and E24 would flag the built-ins. T3's `isolation.mjs` and its tests cannot be written against the current text. | T2 finished everything else. `isolation.md` records the proposed derivation: expected sets = built-in baseline (constants per CLI version, from the plain-probe fixture) + arm and plugin entries; hooks = hook names observed in the probe stream (launched with `--include-hook-events`) must be a subset of the SessionStart hooks declared by the arm's plugins; non-SessionStart plugin hooks are covered by the approval hash over the plugin directory. Spec not yet amended. | Resolved by C~11 |

