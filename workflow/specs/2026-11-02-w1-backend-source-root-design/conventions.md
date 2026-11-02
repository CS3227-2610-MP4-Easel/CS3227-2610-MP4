# Conventions

## Source layout

- `src/fe` is the frontend package owned by PR #6.
- `src/be/*` contains backend packages. Each backend package keeps its existing package name and public export surface.
- Root configuration, documentation, workflow state, and tests that exercise the repository may remain outside `src/`; application and package source must not.

## Workspace and references

- The root `package.json` lists `src/fe` and `src/be/*`; `src/fe` remains PR #6's package name/configuration and is not edited by this branch.
- Root TypeScript references point to `src/fe`, `src/be/contracts`, `src/be/db`, `src/be/api`, and `src/be/llm-gateway`.
- The obsolete `apps/web` package and its `tsconfig.json` are deleted; no replacement frontend files are created here.
- Each backend package tsconfig extends `../../../tsconfig.json`; `src/be/api` and `src/be/llm-gateway` reference `../contracts`; `src/be/db` and `src/be/contracts` have no project references. Existing `rootDir: "src"`, `outDir: "dist"`, declaration, and include settings remain package-relative.
- `src/be/db/package.json` validates `prisma/schema.prisma` explicitly; migration and recovery commands use `src/be/db/prisma/schema.prisma` from the repository root.

## Exact verification commands

- Root tests: `node --import tsx --test "tests/**/*.test.ts" "src/be/**/*.test.ts"`.
- Typecheck: `npm run typecheck`.
- Prisma validation: `npx prisma validate --schema src/be/db/prisma/schema.prisma` from the repository root.
- Package entrypoint matrix: load `@agile/api` and assert `createApiApp` and `apiApp`; load `@agile/contracts` and assert `ProjectDetailSchema`; load `@agile/db` and assert `createDbClient`; load `@agile/llm-gateway` and assert the module resolves. For each package manifest, assert the unchanged values below.

| Package | `name` | `main` | `types` | `exports["."]` |
|---|---|---|---|---|
| `src/be/api` | `@agile/api` | `dist/index.js` | `dist/index.d.ts` | `./src/index.ts` |
| `src/be/contracts` | `@agile/contracts` | `dist/index.js` | `dist/index.d.ts` | `./src/index.ts` |
| `src/be/db` | `@agile/db` | `dist/index.js` | `dist/index.d.ts` | `./src/index.ts` |
| `src/be/llm-gateway` | `@agile/llm-gateway` | `dist/index.js` | `dist/index.d.ts` | `./src/index.ts` |

## Boundary verification

- Source scans inspect `src/fe` and `src/be/api` for request-facing import restrictions, rejecting both package-name imports (`@prisma/client`, `@agile/db`) and relative paths containing `/db/` or `/prisma/`.
- Backend tests are discovered under `src/be/**/*.test.ts`; root tests remain under `tests/**/*.test.ts`.
- No active test, build, package, Prisma, recovery, guide, ignore, or lockfile reference remains under `apps/web` or the old backend `packages/*` paths. Historical architecture text must identify old paths as superseded.
