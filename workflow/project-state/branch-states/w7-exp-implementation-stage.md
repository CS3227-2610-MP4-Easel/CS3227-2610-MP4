# Branch State — w7-exp-implementation-stage

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7-exp-implementation-stage (cut from branch `w7-pm-plan-flow` at `f576257`, which is from `INT` at `2139533`)
- **Base:** 160053c (the `INT` commit last merged into the parent branch)
- **Owner:** Xiao-Congchen (PM)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-05 by Claude Sonnet 5.5 — spec approved, plan next

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
| S1 | 2026-11-05 | Claude Sonnet 5.5 | W~1 | Active | Writing the plan (`writing-plans-lite`) | Plan file `workflow/plans/2026-11-05-experiment-implementation-stage.md`, one section per task T1 to T8; lint with `.claude/skills/writing-plans-lite/scripts/lint.mjs`, one review, then ask the owner for gate 2 | 2026-11-05 |

**Remaining**

- [ ] Plan (`writing-plans-lite`) and gate 2.
- [ ] **Handover:** fix the question classifier overcount found in the pilot: a final message with no question that says the agent is waiting for a subagent is counted as a question, which inflates `questions` for `lite` and `full`.
- [ ] **Handover:** Codex driver for the implementation stage (launcher, transcript parser, price list, isolation check); the spec leaves it out on purpose (SD1).
- [ ] **Handover:** a real W7 comparison needs its own spec and plan once W2, W3, W5 and W6 land.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W~1 | Experiment implementation stage (extends the framework workstream of branch `w7-pm-plan-flow`) | Spec'd | [spec](../../specs/2026-11-05-experiment-implementation-stage-design.md) (approved 2026-11-05) | — | Big · spec drafted, spec approved at gate 1; plan next | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-05 | Branch and worktree created from the parent branch after the pilot and the blind review of the three replicate-2 plans | W~1 | `f576257` |
| 2026-11-05 | Spec drafted: index plus requirements, data model, API, edge cases and implementation order; lint clean | W~1 | this commit |
| 2026-11-05 | Spec approved at gate 1 by the owner, with the adapter form (SD2), the Haiku price gate (SD10) and the T8 exposure choice accepted | W~1 | this commit |
| 2026-11-05 | Review round 2 (Implementer 4 major; Attacker 3 blocking, 4 major) fixed: shared-check verdicts decided by a parent process (host child answers over IPC), lockfile validation, name whitelist and `node` argv, filesystem rules in the verify-tree builder, no git in the clone, canary tokens, disk polling, per-attempt metrics, exit-code split, T2 to T8 inputs and ownership clarified; lint clean | W~1 | this commit |
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
| C~4 | 2026-11-05 | Run the blind review on the three replicate-2 plans only, and move on to the implementation stage in a new branch off the pilot branch | Asked by the owner to keep cost low after the full runs had trouble completing; rejected: a review on all nine plans |

## 6. Known Gaps

- **Proposed, extends the experiment harness containment entry:** the implementation stage executes agent-written code and tests on the operator's machine, and the agent turn itself has the operator's file and network access. The harness uses a history-free clone, a verify tree built from harness-owned bytes, a stripped check environment, timeouts, a process sweep, canary tokens and disk polling, but no sandbox and no network block. Reads outside the clone and the agent's own spend (`claude -p`, direct API calls) can be detected in part and not prevented or counted. A build that returns plausible values without storing anything can pass the shared checks. Closing it needs a separate low-privilege user, a container or VM, and a dedicated API key with a console spend cap; the T8 gate records the operator's choice.
