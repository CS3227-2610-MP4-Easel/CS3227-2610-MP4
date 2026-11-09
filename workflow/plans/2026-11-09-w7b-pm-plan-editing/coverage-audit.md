# W7b close-out coverage audit

Audit of test assertions, 2026-11-09. A listed test is evidence for the row, not a claim every subcase is covered. Final full discover run: 721 pass, 7 fail, 0 skipped; E57 passed after fixture isolation (c6fae04). The seven failures are recorded in branch state D~10.

## Requirements

| ID | Evidence | Status |
|---|---|---|
| F1 | edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts, plan-flow.test.ts | Coverage added; E57 passed in full-suite rerun |
| F2 | edit-store.test.ts | Covered: chain, empty-list and date-only cases added |
| F3 | edit-store.test.ts, pm-edit-schemas.test.ts, pm-edit-routes.test.ts | Covered: completed and expired expansion cases added |
| F4 | epic-list.test.ts, pm-edit-e2e.test.ts | Covered |
| F5 | regenerate-store.test.ts, plan-flow.test.ts | Covered: persisted count and replacement verified |
| F6 | list.test.ts, pm-edit-routes.test.ts, pm-edit-e2e.test.ts | Covered |
| F7 | decide.test.ts, pm-edit-e2e.test.ts | Covered: regeneration-only approval tested |
| F8 | edit-store.test.ts, pm-edit-e2e.test.ts | Thirty varied edit sequences and maximum-size plan approved through HTTP |
| N1 | plan-flow.test.ts (E38/E39 and N1) | Covered |
| N2 | edit-store.test.ts (E57/E58) | E57 passed in full-suite rerun |
| N3 | list.test.ts (N3 query count) | Covered |
| N4 | E/T mapping below | Mapping audited; full suite has unrelated failures (D~10) |

## Edge cases

| ID | Named test file(s) | Audit |
|---|---|---|
| E1 | pm-edit-e2e.test.ts, plan-flow.test.ts, edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts | All five editing endpoints tested over HTTP for stale-version 409, unchanged proposal and no model call. |
| E2 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E3 | plan-flow.test.ts, edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts | All three closed states checked for regeneration and edit/add/delete/checkpoint operations. |
| E4 | pm-edit-e2e.test.ts, pm-edit-routes.test.ts, edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts | Named coverage; no gap identified in this audit |
| E5 | pm-edit-routes.test.ts | Named coverage; no gap identified in this audit |
| E6 | pm-edit-routes.test.ts | Named coverage; no gap identified in this audit |
| E7 | pm-edit-routes.test.ts, pm-edit-schemas.test.ts | Named coverage; no gap identified in this audit |
| E8 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E9 | pm-edit-routes.test.ts | Named coverage; no gap identified in this audit |
| E10 | edit-store.test.ts | Chain rename verifies recomputed content hashes and unchanged epic versions. |
| E11 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E12 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E13 | edit-store.test.ts | Empty checkpoint list clears links on two epics. |
| E14 | pm-edit-schemas.test.ts, edit-store.test.ts | Named coverage; no gap identified in this audit |
| E15 | edit-store.test.ts | Both swap and A→B, B→C chain verified. |
| E16 | edit-store.test.ts | Date-only edit preserves epic rows and marks proposal edited. |
| E17 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E18 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E19 | edit-store.test.ts | Named coverage; no gap identified in this audit |
| E20 | edit-store.test.ts | DONE tasks preserved after title and description edits; store approval succeeds. |
| E21 | edit-store.test.ts | FAILED and expired IN_PROGRESS edits preserve expansion state, tasks and error; stale store rejected. |
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
| E38 | plan-flow.test.ts, regenerate-store.test.ts | Replacement tasks, proposal version and each persisted session-count increment asserted. |
| E39 | plan-flow.test.ts | Sixth call is refused without model call and count remains 5. |
| E40 | plan-flow.test.ts | Pending and failed paths preserve proposal version and regeneration count. |
| E41 | plan-flow.test.ts, regenerate-store.test.ts | Failure preserves tasks, increments count and blocks approval. |
| E42 | regenerate-store.test.ts, plan-flow.test.ts | Stale version causes no model call and leaves session count unchanged. |
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
| E55 | decide.test.ts, plan-flow.test.ts | Actual regeneration followed by approval closes the session ACCEPTED. |
| E56 | decide.test.ts | Named coverage; no gap identified in this audit |
| E57 | decide.test.ts, edit-store.test.ts | Both lock orders tested; holder isolation and transaction timeout improved after earlier suite timeouts. Full-suite rerun passed this test. |
| E58 | edit-store.test.ts, epic-list.test.ts | Named coverage; no gap identified in this audit |
| E59 | pm-edit-e2e.test.ts, edit-store.test.ts | Thirty seeded HTTP sequences vary title, checkpoint, add and delete edits and replace all tasks before approval; the maximum-size plan also approves over HTTP. |
| E60 | edit-store.test.ts, epic-list.test.ts, regenerate-store.test.ts | Named coverage; no gap identified in this audit |

## Threats

| ID | Evidence | Audit |
|---|---|---|
| T1 | E4 | Covered |
| T2 | E1, E2, E42 | Covered; stale requests checked over HTTP |
| T3 | E57 | Test isolation improved; full-suite rerun passed |
| T4 | E28, E29, E35, E37 | Covered |
| T5 | E9 | Covered |
| T6 | E39, E42 | Covered: stale/capped calls preserve persisted counts |
| T7 | Accepted in spec | Accepted |
| T8 | E33 | Covered |
| T9 | Accepted in spec | Accepted |
| T10 | E48, N3 | Covered |
| T11 | E59 | Thirty varied sequences and maximum-size plan approved through HTTP |
