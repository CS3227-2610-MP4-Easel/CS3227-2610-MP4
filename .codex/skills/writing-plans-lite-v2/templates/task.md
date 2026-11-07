# T1: <name>

**Delivers:** <outcome> | **Satisfies:** F1, E1 | **Depends on:** - | **Wave:** 1 | **Weight:** standard | **Review:** light (<reason if not default>)

> You are implementing this one task. This file plus the Shared context in your brief is everything you
> need. Do not read `STATE.md`, `guardrails.md`, the branch state or the spec. If this file is wrong or
> something it relies on is missing, stop and report it; do not guess.

## Expected state
Verify each before editing anything. If one fails, stop and return `status: blocked`.
- `path/to/Existing.ts` exists and exports `symbol` (check: `<grep or ls>`)
- `path/to/New.ts` does not exist
- From T0 handover: <name, shape the earlier task produced> (omit when there are no dependencies)

## Objective
<What exists when this task is done, in 2-4 lines.>

## Rules that apply
- <ID> <rule copied from guardrails / convention / decision, in one line>

## Contract
<Copied from the spec; authoritative for this task. Tag snippets [contract] or [impl].>

**Edge cases assigned**
| ID | Scenario | Expected behaviour (exact) |
|---|---|---|
| E1 | | |

## Files
| Action | Path | What changes |
|---|---|---|
| Create | `path/to/New.ts` | <responsibility> |
| Modify | `path/to/Existing.ts` (`symbol`) | <exact change> |
| Test | `path/to/New.test.ts` | <cases: E IDs> |

## Steps
1. Run `ws task start T1`. Write failing test for E1: <asserts>. Run `<TEST> <target>`; expect FAIL because <reason>.
2. Implement <change> in `New.ts`.
3. Run the same test; expect PASS.
4. Cover the remaining edge cases above (each a test whose name or comment cites its E ID).
5. `<BUILD>` green for each component touched.
6. Write `handovers/T1.json` (see Handover directions), commit code, tests and the handover with
   `type: what and why (workstream)` plus `Workstream:` and `Task: T1` trailers, then run `ws task done`.

## Handover directions
**Produces** (report each in `produces` with its real path and signature): <names later tasks use>.
**For T2:** <one line: what T2 needs to know from this task>.
**Also report:** anything surprising, any choice you made that the plan did not settle, and any
deviation from this file.
