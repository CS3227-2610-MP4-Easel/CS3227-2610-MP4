# W1 Backend Source-Root Migration Plan

- **Status:** Approved (operator, 2026-11-02)

> **For agents:** tick `- [ ]` -> `- [x]` as each step finishes. Keep the branch state's Progress cell current. Spec: [backend source-root migration design](../specs/2026-11-02-w1-backend-source-root-design.md).

## Scope

**Goal:** Remove the obsolete `apps/web` scaffold and relocate the backend packages under `src/be` while preserving package APIs and leaving PR #6's `src/fe` files untouched.

**In scope:** F1, F2, F3, F4, N1, N2, N3 and edge cases E1–E9.

**Non-goals:** Editing `src/fe`, changing its `easel-fe` package, changing Vercel/frontend behavior, changing API/database/authorization/LLM behavior, or adding compatibility packages.

**Risk tier:** High — repository boundaries and build/deployment-facing paths change, but persisted data and runtime contracts do not.

## Task order

| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 Relocate backend packages | - | - | 1 | Done |
| T2 Rewire workspace and build configuration | T1 | - | 2 | Done |
| T3 Update verification and documentation | T2 | - | 3 | Done |
| T4 Verify | T3 | - | 4 | Not started |
| T5 Close-out | T4 | - | 5 | Not started |

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | `tests/workspace.test.ts` path/package assertions |
| F2 | T2 | workspace test and `npm run typecheck` |
| F3 | T2, T4 | entrypoint matrix, root tests, typecheck, Prisma validation |
| F4 | T3 | `src/be/api/test/import-rules.test.ts` |
| N1 | T1, T3 | layout scan |
| N2 | T1, T2, T3 | diff scope check excluding `src/fe` |
| N3 | T2, T3 | active-reference scan |
| E1 | T3 | stale-path scan |
| E2 | T2 | workspace assertions |
| E3 | T2 | typecheck |
| E4 | T2, T4 | explicit-schema Prisma validation |
| E5 | T3 | import-boundary test |
| E6 | T4 | manual diff review |
| E7 | T4 | all-package manifest/module matrix |
| E8 | T1, T2 | clean-tree invariant and lockfile verification |
| E9 | T4 | PR #6 `src/fe` prerequisite check |

## Verification gates

- Per task: `node --import tsx --test "tests/**/*.test.ts" "src/be/**/*.test.ts"` for test changes, `npm run typecheck` for TypeScript changes, and `npx prisma validate --schema src/be/db/prisma/schema.prisma` for Prisma path changes.
- Before finishing: all commands above, `git diff --check`, the layout/active-reference scan, and manual diff review pass with no `src/fe` edits.

---

### T1: Relocate backend packages

**Delivers:** Backend packages under `src/be/*`; no backend package remains under `packages/`. **Satisfies:** F1, N1, N2, E8. **Depends on:** - **Wave:** 1

**Files**

| Action | Path | What changes |
|---|---|---|
| Move | `packages/api/**` → `src/be/api/**` | Preserve `@agile/api` package contents, source, tests, and Prisma-independent runtime behavior. |
| Move | `packages/contracts/**` → `src/be/contracts/**` | Preserve `@agile/contracts` package contents, source, and tests. |
| Move | `packages/db/**` → `src/be/db/**` | Preserve `@agile/db` source, tests, Prisma schema, and migration SQL. |
| Move | `packages/llm-gateway/**` → `src/be/llm-gateway/**` | Preserve `@agile/llm-gateway` source and package manifest. |
| Delete | `apps/web/**` | Remove the obsolete W1 frontend scaffold; do not create or edit `src/fe/**`. |
| Test | `tests/workspace.test.ts` | Verify after relocation that all expected package paths and names are represented. |

**Checklist**

- [x] 1. Confirm PR #6's `src/fe` tree is present before deleting `apps/web`; if absent, stop with E9 rather than claiming a complete move.
- [x] 2. Move the four backend package trees and delete `apps/web` as one filesystem change.
- [x] 3. Verify the clean-tree invariant with `git status --short` and `git diff --name-status`; no partial old/new backend tree remains.
- [x] 4. Update branch state Progress and Changes.
- [x] 5. Commit: `refactor: move packages under source backend root (W1)`.

### T2: Rewire workspace and build configuration

**Delivers:** Root workspace resolution for `src/fe` plus `src/be/*`, backend project-reference build resolution, and a root command that also runs PR #6's standalone frontend typecheck. **Satisfies:** F2, F3, N3, E2, E3, E4. **Depends on:** T1 **Wave:** 2

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `package.json` | Set workspaces to `["src/fe", "src/be/*"]`; change the root test glob to `tests/**/*.test.ts` and `src/be/**/*.test.ts`. |
| Modify | `package-lock.json` | Regenerate workspace links for `src/fe` and all four `src/be/*` packages; remove links to `apps/web` and `packages/*`. |
| Modify | `tsconfig.json` | Replace project references with the four backend projects under `src/be`; `src/fe` remains standalone and is checked by the root npm script. |
| Modify | `src/be/api/tsconfig.json`, `src/be/contracts/tsconfig.json`, `src/be/db/tsconfig.json`, `src/be/llm-gateway/tsconfig.json` | After the move, use `../../../tsconfig.json`, package-relative `src`/`dist`, and sibling contract references for API and gateway. |
| Modify | `src/be/db/package.json` | Make `prisma:validate` use the explicit `prisma/schema.prisma` path. |
| Modify | `.gitignore` | Ignore `src/be/db/prisma/generated/` and `src/be/db/generated/`. |

**Checklist**

- [x] 1. Update root workspace, test, and TypeScript reference declarations.
- [x] 2. Update all four backend package TypeScript configs and the DB Prisma script.
- [x] 3. Regenerate the lockfile and assert its workspace links contain only `src/fe` and `src/be/*` for application packages.
- [x] 4. Run `npm run typecheck` and `npx prisma validate --schema src/be/db/prisma/schema.prisma`; the typecheck must include both backend and standalone frontend checks.
- [x] 5. Update branch state Progress and Changes.
- [x] 6. Commit: `build: rewire workspace for source-root packages (W1)`.

Verification evidence: `npm run typecheck` passed for backend project references and the standalone `src/fe` typecheck; Prisma validation passed with `DATABASE_URL` set. The full root test command remains for T3 because the existing import-boundary, recovery-path, and workspace assertions still target pre-migration paths.

### T3: Update verification and documentation

**Delivers:** Tests and normative/operational references enforce the new layout. **Satisfies:** F4, N2, N3, E1, E5. **Depends on:** T2 **Wave:** 3

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `tests/workspace.test.ts` | Assert `["src/fe", "src/be/*"]` and verify all five package manifests plus all four backend entrypoint fields and imports. |
| Modify | `src/be/api/test/import-rules.test.ts` | After the move, scan `src/fe` and `src/be/api`; reject Prisma/DB package-name and relative imports. |
| Modify | `src/be/db/test/migration-procedure.test.ts` | After the move, update the recovery-document relative path. |
| Modify | `docs/guide/map.json` | Map `src/be/**` and `src/fe/**`; remove active `apps/web/**` and `packages/**` mappings. |
| Modify | `docs/operations/database-recovery.md` | Use `src/be/db/prisma/schema.prisma` in every command. |
| Modify | `docs/architecture/agile-platform-architecture.md` | Replace the component/path layout and AD-01a/b text with the `src/fe`/`src/be` layout. |
| Modify | `docs/architecture/decision-log.md` | Record the supersession of the old monorepo path decision. |
| Modify | `workflow/project-state/guardrails.md` | Replace AD-01b's `apps/web` wording with the `src/fe` request-facing boundary. |
| Modify | `workflow/project-state/architecture/foundation.md` | Replace backend package paths with `src/be/*`. |
| Modify | `workflow/project-state/branch-states/w1.md` | Tick task, record C~5, handover, and changes. |

**Checklist**

- [x] 1. Update tests for workspace paths, all-package manifest parity, entrypoints, and import boundaries.
- [x] 2. Update recovery and guide path mappings.
- [x] 3. Reconcile normative architecture and guardrail references; label historical references as superseded.
- [x] 4. Run the root test command and confirm no active `apps/web` or old backend `packages/*` reference remains.
- [x] 5. Confirm the diff contains no `src/fe` edits.
- [x] 6. Update branch state Progress and Changes.
- [x] 7. Commit: `test: enforce source-root package boundaries (W1)`.

Verification evidence: root tests pass (66/66), backend and frontend typechecks pass, Prisma validation passes with `DATABASE_URL`, plan lint passes, and the active-reference scan is clean except for the explicit historical supersession note in the decision log.

### T4: Verify

**Delivers:** Verification evidence that the relocation is complete and reviewable. **Satisfies:** F3, N1, N2, N3, E4, E6, E7, E9. **Depends on:** T3 **Wave:** 4

**Files**

| Action | Path | What changes |
|---|---|---|
| Test | `workflow/plans/2026-11-02-w1-backend-source-root-plan.md` | Record verification evidence before close-out. |

**Checklist**

- [ ] 1. Confirm PR #6's `src/fe` exists; otherwise record E9 as a handover blocker.
- [ ] 2. Run `node --import tsx --test "tests/**/*.test.ts" "src/be/**/*.test.ts"`.
- [ ] 3. Run `npm run typecheck`.
- [ ] 4. Run `npx prisma validate --schema src/be/db/prisma/schema.prisma`.
- [ ] 5. Run `git diff --check` and the layout/active-reference scan.
- [ ] 6. Manually review the diff for `src/fe` edits and package/API drift.
- [ ] 7. Run `node .codex/skills/writing-specs-lite/scripts/lint.mjs plan workflow/plans/2026-11-02-w1-backend-source-root-plan.md --closeout`.
- [ ] 8. Update branch state Progress and Changes for verification.

### T5: Close-out

**Delivers:** Reviewed branch ready for owner approval. **Satisfies:** F1, F2, F3, F4, N1, N2, N3, E1–E9. **Depends on:** T4 **Wave:** 5

**Files**

| Action | Path | What changes |
|---|---|---|
| Modify | `workflow/plans/2026-11-02-w1-backend-source-root-plan.md` | Tick all close-out evidence and mark T1–T4 Done. |
| Modify | `workflow/project-state/branch-states/w1.md` | Set W1 In review, record evidence and any handover, and remove the active session row. |

**Checklist**

- [ ] 1. Confirm every Traceability row has passing evidence or a recorded handover.
- [ ] 2. Run `node .codex/skills/writing-specs-lite/scripts/lint.mjs plan workflow/plans/2026-11-02-w1-backend-source-root-plan.md --closeout`.
- [ ] 3. Run the full verification commands again after all plan/state edits.
- [ ] 4. Review the complete diff for accidental `src/fe` edits or stale old paths.
- [ ] 5. GATE: Set the workstream to In review and ask the operator for Gate 3 branch-review approval; do not push, open a PR, or merge.
