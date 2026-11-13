# Branch State — Fix live checkpoint epics

**Branch:** `codex/fix-checkpoint-epics`
**Started:** 2026-11-13

## Changes

- Fixed the live checkpoints screen to load the project epics through the existing paginated helper and render each epic under its linked checkpoint.
- Added a regression test proving linked epics render and unlinked epics remain omitted from checkpoint cards.

## Verification

- `npm --prefix src/fe test` — 21 files, 287 tests passed.
- `npm --prefix src/fe run lint` — passed.
- `npm --prefix src/fe run typecheck` — passed.
- `npm --prefix src/fe run build` — passed.
