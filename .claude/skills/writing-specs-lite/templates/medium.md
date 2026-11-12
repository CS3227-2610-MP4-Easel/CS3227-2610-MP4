# <Topic> (Medium spec: this file is also the plan)

<!-- Keep under ~4 KB. One file: problem, goals, contract delta, edge cases, task list. -->

- **Status:** Draft | In review | Approved (operator name, date)
- **Tier:** Medium - <one sentence why it is not Small or Big>
- **Risk:** Low | Medium - <why>
- **Workstream:** <ID or W~n>
- **Constraints consulted:** <guardrails.md / decision / convention IDs>

## Problem
<Current behaviour (verified in code) and desired behaviour, side by side. 2-5 lines.>

## Goals / Non-goals
- F1 <testable goal> | N1 <non-functional, with a number>
- Non-goal: <thing deliberately not done> - <why; ID if recorded>

## Contract delta
<Only what changes: signatures, fields, JSON shapes, error codes, role/permission rule. A table is fine. Cite architecture contracts by anchor; do not restate them.>

## Edge cases
| ID | Req | Scenario | Expected behaviour (exact) |
|---|---|---|---|
| E1 | F1 | | |

## Tasks (this list is the plan)
- [ ] T1 <outcome> - files: `path` - tests: <name, cites E-IDs> - satisfies F1
- [ ] T2 ...
- [ ] T-last Close-out: build green, branch state updated, review requested

**Decisions made here:** <ID, decision, why / rejected> or "none".
