# Implementation Order

All paths are under `workflow/experiments/` and the harness is flat (`harness/*.mjs`, `harness/commands/*.mjs`). New module names avoid the existing `harness/baseline.mjs` (the CLI built-in sets); the new baseline module is `implbaseline.mjs`.

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T1 | Feasibility spike on the pilot task | Confirms on Windows: `npm ci --ignore-scripts`, typecheck and `node --test` with the TAP reporter run in a history-free tree under the N3 environment (records the final variable list in `isolation.md`); that a detached child survives `taskkill /T` and the end-of-turn sweep finds it; that a clone made by `git archive` plus `git init` has no other refs; that `tsx` resolves from a pristine baseline tree; the time to copy `node_modules` into a verify tree; time of setup and checks; prices for the implementer model confirmed by the operator against `pricing.json` (GATE: operator confirms the prices and a spend limit, and acknowledges the agent-turn exposure in Known Gaps); toy cost of one build | N1, N3, F5, F6, SD10 |
| T2 | Schema, validation and testkit | `schema.mjs` gains the implementation task, arm and experiment validators (a second experiment validator selected by `stage`, the prompt placeholder allowlist for the implementer arm); `exp.mjs` dispatch and `check.mjs` cover them; `testkit.mjs` gains a toy implementation task, a toy adapter and a toy shared runner; `arms/implementer-cheap.json` (model `claude-sonnet-5-5`, effort `low`; `spawn.mjs` `claudeArgs` gains an `effort` option); `driver.mjs` stage switch that keeps exit 8 for `ablation`, `model_tier` and, until T6 lands, `implementation` | F2, F3, E8, E9, E10, E13 |
| T3 | `exp snapshot` | `harness/snapshot.mjs`, `commands/snapshot.mjs` | F1, E1 to E7 |
| T4 | Check runner and `exp baseline` | `harness/implchecks.mjs` (stripped-environment runner with timeout, caps, tree kill and process sweep, parsers, verify-tree builder with the filesystem and lockfile rules, F10 rule, protected paths, adherence metrics), `harness/implbaseline.mjs`, `commands/baseline.mjs` | F4, F8, F10, F12, F15, N3, E14 to E18, E31 to E48, E62 to E64 |
| T5 | Shared checks and adapters for the three pilot plans | `tasks/pilot-pinned-note-impl/` (`task.json` with `base_commit` and `brief_file` copied from `tasks/pilot-pinned-note`, the check commands, `protected_globs`), `acceptance/checks.json` with CHK1 to CHK8, canary tokens, `runner.mjs` (parent) and `host.mjs`, one adapter per plan id written from the `artifacts/` of the three source runs (not from snapshots) and reviewed by the operator before any real run | F9, E54 to E61 |
| T6 | Implementation driver | `harness/impldriver.mjs` and the `driver.mjs` hook: history-free clone, setup, plan commit, prompt, fixed question policy, attempt 1, checks, feedback, attempt 2, `--continue`, ceilings, end-of-turn sweep and outside-clone scan, containment set extended | F5, F6, F7, F11, N1, E19 to E30, E49 to E53, E71 to E74, E83 to E92 |
| T7 | Code review and `exp grade` | `harness/implreview.mjs` (reuses `blindreview.mjs` helpers), `grade.mjs` gains the implementation path | F13, N2, E65 to E70, E81, E82 |
| T8 | Report and pilot run | `harness/implreport.mjs`, `report.mjs` gains the implementation path; `impl-runs.csv`, `impl-summary.csv`; then, in order: `exp snapshot` of the three source runs (operator reviews scan hits), `exp baseline pilot-pinned-note-impl`, commit `experiments/impl-pilot-001.json` with the snapshot hashes and ceilings, then the real run of 3 plans x 2 samples (GATES: ceilings confirmed; the operator records in the branch state how the batch is protected: a separate low-privilege Windows user or explicit acceptance of the exposure, and whether a dedicated API key with a console spend cap is used); result recorded in the branch state | F14, N4, E75 to E80 |

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Feasibility spike | - | - | 1 |
| T2 Schema, validation and testkit | T1 | - | 2 |
| T3 `exp snapshot` | T2 | T4, T5 | 3 |
| T4 Check runner and `exp baseline` | T2 | T3, T5 | 3 |
| T5 Shared checks and adapters | T2 | T3, T4 | 3 |
| T6 Implementation driver | T3, T4, T5 | - | 4 |
| T7 Code review and `exp grade` | T6 | - | 5 |
| T8 Report and pilot run | T7 | - | 6 |

Shared-file hazards: `harness/schema.mjs`, `harness/exp.mjs` and `harness/check.mjs` are edited by T2 only; `harness/driver.mjs` by T2 (stage switch) then T6; `harness/testkit.mjs` by T2 only (T3 to T6 add their own test files); `harness/grade.mjs` by T7 only; `harness/report.mjs` by T8 only; T5 writes only under `tasks/pilot-pinned-note-impl/`. T3, T4 and T5 touch no common file. Cut line if time is short: drop the F13 review call in T7 and report `review_*` as empty; F1 to F12, F14 and F15 stay. The three pilot source runs for `exp snapshot` are `20261103-113753-pilot-pinned-note-superpowers-r2`, `20261103-114628-pilot-pinned-note-lite-r2` and `20261104-095259-pilot-pinned-note-full-r2` of experiment `pilot-001`.
