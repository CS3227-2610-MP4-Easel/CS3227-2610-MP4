# Phase 1 Skill Test Results

- **Date:** 2026-10-31
- **Scope:** small-scale test of the new `project-state` / `branch-state` skills and the updated `sync-project-state`, using a throwaway fixture project (a ~10-file room-booking repo with a hot/cold state tree).
- **Method:** three fresh subagents (model `sonnet`), each given only the operator task and the skill file paths, told to report every file read and every instruction they could not follow.

## Token usage per stage

Totals are the subagent's whole run, so they include the harness baseline (system prompt and tool list), which cannot be separated here. Treat them as relative, not as skill cost. Phase 0 of the design still needs a per-stage measurement above baseline.

| Stage | Task | Tool calls | Tokens | Wall time |
|---|---|---|---|---|
| T1 Session start, small fix, record | Fix `listBookings`, create branch state, commit | 12 | 78,055 | 39 s |
| T2 Guardrail collision | "Add weekly recurring bookings, just do it" | 13 | 83,251 | 45 s |
| T3 Fold | Fold an approved branch state into the tree | 14 | 85,765 | 71 s |

Skill content actually read (bytes): T1 about 25 KB (both SKILL.md files, template, commits.md, plus hot state). T2 about 22 KB. T3 about 30 KB (adds sync, project-state, reconciliation, two templates).

Skill size before and after (bytes, SKILL.md only): old `maintaining-project-state` 16,419 loaded whole, plus an instruction to read the full state file. New `branch-state` 7,684 (was 11,096 before this test's trim), new `project-state` 7,295. Router target was about 3 KB, so both still exceed it.

## Effectiveness

| Check | Result |
|---|---|
| T1 recorded the change correctly (branch state created, `Untouched:` line, Changes line, no edit to `STATE.md`) | Pass |
| T1 read only hot state plus the one relevant area file, skipping `decisions/` | Pass |
| T2 stopped on the `guardrails.md` / C1 collision, wrote no production code, put the keep-or-reverse question in the branch state | Pass |
| T3 folded correctly: W~1 to W2, C~1 to C3, `decisions/C3.md` created from the template, area Now replaced, ledger updated, branch state archived with a fold record | Pass |
| Resumability of the records (agent's own estimate, T1) | About 90 percent |

Caveats: n=1 per scenario, same model family wrote the skills and tests them, and agents knew they were being evaluated. This shows the layout is workable, not that it saves tokens in real use.

## Defects found and fixed

1. Changes `Ref` needs a sha that cannot exist inside its own commit. Template now says to write `this commit` and fill the sha in the next write.
2. Branch-side reconciliation was ambiguous and was skipped. The `branch-state` skill now says its inline checks are mandatory and the full `project-state` reconciliation is for owner, fold, or bootstrap.
3. `sync-project-state` gaps: no Kind for non-Post-merge Handover items, no rule to remove an Upcoming row a folded workstream covers, ambiguous citation rewrite, no rule for duplicated entries. All clarified.
4. `branch-state/SKILL.md` was 11 KB. Lifecycle, merge-INT and status vocabulary moved to `reference.md`; duplicate red flags dropped.

## Not fixed or out of scope

- Both SKILL.md files remain above the 3 KB soft target.
- Fixture flaws, not skill flaws: stub `AGENTS.md` (missing §2, §6, §8), a fake base sha, no real merge.
- Not tested: bootstrapping a project from nothing, `refresh-project-state`, `update-documentation`, the `writing-*` and `executing-*` skills on the new layout.
- Agents suggested a decision-template `Rejected Alternatives` field the branch state does not supply; sync currently has to infer it.
