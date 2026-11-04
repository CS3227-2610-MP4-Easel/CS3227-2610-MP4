# Implementation Order

All paths are under `workflow/experiments/` and the harness is flat (`harness/*.mjs`, `harness/commands/*.mjs`). New module names avoid the existing `harness/baseline.mjs` (the CLI built-in sets); the new baseline module is `implbaseline.mjs`.

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T1 | Feasibility spike on the pilot task | Confirms on Windows: `npm ci --ignore-scripts`, typecheck and `node --test` with the TAP reporter run in a history-free tree under the N3 environment (records the final variable list in `isolation.md`); that a detached child survives `taskkill /T` and the end-of-turn sweep finds it; that a clone made by `git archive` plus `git init` has no other refs; time of setup and checks; prices for the implementer model read from the provider page and written to `pricing.json` (GATE: operator confirms the prices, a spend limit, and acknowledges the agent-turn exposure in Known Gaps); toy cost of one build | N1, N3, F5, F6, SD10 |
| T2 | Schema, validation and testkit | `schema.mjs` gains the implementation task, arm and experiment validators (a second experiment validator selected by `stage`, the prompt placeholder allowlist for the implementer arm); `exp.mjs` dispatch and `check.mjs` cover them; `testkit.mjs` gains a toy implementation task, a toy adapter and a toy shared runner; `driver.mjs` stage switch with exit 8 kept for `ablation` and `model_tier` | F2, F3, E8, E9, E10, E13 |
| T3 | `exp snapshot` | `harness/snapshot.mjs`, `commands/snapshot.mjs` | F1, E1 to E7 |
| T4 | Check runner and `exp baseline` | `harness/implchecks.mjs` (stripped-environment runner with timeout, caps and tree kill, parsers, verify-tree builder, F10 rule, protected paths, adherence metrics), `harness/implbaseline.mjs`, `commands/baseline.mjs` | F4, F8, F10, F12, F15, N3, E14 to E18, E31 to E48, E62 to E64 |
| T5 | Shared checks and adapters for the three pilot plans | `tasks/pilot-pinned-note-impl/` (task.json, brief), `acceptance/checks.json` with CHK1 to CHK8, `runner.mjs`, one adapter per plan id written from the plan text and reviewed by the operator before any real run | F9, E54 to E61 |
| T6 | Implementation driver | `harness/impldriver.mjs` and the `driver.mjs` hook: history-free clone, setup, plan commit, prompt, fixed question policy, attempt 1, checks, feedback, attempt 2, `--continue`, ceilings, end-of-turn sweep and outside-clone scan, containment set extended | F5, F6, F7, F11, N1, E19 to E30, E49 to E53, E71 to E74, E83 to E92 |
| T7 | Code review and `exp grade` | `harness/implreview.mjs` (reuses `blindreview.mjs` helpers), `grade.mjs` gains the implementation path | F13, N2, E65 to E70, E81, E82 |
| T8 | Report and pilot run | `harness/implreport.mjs`, `report.mjs` gains the implementation path; `impl-runs.csv`, `impl-summary.csv`; the real run of 3 plans x 2 samples (GATES: ceilings confirmed, the T1 exposure acknowledgement repeated, then the batch); result recorded in the branch state | F14, N4, E75 to E80 |

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
