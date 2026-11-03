# Branch State — w7-pm-plan-flow

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w7-pm-plan-flow (from `INT` at `2139533`)
- **Base:** 2139533
- **Owner:** Xiao-Congchen (PM)
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-03 by Claude Sonnet 5.5 — spec revised after review round 2

**Untouched:** Architecture, Conventions, Deviations

---

**Scope.** Two things share this branch. (1) W7 PM plan flow, the owner's slice: **not started**, blocked on W1 (in review), then W2, W3, W5, W6. (2) A new workstream, `W~1` Experiment framework: a harness and schema to run the same task under different agent-workflow configurations and compare tokens, cost, runtime, pass rates and artifact quality. The framework goes in first because it needs none of W7's dependencies; W7 later becomes its first test subject. Worktree: `../CS3227-2610-MP4-w7`.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-03 | Claude Sonnet 5.5 (lead) + reviewer subagents | W~1 | Active | Spec revised after review rounds 1 and 2 (the cap); no open questions; gate 1 asked | On the owner yes to gate 1, write `Status: Approved (Xiao-Congchen, date)` in the spec index, run `lint.mjs spec --approved`, then start `writing-plans-lite`; on changes, fix the files and ask again | 2026-11-03 |

**Remaining**

- [ ] Spec for W~1, then gate 1; then plan, gate 2.
- [ ] W7 itself: wait for W1 to merge, then W2, W3, W5, W6 (STATE.md §3).
- [ ] **Handover:** tell the Dev Lead that W~1 overlaps W17 (telemetry aggregation script, AD-31) and AD-23b / Q4 (model experiment).

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W~1 | Experiment framework (agent-workflow evaluation) | Spec'd | [spec](../../specs/2026-11-03-experiment-framework-design.md) (draft, reviewed twice) | — | Big · spec has no open questions; gate 1 asked | — |
| W7 | PM plan flow (proposals, pm) | Not started | — | — | untouched on this branch; blocked on W1, W2, W3, W5, W6 | — |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-03 | Branch and worktree created from `INT`; branch state written | W~1 | `32b641b` |
| 2026-11-03 | Experiment framework spec drafted (index plus six components), lint clean | W~1 | `2cc3ec3` |
| 2026-11-03 | Spec revised after two review rounds: runtime.md added, containment, isolation, bank, metrics, cost and reporting rules tightened | W~1 | this commit |

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
