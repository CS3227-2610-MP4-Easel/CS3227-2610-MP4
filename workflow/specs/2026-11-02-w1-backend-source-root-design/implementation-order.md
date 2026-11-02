# Implementation Order

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T1 | Relocate backend packages | `packages/api/**` → `src/be/api/**`, `packages/db/**` → `src/be/db/**`, `packages/contracts/**` → `src/be/contracts/**`, and `packages/llm-gateway/**` → `src/be/llm-gateway/**`, with unchanged package names and exports. | F1, N1 |
| T2 | Rewire workspace and build configuration | Delete `apps/web/**`; modify `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, and relocated package manifests/configs; root workspaces and references target `src/fe` plus `src/be/*`. | F2, F3, N3 |
| T3 | Update boundary verification and documentation | Modify `tests/workspace.test.ts`, `src/be/api/test/import-rules.test.ts`, `src/be/db/test/migration-procedure.test.ts`, `docs/guide/map.json`, `docs/operations/database-recovery.md`, `docs/architecture/agile-platform-architecture.md`, `docs/architecture/decision-log.md`, `workflow/project-state/guardrails.md`, `workflow/project-state/architecture/foundation.md`, and this branch state; do not edit `src/fe`. | F4, N2, N3 |
| T4 | Verify and close out | With PR #6's `src/fe` tree present, backend tests, typecheck, explicit Prisma validation, package entrypoints, layout scan, and diff review pass. | F3, N1, N2, N3 |
| T5 | Owner review close-out | The plan and branch state contain final evidence and the branch is ready for Gate 3; no push, PR, or merge occurs here. | F1, F2, F3, F4, N1, N2, N3 |

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Relocate backend packages | - | - | 1 |
| T2 Rewire workspace and build configuration | T1 | - | 2 |
| T3 Update boundary verification and documentation | T2 | - | 3 |
| T4 Verify and close out | T3 | - | 4 |
| T5 Owner review close-out | T4 | - | 5 |

Shared-file hazards: T2 and T3 both modify root and verification configuration; serialize them as listed.
