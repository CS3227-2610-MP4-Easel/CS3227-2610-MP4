# W7b close-out coverage audit

Audit of test assertions, 2026-11-09. A listed test is evidence for the row, not a claim every subcase is covered. Full discover run: 713 pass, 8 fail, 0 skipped; E57 passes alone but timed out twice in suite. **N4 is incomplete until partial rows are covered and tests pass.**

## Requirements

| ID | Evidence | Status |
|---|---|---|
| F1 | edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts, plan-flow.test.ts | Partial: E1, E57 |
| F2 | edit-store.test.ts | Partial: E10, E13, E15, E16 |
| F3 | edit-store.test.ts, pm-edit-schemas.test.ts, pm-edit-routes.test.ts | Partial: E20, E21 |
| F4 | epic-list.test.ts, pm-edit-e2e.test.ts | Covered |
| F5 | regenerate-store.test.ts, plan-flow.test.ts | Partial: E38–E40, E42 |
| F6 | list.test.ts, pm-edit-routes.test.ts, pm-edit-e2e.test.ts | Covered |
| F7 | decide.test.ts, pm-edit-e2e.test.ts | Covered: regeneration-only approval tested |
| F8 | edit-store.test.ts, pm-edit-e2e.test.ts | Partial: E59 |
| N1 | plan-flow.test.ts (E38/E39 and N1) | Covered |
| N2 | edit-store.test.ts (E57/E58) | Partial: E57 flakes under suite load |
| N3 | list.test.ts (N3 query count) | Covered |
| N4 | E/T mapping below | Incomplete |

## Edge cases

| ID | Named test file(s) | Audit |
|---|---|---|
| E1 | plan-flow.test.ts, edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts | No explicit stale-version assertion for every endpoint through HTTP. |
| E2 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E3 | plan-flow.test.ts, edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts | All three closed states checked for regeneration and edit/add/delete/checkpoint operations. |
| E4 | pm-edit-e2e.test.ts, pm-edit-routes.test.ts, edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts | Named coverage; no gap identified in this audit |
| E5 | pm-edit-routes.test.ts | Named coverage; no gap identified in this audit |
| E6 | pm-edit-routes.test.ts | Named coverage; no gap identified in this audit |
| E7 | pm-edit-routes.test.ts, pm-edit-schemas.test.ts | Named coverage; no gap identified in this audit |
| E8 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E9 | pm-edit-routes.test.ts | Named coverage; no gap identified in this audit |
| E10 | edit-store.test.ts | Rename is tested; content-hash recomputation and unchanged epic version are not asserted. |
| E11 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E12 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E13 | edit-store.test.ts | Empty list is tested after epic links were already cleared. |
| E14 | pm-edit-schemas.test.ts, edit-store.test.ts | Named coverage; no gap identified in this audit |
| E15 | edit-store.test.ts | Swap is tested; rename chain is not. |
| E16 | edit-store.test.ts | No date-only update assertion. |
| E17 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E18 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E19 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E20 | edit-store.test.ts | DONE tasks preserved; approve after title change not asserted in this test. |
| E21 | edit-store.test.ts | FAILED case covered; expired IN_PROGRESS case lacks explicit status/tasks/error preservation assertions. |
| E22 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E23 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E24 | pm-edit-schemas.test.ts | Named coverage; no gap identified in this audit |
| E25 | pm-edit-schemas.test.ts | Named coverage; no gap identified in this audit |
| E26 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E27 | pm-edit-routes.test.ts | Named coverage; no gap identified in this audit |
| E28 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E29 | plan-flow.test.ts, edit-store.test.ts, regenerate-store.test.ts | Named coverage; no gap identified in this audit |
| E30 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E31 | epic-list.test.ts | Named coverage; no gap identified in this audit |
| E32 | epic-list.test.ts | Named coverage; no gap identified in this audit |
| E33 | epic-list.test.ts | Named coverage; no gap identified in this audit |
| E34 | epic-list.test.ts | Named coverage; no gap identified in this audit |
| E35 | epic-list.test.ts | Named coverage; no gap identified in this audit |
| E36 | pm-edit-routes.test.ts | Named coverage; no gap identified in this audit |
| E37 | epic-list.test.ts | Named coverage; no gap identified in this audit |
| E38 | plan-flow.test.ts, regenerate-store.test.ts | Task replacement and version covered; session count increment is not asserted after DONE regeneration. |
| E39 | plan-flow.test.ts | Sixth call is refused with no model call; final stored count is not asserted. |
| E40 | plan-flow.test.ts | Pending and failed paths run; failed-path session count is not explicitly checked. |
| E41 | plan-flow.test.ts, regenerate-store.test.ts | Failure preserves tasks, increments count and blocks approval. |
| E42 | regenerate-store.test.ts | Stale version and no model call checked; unchanged session count not explicitly asserted. |
| E43 | plan-flow.test.ts, regenerate-store.test.ts | Named coverage; no gap identified in this audit |
| E44 | plan-flow.test.ts | Closed and idle-expired sessions covered. |
| E45 | plan-flow.test.ts | Named coverage; no gap identified in this audit |
| E46 | decide.test.ts | Named coverage; no gap identified in this audit |
| E47 | plan-flow.test.ts | Named coverage; no gap identified in this audit |
| E48 | list.test.ts | Named coverage; no gap identified in this audit |
| E49 | pm-edit-routes.test.ts, pm-edit-schemas.test.ts | Named coverage; no gap identified in this audit |
| E50 | list.test.ts | Named coverage; no gap identified in this audit |
| E51 | list.test.ts | Named coverage; no gap identified in this audit |
| E52 | list.test.ts | Named coverage; no gap identified in this audit |
| E53 | pm-edit-e2e.test.ts, list.test.ts | Named coverage; no gap identified in this audit |
| E54 | pm-edit-e2e.test.ts, decide.test.ts | Named coverage; no gap identified in this audit |
| E55 | decide.test.ts | Actual regeneration followed by approval closes the session ACCEPTED. |
| E56 | decide.test.ts | Named coverage; no gap identified in this audit |
| E57 | decide.test.ts, edit-store.test.ts | Both lock orders pass in isolation; this test timed out under full and serial suite load. |
| E58 | edit-store.test.ts, epic-list.test.ts | Named coverage; no gap identified in this audit |
| E59 | pm-edit-e2e.test.ts, edit-store.test.ts | Thirty random sequences prove parse validity, but do not approve each; maximum-size plan approves. |
| E60 | edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts | Named coverage; no gap identified in this audit |

## Threats

| ID | Evidence | Audit |
|---|---|---|
| T1 | E4 | Covered |
| T2 | E1, E2, E42 | Partial: E1 and E42 |
| T3 | E57 | Partial: suite-timeout flake |
| T4 | E28, E29, E35, E37 | Covered |
| T5 | E9 | Covered |
| T6 | E39, E42 | Partial: persisted counts not asserted |
| T7 | Accepted in spec | Accepted |
| T8 | E33 | Covered |
| T9 | Accepted in spec | Accepted |
| T10 | E48, N3 | Covered |
| T11 | E59 | Partial: randomized approvals not asserted |
