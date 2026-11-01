# W1 Foundation and API Skeleton Design

- **Status:** Approved (Dev Lead, 2026-11-02)
- **Risk tier:** High — W1 defines the database schema, authorization contract, public API boundary, and interfaces consumed by every later slice.
- **Workstream:** W1 | **Plan:** [implementation plan](../../plans/2026-11-02-w1-foundation-plan.md)
- **Normative sources:** `docs/architecture/contracts.md` §§1–5 is authoritative for endpoints, schemas, errors, policy rows, and frozen interfaces; `docs/architecture/agile-platform-architecture.md` §5 is authoritative for the data model; this W1 spec is authoritative only for the implementation seams, verification, and migration procedure below.
- **Constraints consulted:** AD-01a, AD-01b, AD-01c, AD-02, AD-33, AD-35, AD-43, AD-54, AD-55, AD-65, AD-66, AD-72, A-03, A-06, A-18; guardrails AD-01b, AD-55, AD-25, AD-32; `workflow/project-state/architecture/foundation.md`; `conventions/general.md`; `conventions/process.md`
- **Review lenses:** Implementer, Tester, Maintainer, Attacker (public API, authorization, tenancy and untrusted request input)

## 1. Problem

The repository has no application code. The three role slices cannot start until they share one contract package, one policy map, one database schema, one API boundary, and the four interfaces named by A-18. W1 supplies those seams and a public health route without implementing role features or live AI behavior.

## 2. Goals

The detailed functional and non-functional requirements are in [requirements.md](2026-11-02-w1-foundation-design/requirements.md).

## 3. Non-goals

- Firebase token verification, user registration, and rate-counter behavior — W4 owns these; W1 provides the seam and tables.
- Gateway runtime, guards, SoCLaaS calls, limiter admission, and mock behavior — W2/W3 own these; W1 freezes the interface only.
- `AiContext` and `Sessions` implementations — W6 and W2 own these; W1 freezes the signatures and shared types.
- Core route/domain implementations — W5 owns them; W1 defines the database and exported interfaces.
- Role routes, UI screens, seed data, deployment operations, security corpus, and CI policy enforcement — W7–W13 own these.
- Changes to recorded authorization, tenancy, error, storage, or deployment decisions without a new decision entry and owner approval.

## 4. Chosen approach

W1 uses the contract-first foundation selected by the Dev Lead. The existing architecture contract files remain the single normative source; `packages/contracts` implements them, `packages/db` implements the architecture data model, and `packages/api` provides the Hono boundary. W1 adds parity tests and explicit seams without copying the 57 endpoint definitions or the full data model into a second document. The rejected schema-first and deploy-first approaches either permit contract drift or fail to unblock the role slices.

## 4. Components

- [requirements.md](2026-11-02-w1-foundation-design/requirements.md) — functional and non-functional acceptance criteria.
- [data-model.md](2026-11-02-w1-foundation-design/data-model.md) — tables, invariants, filtering, and migrations.
- [api.md](2026-11-02-w1-foundation-design/api.md) — health route, API boundary, policy seam, and frozen interfaces.
- [conventions.md](2026-11-02-w1-foundation-design/conventions.md) — package, boundary, validation, logging, and test rules.
- [edge-cases.md](2026-11-02-w1-foundation-design/edge-cases.md) — failure, security, tenancy, and data-corruption cases.
- [implementation-order.md](2026-11-02-w1-foundation-design/implementation-order.md) — dependency table and implementation waves.

## 5. Decisions made in this spec

- Use an npm-workspaces TypeScript monorepo because the architecture requires shared packages and the repository has no existing package-manager lockfile.
- Treat `docs/architecture/contracts.md` and `docs/architecture/agile-platform-architecture.md` as the normative contract sources; W1 implements and verifies them instead of duplicating them.
- Use forward-only expand-and-contract migrations: local development creates Prisma migrations; CI applies them with `prisma migrate deploy`; rollback is an application rollback plus a compatible forward migration, never a destructive down migration.
- Keep W1's API implementation to request-id/error plumbing, route registration, policy-map middleware seam, contract parity tests, and `GET /api/health`; later workstreams own authentication and feature handlers.

## 5. Open questions

None. Deployment reachability, Neon serverless behavior, and the repository/Vercel owner remain W13 operational checks and do not alter W1 contracts.

