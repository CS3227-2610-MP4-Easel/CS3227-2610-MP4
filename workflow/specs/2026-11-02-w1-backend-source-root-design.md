# W1 Backend Source-Root Migration Design

- **Status:** Approved (operator, 2026-11-02)
- **Risk tier:** High - changes repository boundaries, build resolution, Prisma paths, and CI verification without changing runtime API behavior
- **Workstream:** W1 | **Plan:** Pending Gate 1 approval
- **Constraints consulted:** C~3/A~2 in branch state; AD-01a; AD-01b; AD-55; C2; PR #6 handover point 1
- **Lenses:** Implementer, Tester, Maintainer

## 1. Problem

The current W1 branch stores the Next.js scaffold under `apps/web` and backend packages under `packages/api`, `packages/db`, `packages/contracts`, and `packages/llm-gateway`. PR #6 owns the frontend move to `src/fe`. The backend still needs to comply with the operator's source-root rule while preserving package boundaries and runtime behavior.

The desired state is a source-root split: PR #6's frontend in `src/fe` and backend packages in `src/be/*`. The obsolete `apps/web` scaffold is removed. PR #6's `src/fe` tree must be present before integrated workspace and typecheck verification; this branch does not edit its files. Package names, public exports, route behavior, Prisma schema semantics, and API contracts remain unchanged.

## 2. Goals

Requirements are in [requirements](2026-11-02-w1-backend-source-root-design/requirements.md).

## 3. Non-goals

- Vercel configuration and the contents of `src/fe` — owned by PR #6; this branch only removes the obsolete `apps/web` scaffold and updates shared root references.
- API endpoint, schema, authorization, database, or LLM behavior — no runtime contract changes are intended.
- Compatibility packages under the old `packages/*` paths — they would preserve the obsolete layout.

## 4. Components

- [requirements](2026-11-02-w1-backend-source-root-design/requirements.md) — functional and non-functional acceptance criteria.
- [conventions](2026-11-02-w1-backend-source-root-design/conventions.md) — path, workspace, and package-boundary rules.
- [edge cases](2026-11-02-w1-backend-source-root-design/edge-cases.md) — migration and verification failure behavior.
- [implementation order](2026-11-02-w1-backend-source-root-design/implementation-order.md) — task order and dependencies.

No `api.md`: no HTTP or module operation changes.

No `data-model.md`: no persisted data or Prisma model changes.

## 5. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|
| - | None. | - | - |

## 6. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Move backend packages under `src/be/*` while preserving four package boundaries and package names. | Matches the operator's `src/fe`/`src/be` split; flattening would remove existing ownership boundaries. | Operator |
| SD2 | Use explicit workspace entries `src/fe` and `src/be/*`. | `src/*` cannot discover packages nested below `src/be`; retaining `packages/*` would violate N1. | Codex proposal accepted by operator's “Carry on” |
| SD3 | Perform a direct move with no old-path compatibility packages. | The branch is pre-integration and shims would leave two source roots and weaken the import rules. | Codex proposal accepted by operator's “Carry on” |
| SD4 | Use `src/fe` and `src/be/*` as the final root layout and remove `apps/web`; require PR #6's tree for integrated verification. | The old scaffold is redundant and the operator directed its removal. | Operator |
| SD5 | Treat root package/build files, lockfile, TypeScript references, backend tests, `.gitignore`, guide mappings, and recovery documentation as active migration surfaces. | These files contain executable or verification-sensitive paths. | Codex proposal |
