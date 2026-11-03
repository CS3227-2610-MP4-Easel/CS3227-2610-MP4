# Experiment Framework Design

> Amended 2026-11-03 after the plan review: see branch state C~10 (T6 depends on T3, T4 and T5; waves become six; `pricing.mjs` moves to T1; commands load from `harness/commands/`).

- **Status:** Approved (Xiao-Congchen, 2026-11-03)
- **Risk tier:** Medium - the harness launches agents with tool access on a developer machine, may use an API key, and sends agent output to a judge model; it touches no product data, auth or money. The Attacker lens is added for those reasons.
- **Workstream:** new workstream (permanent id assigned at fold) | **Plan:** not written
- **Constraints consulted:** AD-30 (generalist baseline on one comparable task), AD-31 (process telemetry), AD-23b (model experiment, Q4), AD-32 (no secrets in the repo), AD-69 (feature freeze 10 Nov), C2 (specs and plans location), C3 (owner approves own work), C8 (source under `src/`, see SD11), `AGENTS.md` § 9 (never edit `workflow/skills/`)
- **Reviewed by lenses:** Implementer, Tester, Attacker, two rounds (the cap); round 2 found no blockers and its major findings are merged here

## 1. Problem
The team wants evidence for the reflection (R5, R7) on resource-aware use and context engineering in the development process: which agent workflow gives the best spec and plan per token, dollar and minute. Today there is no way to run the same task under different configurations, no record of tokens, runtime, pass rates or questions per run, and no scoring that compares artifacts. `.claude/skills/project-state/experiments.md` holds a model-routing hypothesis with fixtures but no runner. AD-31 decides the telemetry sources and the CSV location but not how runs are produced or scored; W17 later owns the aggregation script.

Desired: a local harness that runs one task under N arms (configurations) with R replicates each, in isolated clones, controls how the agents' questions are answered, extracts per-call usage from the transcripts, scores the artifacts, and writes CSVs under `docs/telemetry/experiments/`. The first build covers the spec-and-plan stage only, because feature freeze is 10 Nov (AD-69). The real subject is W7: its spec and plan need only W1's frozen interfaces (`src/be/contracts/src/frozen.ts`), so that run can start once W1 merges (W2, W3, W5 and W6 gate W7's build, not this comparison); a synthetic pilot task proves the harness first and prunes arms, but does not pick the winner. This framework extends AD-31 (its OpenTelemetry export is one input; results land where AD-31 puts them) and governs data generation and storage plus its own run flow; it does not change how normal development sessions run.

## 2. Goals
Seventeen functional and eight non-functional requirements, each with an acceptance criterion: [requirements.md](2026-11-03-experiment-framework-design/requirements.md). Summary:
- **Controlled runs:** arms and tasks are data; each run is isolated in its own clone, environment-verified, contained, budget-capped and recorded (F1-F6, F14, F15, F17).
- **Question control:** a scripted sheet for the pilot; a shared answer bank with pause and resume for the real run (F7, F8, F11).
- **Measurement:** per-call events, phases, cost, grading and CSV reports (F9, F10, F12, F13, F16).
- **Quality of the harness:** cost accuracy, no secrets committed or sent out, fair time accounting, Windows support, crash safety (N1-N8).

## 3. Non-goals
- Implementation-stage, ablation-ladder and model-tier runners - later phases; the schema reserves the stage values and v1 rejects them with exit 8.
- The real W7 task bundle and run - a separate spec and plan once W1 merges.
- A web dashboard or board - the ponytail board stays a manual cost cross-check only.
- Statistical significance testing - medians, ranges and geometric means are reported, no p-values, and the harness declares no winner.
- Editing vendored skills or agents - arms use them as shipped (`AGENTS.md` § 9).
- The product's runtime metering (`llm_calls`, `ai_sessions`) - a different system.
- Running in CI, or OS-level sandboxing of the agent - local, operator-started runs; the accepted residual risk is in runtime.md § Containment.
- A Codex driver - v1 spawns the Claude CLI only; a Codex adapter belongs to the implementation-stage phase and needs its own transcript parser.

## 4. Components
- [Requirements](2026-11-03-experiment-framework-design/requirements.md) - F1-F17 and N1-N8 with acceptance criteria
- [Runtime mechanics](2026-11-03-experiment-framework-design/runtime.md) - process model, driver rules, isolation, containment, model calls, metric formulas, reports, planned arms
- [Data model](2026-11-03-experiment-framework-design/data-model.md) - files, schemas, lifecycle, CSV columns
- [API](2026-11-03-experiment-framework-design/api.md) - the `exp` command line and exit codes
- [Conventions](2026-11-03-experiment-framework-design/conventions.md) - layout, naming, formats, secrets and test rules
- [Edge cases](2026-11-03-experiment-framework-design/edge-cases.md) - failures, isolation breaks, budget, matcher pairs
- [Implementation order](2026-11-03-experiment-framework-design/implementation-order.md) - T1-T10 with waves, pilot gate and cut line
- No UI: the interface is a command line and CSV files.

## 5. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

## 6. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Transcripts are the primary data source; OpenTelemetry output (AD-31) is stored beside them as a cross-check when the exporter works; if T2 shows it cannot write a file headless, the cross-check is dropped and a Deviation against AD-31 is recorded | Transcripts carry per-call usage, model and subagent ids; OTel alone is not per agent (AD-31 option A). Rejected: OTel only | Claude, from AD-31 |
| SD2 | The harness is Node ESM with no dependencies | Matches `workflow/tools/ws.mjs`; rejected: Python (a second runtime for the team) | Claude |
| SD3 | Arms run headless (`claude -p`) and are resumed once per operator-facing question; one `exp run` process owns the batch | Makes questions interceptable; rejected: interactive sessions (not repeatable, timing leaks) | Owner |
| SD4 | Raw transcripts, questions and the bank stay under gitignored `local/`; only CSVs, manifests and configs are committed | AD-32; transcripts can hold secrets or paths | Claude |
| SD5 | Pilot replicates: 3 per arm, with 2 extra for an arm whose cost variation is above 0.5, capped at 5 | Median of three is the smallest sample that shows spread | Claude |
| SD6 | Each run uses a local clone with its own `.git`, not a `git worktree` | A worktree shares `.git` hooks and config with the main repo (Attacker review); rejected: worktree plus snapshots only | Claude, from review |
| SD7 | Bank questions are matched by normalised exact text only; a model may suggest a duplicate but the operator confirms with `--same-as` | Keeps matching deterministic and closes an injection path; cost: more operator answers when arms reword | Claude, from review |
| SD8 | Grading is pointwise (each artifact scored alone, two calls), not pairwise; the judge sees artifacts without arm ids, and blinding is best effort because style can reveal an arm | Pairwise needs order control and grows with arm count | Claude |
| SD9 | Aborted runs are extracted and counted in cost medians; they are excluded from quality medians | A cost study must include the runs that blew the budget | Claude, from review |
| SD10 | The three v1 arms are `superpowers`, `lite` and `full` as listed in runtime.md | Confirmed by the operator | Owner |
| SD11 | The harness lives in `workflow/experiments/`, outside `src/`, like `workflow/tools/ws.mjs`; `EXP_ROOT` is resolved at run time so a move is a folder move | Confirmed by the operator; rejected: `src/tools/experiments/` (mixes process tooling into the product tree) | Owner |
| SD12 | Containment is detection plus isolation (separate clone, environment allowlist, hash checks), with the residual risk in runtime.md accepted | Confirmed by the operator; rejected: a VM or container now (setup time before the freeze), still available later | Owner |
| SD13 | Runs authenticate with the operator's subscription login (`auth_mode` `login`); USD cost is notional, computed from `pricing.json`. USD ceilings are set in T8 from the cost T2 measures | Confirmed by the operator; rejected: a dedicated API key (new credential and credit to manage), the SoCLaaS key (OpenAI-compatible open-weight models, no cache split, shared with the app, results would not transfer to Claude and Codex runs) | Owner |
| SD14 | The judge model defaults to the `strong` tier in `models.json`; `judge_same_model` is flagged in reports when it equals the arm's main model | Confirmed by the operator; rejected: a separate judge model now (another model to configure) | Owner |
