# Experiment Implementation Stage Design

- **Status:** Approved (Xiao-Congchen, 2026-11-05)
- **Risk tier:** Medium - new files and CSVs, a new run stage, and the harness now executes agent-written code and tests on the operator's machine (the Attacker lens is added for that reason). No product data, money or permissions change.
- **Workstream:** W~1 (this branch) | **Plan:** not written yet
- **Constraints consulted:** `guardrails.md` (no secrets in the repo, AD-32); C8 (source under `src/`); the approved experiment framework spec `workflow/specs/2026-11-03-experiment-framework-design.md` and its folder (stage values reserved, exit 8 for unsupported stages, Known Gap on containment); the pilot result in the `w7-pm-plan-flow` branch state (r2 plans, costs, blind review).

## 1. Problem

**Current behaviour (verified in `workflow/experiments/harness/` on branch `w7-pm-plan-flow`, commit `f576257`).** The harness runs only the spec-and-plan stage. It grades the artifacts with a rubric, lint, planted-issue outcomes and (since the pilot) a blind review. Any arm or task with stage `implementation` exits 8. The pilot's cost number is the cost of writing a spec and a plan only.

**Desired behaviour.** For a chosen set of finished plans, a cheaper model builds the plan exactly, in an isolated clone, and the harness records what the build cost, whether it passed, and what is wrong with the code. From that the operator reads, per workflow arm: pass@1, pass@2, the cost of the plan plus the build through the first green attempt, and an expected cost to reach green. This is the number that tests whether a cheaper planning flow saves money once rework is counted, and what a proper full flow costs end to end.

The pilot measured the plans' text. It cannot say whether a plan is buildable. A plan that costs 13 times less and leaves membership checks assigned to no task is only cheaper if the build does not pay for the gap.

## 2. Goals

Functional goals F1 to F15 and non-functional goals N1 to N4 are in [requirements.md](2026-11-05-experiment-implementation-stage-design/requirements.md).

Summary: freeze plans from finished runs (F1); a task with commands and shared checks, and an experiment file (F2, F3); a baseline (F4); one history-free clone per plan and sample, isolated and watched (F5, F6); fixed question policy (F7); checks run in a harness-owned verify tree with one pass rule (F8, F9, F10); one retry with feedback (F11); plan-adherence metrics and a no-tools code review (F12, F13); cost classes, CSVs and the report (F14); resource caps (F15).

## 3. Non-goals

- A Codex driver or any provider other than Claude: later task, as the framework spec already says. The experiment file's implementer arm names a Claude model only.
- Implementing a workstream for real (W7). This stage tests plans from the pilot task; a W7 comparison is its own spec and plan.
- Fixing the question classifier overcount found in the pilot (status lines counted as questions in `lite` and `full`): a separate small fix, listed in the branch state. This stage's own question counting uses the rule in F7.
- Statistical verdicts. With 2 samples per plan the report prints counts, never a winner (N4).
- A sandbox. Containment stays detection plus isolation (Known Gap in the framework branch state); this spec adds environment stripping and timeouts only.

## 4. Components

- [requirements.md](2026-11-05-experiment-implementation-stage-design/requirements.md) - F1 to F15, N1 to N4 with acceptance criteria, and the shared check list CHK1 to CHK8.
- [data-model.md](2026-11-05-experiment-implementation-stage-design/data-model.md) - snapshot, task and experiment fields, parsing rules, the adapter contract, fixed texts, cost formulas, run and attempt state, new CSV columns.
- [api.md](2026-11-05-experiment-implementation-stage-design/api.md) - `exp snapshot`, `exp baseline`, and the changes to `exp run`, `exp grade`, `exp report`, with exit codes and security per command.
- [edge-cases.md](2026-11-05-experiment-implementation-stage-design/edge-cases.md) - E1 onwards, with a threat list (E83 to E104).
- [implementation-order.md](2026-11-05-experiment-implementation-stage-design/implementation-order.md) - T1 to T8, waves, gates, the pilot source run ids.
- No `ui.md`: no screens. No `conventions.md`: the framework's layout, naming and error conventions apply unchanged; the only addition is the file names listed in data-model.md.

## 5. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|

None.

## 6. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | The implementer is a cheaper Claude tier (`claude-haiku-5-5`) through the existing driver; the Codex driver is a later task | Reuses pricing, isolation and transcript code. Rejected: Claude and Codex both in v1 (a second harness build before the stage works), Codex only (loses the comparison on the tooling already trusted) | Owner, 2026-11-05 |
| SD2 | Pass = the plan's own tests, typecheck and lint pass, and the required shared checks pass. Shared checks are written once from the brief and the answer sheet, and reach each build through a small per-plan adapter written from the plan text before any run | The owner chose "own tests plus shared behaviour checks". The adapter is a change from "through the HTTP boundary": each plan picks its own routes, and one plan states that no route is reachable until a later workstream, so a fixed HTTP client would fail plans for a layout choice. Rejected: own tests only (a thin plan with weak tests passes), shared tests only (needs a fixed contract that overrides the plans) | Owner, 2026-11-05; adapter form by the spec author, to be confirmed at gate 1 |
| SD3 | Input plans are replicate 2 of each of `superpowers`, `lite`, `full` (the three just reviewed). Each plan is built from scratch in 2 independent samples; a sample that is not green after attempt 1 gets one retry (attempt 2) | The owner's choice for low cost. Rejected: all replicates (about three times the cost), one build per plan (no pass rate) | Owner, 2026-11-05 |
| SD4 | Attempt 2 resumes the same session in the same clone after the harness restores protected and plan files. The feedback is the fixed template in data-model.md: typecheck and lint lines, failing tests with 20 lines each, regressed tests, and each failed required check's one-sentence requirement, never its code | A retry with no information measures luck. Showing check code would let the implementer write to the check | Spec author |
| SD5 | The harness runs explicit commands from the task file, never `npm test` or other package scripts | The agent can edit `package.json` scripts to make a check pass without doing the work | Spec author |
| SD6 | `cost_to_green_usd` of a run = plan cost + implementer cost through its first green attempt; empty when no attempt is green. `expected_cost_to_green_usd` of a plan = plan cost + (sum of run costs over all samples) / count of samples green by attempt 2, empty when that count is 0; review cost is excluded from both (formulas and a worked example in data-model.md) | Answers "what does a proper full flow cost end to end" with one number per plan and states the estimator, since a plain mean hides runs that never pass | Spec author |
| SD7 | The implementer cannot ask the operator. A question is answered with a fixed text and counted as a plan gap | Questions in the specplan stage came from the brief; here a question means the plan was silent, which is the signal | Spec author |
| SD8 | The code is reviewed once per run, after the last attempt, by a no-tools model call that reads the plan and the diff. It reports findings by category and severity | The owner asked for bugs and best practice, not only pass or fail | Owner, 2026-11-05 |
| SD9 | New files `impl-runs.csv` and `impl-summary.csv`; the existing `runs.csv`, `events.csv` and `medians.csv` columns do not change | The framework's report test pins the existing columns to its data-model | Spec author |
| SD11 | Checks never run in the agent's clone. The harness builds a verify tree (base tree, the agent's changed source files found by hashing bytes, the pristine toolchain, then the acceptance files) and runs every check there | The agent has Bash and edits its own clone: its `node_modules`, `.git` config and scripts are not trustworthy. Rejected: running checks in the clone with protected-path detection only | Attacker lens review |
| SD13 | The shared-check verdicts are decided by a harness-owned parent process; the agent's code runs only in a host child that answers adapter calls over IPC, and the check assertions and `checks.json` are never in the verify tree | Round 2 Attacker lens: a verdict file or nonce can be read or written by agent code in the same process. Rejected: a nonce-named verdict file (round 1 design) | Attacker lens review |
| SD12 | An agent clone has no history: `git archive` of the base commit, `git init`, commits `base` and `plan`. The framework's local-clone method is not used for this stage | A local clone keeps every object, so the hidden checks and the other arms' plans could be recovered with git | Attacker lens review |
| SD10 | Prices for the implementer model are read from the provider's pricing page with the operator present, and written to `pricing.json` with source and date, as the pilot did. They are not taken from memory | A wrong price corrupts every cost column | Spec author |

Lenses run, round 2 (final): Implementer (4 major, fixed: metrics stored per attempt, runner invocation, deleted files, task inputs and ownership, exit-code split) and Attacker (3 blocking, 4 major, fixed: lockfile validation, parent and host split, name whitelist and `node` argv, filesystem rules, no git in the clone, canary tokens, disk polling). Rejected: moving the acceptance folder out of the repo working tree (the T8 gate asks the operator to choose a separate Windows user or accept the exposure instead). Lenses run, round 1: Implementer, Tester and Attacker (the harness executes code the agent wrote). Findings fixed in the files: the adapter contract, experiment and arm shapes, dependency edge T3/T4, parsing rules, protected-path semantics, the verify tree and history-free clone (SD11, SD12), credential-in-output policy, cost attribution, caps. Rejected: a job object for process control (Node has none; the end-of-turn sweep replaces it, confirmed in T1); a network block (no sandbox, Known Gap).
