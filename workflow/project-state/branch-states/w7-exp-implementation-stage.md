# Branch State — w7-exp-implementation-stage

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7-exp-implementation-stage (cut from branch `w7-pm-plan-flow` at `f576257`, which is from `INT` at `2139533`)
- **Base:** 160053c (the `INT` commit last merged into the parent branch)
- **Owner:** Xiao-Congchen (PM)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-05 by Claude Sonnet 5.5 — plan approved, execution not started

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** Extends the experiment framework (workstream `W~1` of the parent branch `w7-pm-plan-flow`, whose harness is in `workflow/experiments/`) with an implementation stage: a cheaper model builds finished plans exactly, and the harness records pass@1, pass@2, cost to green and code quality per plan. The parent branch holds the pilot, its blind review and its result; this branch must be merged after it (or rebased onto it once it merges). Worktree: `../CS3227-2610-MP4-w7-impl`.

---

## 1. How to Resume

**Setup**

```bash
node workflow/tools/ws.mjs doctor
node .claude/skills/writing-specs-lite/scripts/lint.mjs spec workflow/specs/2026-11-05-experiment-implementation-stage-design.md
```

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S2 | 2026-11-05 | Claude Sonnet 5.5 | W~1 | Active | T6 slice 1 committed: `prepareImplClone`, `implfeedback.mjs` (feedback and restore, step 5 done), `implcost.mjs`, `newImplRunState`, `computeImplHashes`, `batchPaths({implTaskId})`. Not done: the driver itself (`impldriver.mjs`, its dispatch in `driver.mjs`, `runShared`) and steps 1 (preflight part), 2, 3, 4, 6, 7, 8 and the integration part of 9 | T6 next: write `impldriver.mjs` as `executeImplRun(ctx, run, helpers)` (helpers = persist, abort, invoke, account, containmentDiff passed in from `driver.mjs` to avoid a circular import); in `runBatch` replace the exit-8 branch for `implementation` by arms = [implementer_arm_id], tasks = [task_id], plan runs = plans x samples (run id `<ts>-<task>-<plan-id>-s<sample>`), same approval, ceilings, workers and afterRun; the sandbox for node_modules in the agent clone is a `copyToolchain` of the baseline tree, not `npm ci` (no network per sample). Tests with the fake CLI and a toy baseline built by `buildBaseline` with an injected setup | 2026-11-05 |

**Remaining**

- [ ] Execute the plan (`executing-plans-lite`) from T1, in a new session started by the owner.
- [x] The question classifier overcount found in the pilot (status updates counted as questions) is fixed on branch `w7-pm-plan-flow` (decision C~15 there): a `status` class that the driver continues without counting. This branch gets it when it is rebased onto or merged with that branch; the implementation stage's own driver (T6) must use `classifyTurn` unchanged, and spec edge case E28 now refers to that classifier.
- [ ] **Handover:** Codex driver for the implementation stage (launcher, transcript parser, price list, isolation check); the spec leaves it out on purpose (SD1).
- [ ] **Handover:** a real W7 comparison needs its own spec and plan once W2, W3, W5 and W6 land.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W~1 | Experiment implementation stage (extends the framework workstream of branch `w7-pm-plan-flow`) | Building | [spec](../../specs/2026-11-05-experiment-implementation-stage-design.md) (approved 2026-11-05) | [plan](../../plans/2026-11-05-experiment-implementation-stage.md) (approved 2026-11-05) | Big · T1 to T5 done; T6 next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-05 | Branch and worktree created from the parent branch after the pilot and the blind review of the three replicate-2 plans | W~1 | `f576257` |
| 2026-11-05 | Spec drafted: index plus requirements, data model, API, edge cases and implementation order; lint clean | W~1 | this commit |
| 2026-11-05 | Plan approved at gate 2 by the owner; execution left to a separate session | W~1 | this commit |
| 2026-11-05 | Plan drafted (T1 to T8 plus close-out, 10 steps at most per task); one review round (0 blocking, 11 major, all fixed: stage switch placement, `check.mjs` pilot rule, `historyFreeTree` moved to T4, `plan_modified` and tampering detectors in T4, aborted runs graded, cost attribution without new cost classes, source runs copied into this worktree, arm approval at the T8 gate); departures from the spec's file hazards: T4 and T6 both edit `clone.mjs`, review spend uses the `judge` cost class, E93 to E104 assigned to tasks | W~1 | this commit |
| 2026-11-05 | Spec approved at gate 1 by the owner, with the adapter form (SD2), the Haiku price gate (SD10) and the T8 exposure choice accepted | W~1 | this commit |
| 2026-11-05 | Review round 2 (Implementer 4 major; Attacker 3 blocking, 4 major) fixed: shared-check verdicts decided by a parent process (host child answers over IPC), lockfile validation, name whitelist and `node` argv, filesystem rules in the verify-tree builder, no git in the clone, canary tokens, disk polling, per-attempt metrics, exit-code split, T2 to T8 inputs and ownership clarified; lint clean | W~1 | this commit |
| 2026-11-05 | T6 slice 1: `prepareImplClone` (history-free clone with commits base and plan, arm overlay, plan collision exit 3, empty hooks path, git bytes recorded), `buildFeedback` and `restoreFiles` (exact template, 8000-character cut, fixed secret line, no write through a link), `splitCosts`, `newImplRunState`, `computeImplHashes`, `batchPaths` with `implTaskId`; 14 + 5 + 3 + 20 tests green | W~1 | this commit |
| 2026-11-05 | T5 done: the owner approved the three adapters and checks.json at the gate (C~8: pilot adapters accepted as written, with the wiring risks recorded in the line below) | W~1 | this commit |
| 2026-11-05 | T5 steps 1 to 6: shared runner and host (parent decides CHK1 to CHK8 from plain values; host over the IPC channel; stdout of the host ignored), `canary.mjs`, task files for `pilot-pinned-note-impl`, `checks.json`, three adapters written by subagents from the plan text only, canary planted in the six acceptance files; 23 tests green, `exp check` exit 0. Adapter risks for the owner gate: superpowers-r2 guesses the route factory exported by `routes/notes.ts` (the plan names none); lite-r2 drives the front-end data layer for the PM and the Hono route with a stub service for the Developer (the plan has no role-aware layer); full-r2 carries a Prisma-like in-memory fake that the plan's service must be happy with; none was run against real built code | W~1 | this commit |
| 2026-11-05 | T4 done (second slice): `runCommand` (no shell, `node` replaced by the Node binary, 1 MB kept / 10 MB kill, timeout, tree kill), `checkEnv`, `sweepProcesses` (WMI through an encoded command, kills by command line inside the tree, survivors reported), `stageAcceptance` (adapter only after a clean sweep), `runChecks` (all steps run, line and total caps, credential scan empties lines, own and baseline test sets), `isGreen`, `detectTampering`, `gitProtectedSnapshot` / `gitProtectedChanged`, `adherence`, `acceptanceHash`, `pristineProblem`, `taskHashes`, `baselineProblem`, `buildBaseline`, `exp baseline`. Found: node reports a test file that cannot load as a failing test named after the path (with doubled backslashes), so the parser maps it to `<file>::load`; the working directory of a process is not available through WMI, so the sweep matches the command line only. 130 tests across the T2 to T4 files green | W~1 | this commit |
| 2026-11-05 | T4 first slice: `historyFreeTree` (clone.mjs), `testparse.mjs` (TAP ids, load failure, duplicates, TS error count), `safefs.mjs` (lstat walk, name rule, limits, links, .npmrc), `buildVerifyTree`, `validateLockfile`, `toolchainManifest` and `copyToolchain` in `implchecks.mjs`. Found: npm workspaces install absolute junctions in node_modules, so the pristine copy recreates them inside the verify tree; the name rule (F8) is applied to changed and added files only, otherwise root files such as .gitignore would make every attempt red | W~1 | this commit |
| 2026-11-05 | T3 done: `exp snapshot` (`snapshot.mjs`, `commands/snapshot.mjs`): complete runs only, refuses missing_artifact and cost_mismatch (from the manifest or grades.json), checks every path (also a name whitelist beyond the spec list), lstat walk with symlinks refused, credential scan (exit 9), URL/curl/wget/home-path/base64 findings (exit 2 unless --accept-findings), temp folder plus rename, an identical repeat is accepted; 10 tests | W~1 | this commit |
| 2026-11-05 | T2 done: `schema.mjs` implementation validators (`validateImplExperiment`, task and arm rules, `post_setup`, `effort`), `check.mjs` implementation experiment and task rules (pilot rule limited to specplan tasks, adapter and snapshot existence, review and implementer prices), `spawn.mjs` `--effort`, driver experiment-stage switch (exit 8 for ablation, model_tier, implementation until T6), `makeImplRepo()` in `testkit.mjs`, `arms/implementer-cheap.json` (Sonnet 5.5, low effort). Tests were written alongside the code, not strictly before it. The framework test "E8: arm stage" now uses an implementation prompt, because the implementation placeholder allowlist replaces the specplan one | W~1 | this commit |
| 2026-11-05 | T1 done: Windows facts recorded in `isolation.md` (env list, setup needs a `prisma generate` step, timings, TAP format, junction/hardlink behaviour, grandchild survives `killTree` and the PowerShell sweep kills it); toy build with Sonnet 5.5 at low effort cost 0.0561 USD and the result-event totals reproduce the CLI cost exactly (assistant-event usage undercounts); `pricing.json` Sonnet entry re-dated; baseline `<BUILD>` was 296/296 green | W~1 | this commit |
| 2026-11-05 | Execution started; T1 gate answered: implementer switched to Sonnet 5.5 at low effort (C~6); spec SD1, data-model, implementation-order and plan T1/T2 amended; no new price entry needed | W~1 | this commit |
| 2026-11-05 | Review round 1 (Implementer, Tester, Attacker: 4 + 3 + 3 blocking findings) fixed: checks run in a harness-owned verify tree, history-free agent clones, nonce-named verdict file, protected paths mean modified or deleted base files, adapter contract and parsing rules defined, credential-in-output no longer stops a batch, cost attribution by attempt boundary, resource caps, T3/T4 dependency corrected | W~1 | this commit |

---

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

| ID | Date | Decision | Why / who asked |
|---|---|---|---|
| C~1 | 2026-11-05 | The first implementation stage uses a cheaper Claude tier through the existing driver; the Codex driver is a later task | Asked by the owner after the pilot: they want to implement the plans with a cheaper model, possibly another provider. Chose "cheaper Claude tier first"; rejected: both providers in v1, Codex only |
| C~2 | 2026-11-05 | Pass = the plan's own tests, typecheck and lint, plus required shared behaviour checks reached through a per-plan adapter | Owner chose "plan's own tests plus shared behaviour checks"; the adapter replaces a fixed HTTP client because each plan picks its own routes (spec SD2); rejected: own tests only, shared tests only |
| C~3 | 2026-11-05 | Input plans are replicate 2 of each arm, built in 2 samples with up to 2 attempts each | Owner chose it to keep cost low; rejected: all replicates, one build per plan |
| C~5 | 2026-11-05 | Checks run in a harness-owned verify tree, agent clones have no git history, and shared-check verdicts are decided by a parent process (spec SD11, SD12, SD13) | Found by the Attacker and Implementer lenses: the agent has Bash in its clone, so its `node_modules`, git config and scripts cannot be trusted and git objects expose hidden files; not asked by the owner; rejected: running checks in the clone with protected-path detection only |
| C~8 | 2026-11-05 | The three pilot adapters and `checks.json` are accepted as written, although none ran against built code | Owner, at the T5 gate; not a change to the spec; they may be revised only through a new decision because the adapters are hash-recorded per run |
| C~6 | 2026-11-05 | The implementer is `claude-sonnet-5-5` at `low` effort, not Haiku (amends SD1, plan T1 and T2; arm gets an `effort` field and `claudeArgs` an `--effort` option). Spend: overall soft cap $40, not to interrupt a running build (T1 spike limit $3; the T8 ceilings are set so the cap is checked between runs, confirmed at the T8 gate) | Owner: "haiku is not the best for implementation"; prices given equal the existing `pricing.json` Sonnet entry; rejected: Haiku, Sonnet at default effort |
| C~7 | 2026-11-05 | The implementation task file gets an optional `post_setup` argv (starts with `node`), run after `setup_command` in every tree, because `npm ci --ignore-scripts` skips `prisma generate` and `tsc -b` then fails at the base commit (found in T1). Amends data-model.md and plan T2, T4, T5, T6; `setup_sha256` covers both | Found by the T1 spike, not asked by the owner; rejected: letting the baseline accept the 5 existing type errors (breaks E14), running install scripts (breaks N3) |
| C~4 | 2026-11-05 | Run the blind review on the three replicate-2 plans only, and move on to the implementation stage in a new branch off the pilot branch | Asked by the owner to keep cost low after the full runs had trouble completing; rejected: a review on all nine plans |

## 6. Known Gaps

- **Proposed, extends the experiment harness containment entry:** the implementation stage executes agent-written code and tests on the operator's machine, and the agent turn itself has the operator's file and network access. The harness uses a history-free clone, a verify tree built from harness-owned bytes, a stripped check environment, timeouts, a process sweep, canary tokens and disk polling, but no sandbox and no network block. Reads outside the clone and the agent's own spend (`claude -p`, direct API calls) can be detected in part and not prevented or counted. A build that returns plausible values without storing anything can pass the shared checks. Closing it needs a separate low-privilege user, a container or VM, and a dedicated API key with a console spend cap; the T8 gate records the operator's choice.
