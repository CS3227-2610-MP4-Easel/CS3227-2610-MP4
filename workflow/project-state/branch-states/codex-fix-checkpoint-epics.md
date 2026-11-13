# Branch State — Fix live checkpoint epics

**Branch:** `codex/fix-checkpoint-epics`
**Started:** 2026-11-13

## Changes

- Fixed the live checkpoints screen to load the project epics through the existing paginated helper and render each epic under its linked checkpoint.
- Added a regression test proving linked epics render and unlinked epics remain omitted from checkpoint cards.
- Updated the developer live project overview to replace the health and member-management CTAs with one `Upload activity and standup` link to My standup.
- Added a regression test for the developer overview CTA and preserved the PM actions.
- Matched live checkpoint cards to the role-specific mockups: PM and Dev Lead receive risk badges and forecast guidance from project facts, while Developers see only target dates and linked epics.
- Added a regression test covering the PM/Lead risk presentation and the Developer information boundary.
- Made computed forecast dates explicit on PM/Lead checkpoint cards; cards still explain how to get a forecast when no projected date exists.
- Added a regression test for rendering a computed forecast date.
- Updated checkpoint detail ordering to `Target`, `Projected`, then `Remaining`, and added task/point totals to every linked epic chip.
- Added a Dev Lead-only Sprint dropdown below Status and Blocked in the live task drawer, with an explicit `No sprint` option and versioned task assignment updates.
- Extended the live task PATCH client to send `sprintId` and added regression coverage for sprint selection.
- Fixed the live Sprints page to reload sprint task lists when a task assignment changes through the task drawer.
- Added regression coverage for the task-refresh event.
- Fixed the sprint edit modal to consume its modal sprint ID, preload the sprint name and dates, and show `Edit sprint` / `Save sprint` copy.
- Added regression coverage for edit-mode modal data and action text.

## Verification

- `npm --prefix src/fe test` — 21 files, 287 tests passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe test -- --run test/w5-pages.test.tsx` — 1 file, 29 tests passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe run build` — passed.
- `npm --prefix src/fe test -- --run test/w5-pages.test.tsx` — 1 file, 28 tests passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe test -- --run test/w5-pages.test.tsx test/http.test.ts` — 2 files, 65 tests passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run build` — passed.
- `npm --prefix src/fe test -- --run test/w5-pages.test.tsx` — 1 file, 26 tests passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe test -- --run test/w5-pages.test.tsx` — 1 file, 26 tests passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe run build` — passed.
- `npm --prefix src/fe test` — 21 files, 288 tests passed.
- `npm --prefix src/fe test -- --run test/w5-pages.test.tsx` — 1 file, 25 tests passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe run build` — passed.
