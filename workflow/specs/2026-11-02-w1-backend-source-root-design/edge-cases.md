# Edge Cases and Non-Happy Paths

## Migration

| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1, N1, N3 | A stale backend file or package manifest remains under `packages/`, or an active reference remains in root config, lockfile, ignore rules, guide mappings, recovery docs, or scripts. | The layout test fails and prints each stale path; only explicitly marked historical prose is allowed. | Prevents a split source root and stale operational instructions. | integration |
| E2 | F2 | PR #6's `src/fe` is absent or npm omits a `src/be/*` package. | Integrated workspace verification remains blocked and reports the missing package name; no false green is claimed. | Prevents dependency resolution from depending on local hoisting. | integration |
| E3 | F2, F3 | A TypeScript reference points to a former `packages/*` path or the wrong relative depth. | `npm run typecheck` fails with the stale/unresolvable reference; the migration is incomplete. | Prevents editor/build divergence. | integration |
| E4 | F3 | Prisma validation uses a former schema path or resolves a schema other than `src/be/db/prisma/schema.prisma`. | The explicit-schema command fails; no schema or migration is regenerated. | Prevents validating a different schema. | integration |
| E5 | F4 | The import-boundary test scans only old paths or permits `@agile/db`/Prisma imports in request-facing sources. | The test fails with the missing scan root or forbidden import. | Prevents a false security green result after relocation. | integration |
| E6 | N2 | The migration changes a PR #6-owned `src/fe` file. | The scope test fails and the change is stopped for ownership review; no automatic destructive revert is performed. | Prevents ownership collision with PR #6. | manual |
| E7 | F3 | Any of the four backend packages has a changed name, export, main/types entrypoint, or public import resolution. | The all-package entrypoint matrix fails and identifies the package and field. | Verifies consumer compatibility. | integration |
| E8 | F3, N3 | A move or lockfile update is interrupted. | Stop before install or validation; `git status --short` and `git diff --name-status` must show either the complete old tree or complete new tree. Restore the incomplete move from the working tree/index, then rerun the move and regenerate the lockfile before continuing. | Prevents mixed package resolution. | manual |
| E9 | F2, N2 | PR #6's `src/fe` is not present when verification starts. | T1–T3 may be prepared, but integrated workspace/typecheck verification stops and the branch remains blocked until the PR #6 tree is available. | Makes the cross-PR prerequisite explicit. | manual |

## What could corrupt data

No database rows, migrations, or Prisma models are changed. The migration must not run a database migration or regenerate a schema; this keeps data corruption risk at zero for this change. If a package move is interrupted, restore the last complete tree before running npm or Prisma commands.
