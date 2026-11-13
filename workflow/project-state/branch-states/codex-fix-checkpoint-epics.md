# Branch State — Fix live checkpoint epics

**Branch:** `codex/fix-checkpoint-epics`
**Started:** 2026-11-13

## Changes

- Fixed the live checkpoints screen to load the project epics through the existing paginated helper and render each epic under its linked checkpoint.
- Added a regression test proving linked epics render and unlinked epics remain omitted from checkpoint cards.
- Updated the developer live project overview to replace the health and member-management CTAs with one `Upload activity and standup` link to My standup.
- Added a regression test for the developer overview CTA and preserved the PM actions.

## Verification

- `npm --prefix src/fe test` — 21 files, 287 tests passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run build` — passed.
- `npm --prefix src/fe test` — 21 files, 288 tests passed.
