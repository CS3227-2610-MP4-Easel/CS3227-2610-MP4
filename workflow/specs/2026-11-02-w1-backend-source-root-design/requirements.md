# Requirements

## Functional

| ID | Requirement | Acceptance criterion |
|---|---|---|
| F1 | Backend packages are discoverable at `src/be/api`, `src/be/db`, `src/be/contracts`, and `src/be/llm-gateway`. | Given the repository tree, each path contains the corresponding package manifest and source/test directories; no corresponding backend package exists under `packages/`. |
| F2 | Workspace and TypeScript references resolve `src/fe` and every relocated backend package. | Given PR #6's `src/fe` tree, a clean dependency install and `npm run typecheck` resolve `src/fe` and all `src/be/*` packages without former `apps/web` or `packages/*` references. |
| F3 | Backend tests, Prisma validation, and package entrypoints retain their behavior. | Given the relocated tree, `node --import tsx --test "tests/**/*.test.ts" "src/be/**/*.test.ts"`, `npm run typecheck`, `npx prisma validate --schema src/be/db/prisma/schema.prisma`, and the exact four-package manifest/module matrix in `conventions.md` pass. |
| F4 | Import-boundary tests enforce the relocated request-facing source roots. | Given a forbidden Prisma/DB import in a scanned request-facing source, the test fails; given compliant sources under the current or integrated frontend path and `src/be/api`, it passes. |

## Non-functional

| ID | Requirement | Acceptance criterion |
|---|---|---|
| N1 | No backend source, package manifest, Prisma schema, migration, or backend test remains under `packages/`. | A repository layout scan returns no backend paths under `packages/`. |
| N2 | The migration does not modify PR #6-owned `src/fe` files or frontend behavior. | The migration diff contains no `src/fe` file; it deletes only the obsolete `apps/web` scaffold and updates shared root references. |
| N3 | All active references to old frontend/backend source roots are removed. | The active-reference scan reports zero `apps/web` and old backend `packages/*` paths in package manifests, lockfile, scripts, ignore rules, tests, guide mappings, recovery docs, workflow configuration, and normative architecture files. |
