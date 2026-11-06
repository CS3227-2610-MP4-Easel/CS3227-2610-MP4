# Experiment framework pilot: overall report

Date 2026-11-06. Branch `w7-exp-implementation-stage` (extends the framework of `w7-pm-plan-flow`). Sources: `pilot-001/README.md`, `runs.csv`, `medians.csv`, `impl-runs.csv`, `impl-summary.csv`, the branch state (`workflow/project-state/branch-states/w7-exp-implementation-stage.md`). All figures are USD unless stated. Every number is from the recorded runs; nothing is estimated except where marked.

**Read this first.** Both stages ran with very small samples (plan stage 1 comparable replicate per arm, implementation stage 2 samples per plan, one plan with none completed). Nothing here ranks the three plan variants or says whether extra plan effort pays off. What the pilot did achieve is a working, costed measurement pipeline and a list of concrete defects to fix before a real comparison.

## 1. What was built

| Stage | What exists now | State |
|---|---|---|
| Plan stage (earlier branch `w7-pm-plan-flow`) | Run a plan-writing arm (`superpowers`, `lite`, `full`) against a task, answer its questions, extract cost and events, lint, rubric score, blind review, medians report | Done, piloted on `pilot-pinned-note` |
| Implementation stage (this branch, T1 to T8) | History-free agent clone per sample, a harness-owned verify tree (typecheck, lint, the agent's own tests, baseline tests, 8 shared acceptance checks), a second attempt with failure feedback, containment and cost ceilings, an advisory model review, `exp grade`, `exp report` with pass@1, pass@2, cost to green and expected cost to green | Done and exercised on a real batch; the comparison itself is inconclusive |
| Experiment `impl-pilot-001` | Three plans (superpowers-r2, lite-r2, full-r2) x 2 samples, one implementer arm (Sonnet at low effort), ceilings 10 per run and 70 per batch | Stopped by the owner at n=2 per plan |

The branch has 30 commits since `w7-pm-plan-flow` (460 files changed against `development`, mostly the harness, its tests and state files).

## 2. Plan stage: what writing the spec and plan cost

Task `pilot-pinned-note`, model `claude-sonnet-5-5`. Replicate 2 of each arm is the comparison (the other replicates are in `runs.csv` as spread; `full` r1 was interrupted and resumed, `full` r3 aborted).

| Arm | Plan cost | Wall (s) | Questions | Planted issues raised / found | Rubric (of 40) | Plan lint errors |
|---|---|---|---|---|---|---|
| superpowers | 0.346 | 147 | 1 | 4 / 3 resolved | 28.5 | n/a |
| lite | 1.7406 | 642 | 1 | 4 / 3 resolved | 32.5 | 1 |
| full | 4.4948 | 1474 | 1 | 4 / 3 resolved | 33.5 | 1 |

Across all replicates: `superpowers` costs 0.28 to 0.35 (3 runs), `lite` 1.44 to 1.74 (3 runs), `full` 4.49 and 8.81 (r1, interrupted) plus an aborted 0.38 run. Cost grows about 5x (lite) and 13x (full) over superpowers for a rubric gain of 4 and 5 points of 40, from one replicate each. The report's verdict is `inconclusive` for every pair involving `full` and `tradeoff` between lite and superpowers.

## 3. Implementation stage: what building from each plan cost

Implementer arm `implementer-cheap`, 2 attempts per run, green rule in section 6. Plan cost is the plan-stage cost above, shown to give the full cost of a plan plus its build.

| Plan | Plan cost | Run | Attempt 1 | Attempt 2 | Build cost | Review cost | Wall (s) | Green | Shared checks passed |
|---|---|---|---|---|---|---|---|---|---|
| superpowers-r2 | 0.346 | s1 | not green | **green** | 1.4335 | 0.1301 | 772 | yes (attempt 2) | 8 of 8 |
| superpowers-r2 | 0.346 | s2 | not green | not green | 1.5197 | 0.1305 | 957 | no | 3 of 8 |
| lite-r2 | 1.7406 | s1 | not green | not green | 1.7566 | 0.1947 | 971 | no | 8 of 8 |
| lite-r2 | 1.7406 | s2 | not green | not green | 2.2519 (1) | 0.2134 | 1461 | no | 8 of 8 |
| full-r2 | 4.4948 | s1 | n/a | n/a | none | none | 1803 | aborted, `turn_timeout_s`, 0 events | n/a |
| full-r2 | 4.4948 | s2 | n/a | n/a | none | none | 5 | aborted, account 5-hour limit | n/a |

(1) lite-r2 s2 was resumed with `--continue`; the CLI total restarted at 0.54, the event-derived cost is 2.2519, and 2.2519 is the one used.

Derived from the table, with n=2:
- Build cost per run is 1.43 to 2.25; the four completed plan-and-build pairs cost 1.78 (superpowers plan plus s1 build) to 3.99 (lite plan plus s2 build) each. A build costs about 4x the superpowers plan and about 1x the lite plan.
- The more expensive plan did not give a cheaper build: the superpowers builds were the cheapest and fastest (772 and 957 s against 971 and 1461 s). With two samples this is a pointer, not a finding.
- Superpowers pass@1 0/2, pass@2 1/2; expected cost to green 3.2991 (the report's formula: plan cost plus mean run cost divided by the green share). Lite 0/2 and 0/2. Full 0/2 and 0/2, both aborted.
- Review (advisory, one same-model reviewer, not part of green): blockers 1 or 2 in every completed run, majors 5 to 7 (superpowers 6 and 5, lite 7 and 5), no separation between plans.
- Adherence: files changed off plan 6 and 9 (superpowers), 7 and 7 (lite).
- Spend: the four completed runs cost 7.0 in build and 0.7 in review (the two full-r2 aborts cost almost nothing). The plan stage cost about 19.4 in arm cost over its 9 runs. All implementation batches together, including the invalid, aborted and resumed ones, cost about 25 (approximate: each batch only records its own total).

## 4. What failed and why

| # | Failure | Effect | Status |
|---|---|---|---|
| 1 | Isolation probe rejected the built-in agent `web-fetch` | All six runs of the first batch aborted at the probe | Fixed (added to built-in agents) |
| 2 | Verify tree: `.next` build output exceeded the file-size limit; nested `node_modules` missing | Second batch invalid | Fixed (skip `.next`, copy every pristine `node_modules`) |
| 3 | Path whitelist refused Next.js route names `[[...slug]]` | full-r2 runs unverifiable (all checks "not run") | Fixed (58e6775) |
| 4 | Agent left `.tmp-pg/` Postgres data over 5 MB | lite-r2 s2 unverifiable in the first attempt | Fixed (directory skipped) |
| 5 | `npm ci --ignore-scripts` after `deps_changed` leaves the Prisma client ungenerated | Both lite runs fail typecheck with the same 5 `@prisma/client` errors and one newly failing baseline test | **Not fixed, not confirmed by a rerun** |
| 6 | Both lite runs changed 6 existing protected test files and `tsconfig.json` | Red flag `protected_modified` | Not examined: plan content or task design |
| 7 | Batch process exited silently with code 1 in its first minute, three times | Runs left half-started; a queued run cannot be continued | Cause not found; `--continue` worked once |
| 8 | Account 5-hour limit hit twice | Two full-r2 attempts aborted | Outside the harness |
| 9 | One full-r2 launch stalled (`turn_timeout_s`, 0 events) | Aborted, no data | Recorded as a timeout abort |
| 10 | Resumed run reports a CLI total after the restart | Per-run cost and the ceiling undercount a resumed run | Known, workaround: use event-derived cost |

Items 1 to 4 were harness defects found by real spend and fixed; 5 to 7 and 10 are open.

## 5. Likely issues and pitfalls for the next run

- **Grading is mechanical, review is not.** Green rests on typecheck, lint, own tests, baseline tests, the required shared checks and the flags. The review is one same-model call whose counts are neither severity-weighted nor validated against known defects, and `diff_truncated` hides findings on large diffs. Do not quote review counts as quality.
- **Harness artifacts can masquerade as quality.** Items 3, 4 and 5 each made a plan look worse. Before any comparison, rerun the verify step on the recorded clones after fixing item 5, with a check that a clean pristine run is green.
- **Sample size.** With 2 samples per plan the spread between samples (superpowers s1 green, s2 3 of 8 shared checks) is as large as any difference between plans. A power calculation has to come before launch.
- **Cost is dominated by the build, not the plan**, except for `full` (plan 4.49 plus a build that never completed). A fair comparison needs the full plan's build.
- **Shared infrastructure.** Runs take 13 to 30 minutes each and one batch of six is 2 to 3 hours; the account limit and the silent process exit both interrupt batches, so plan batches of one or two runs and use `--continue`.
- **Containment is partial.** The agent runs with the operator's file and network access, no sandbox and no dedicated API key (Known Gap recorded). `outside_clone_access` was raised on several runs and is a red flag.

## 6. How a run is graded

Green after an attempt requires: typecheck 0 errors, lint 0 errors, at least one own test that ran and passed and none failed, no newly failing or missing baseline test, every required shared check passed, no protected or plan file changed, and no red flag (`outside_clone_access`, `unsafe_path`, `protected_modified`, `plan_modified`, timeouts, tampering). Pass@1 counts samples green at attempt 1, pass@2 at attempt 2 or earlier. Cost to green is the build cost up to the green attempt; expected cost to green adds the plan cost and divides by the share of green samples. Review severity and comprehensiveness never change green.

## 7. What was achieved

1. A tested implementation stage (T1 to T8), verified against a fake CLI without spend and then against a real batch, with cost accounting that matches the CLI total on every uninterrupted run.
2. Real per-plan costs for plan writing (0.35, 1.74, 4.49) and for building (1.43 to 2.25), the first costed link between a plan and the code built from it.
3. Ten defects found by use, six fixed.
4. A decision, recorded, to stop spend at n=2 and not to draw a ranking.

## 8. Recommended next steps (not started)

1. Generate the Prisma client after a deps reinstall (or run the verify tree from the pristine `node_modules` when only the lockfile is unchanged), then re-verify the two lite clones offline; no new spend.
2. Examine why both lite builds changed protected tests and decide whether that is plan content or task design.
3. Add a ground-truth defect set or a blinded second reviewer, and weight review findings by severity.
4. Find the cause of the silent batch exit; fix the resumed-run CLI total.
5. Size the sample with a power calculation, then run `full-r2` and the others with at least 5 samples per plan.
