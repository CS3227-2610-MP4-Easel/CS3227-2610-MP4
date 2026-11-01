# W1 Requirements

## Functional

- **F1 Monorepo:** The repository has `apps/web`, `packages/contracts`, `packages/db`, `packages/api`, and `packages/llm-gateway` workspace boundaries with package declarations that permit each package to build independently; `core` and `ai-context` remain domain modules owned by later workstreams unless their implementation plan creates a separate package.
- **F2 Shared contracts:** `packages/contracts` implements the shared enums, request schemas, response schemas, error codes, error envelope, pagination schemas, and frozen-first interface types defined normatively by `docs/architecture/contracts.md` §§1–5.
- **F3 Policy map:** The policy map implements exactly one entry for each endpoint in `contracts.md` §3; the route-registration helper rejects missing, duplicate, or mismatched operation bindings and the parity test compares all 57 entries with route metadata and OpenAPI.
- **F4 Database schema:** `packages/db` implements the complete model in `docs/architecture/agile-platform-architecture.md` §5, including enum values, unique constraints, indexes, soft-delete fields, version fields, relation actions, and composite foreign keys that keep references inside one project.
- **F5 Filtered client:** The exported Prisma client excludes soft-deleted rows and archived projects from ordinary model reads, relation reads, counts, aggregates, and group-bys; request-facing code cannot use raw SQL or maintenance opt-out; `packages/db` exposes an internal maintenance-read capability only to migration/repair code.
- **F6 API boundary:** `packages/api` exports a Hono app; `apps/web/app/api/[[...route]]/route.ts` owns the Next.js `/api` adapter/mount; the API has request-id creation, strict body/path/query parsing, common error mapping, and policy-map middleware placement. Handlers do not contain role checks or domain rules.
- **F7 Health:** `GET /api/health` returns HTTP 200, `Content-Type: application/json`, `X-Request-Id`, and `{ "status": "UP" }` without authentication or a database query.
- **F8 Frozen interfaces:** The contracts implement the exact callable shapes and behavior defined by `contracts.md` §5 for `LlmGateway.run`, `AiContext.assemble`, `Sessions`, and `Core`; compile-time consumer fixtures and runtime contract tests prove all four shapes without duplicating their definitions in W1.
- **F9 Migration path:** The repository documents local migration creation, CI migration application, schema generation, the forward-only compatibility rule, a 24-hour maximum recovery-point loss, and a 4-hour recovery-time target.

## Non-functional

- **N1 Authorization:** The boundary runs token verification, registered-user lookup, policy evaluation, membership/ownership evaluation, and handler invocation in that order; invalid/missing tokens map to 401, an unregistered user maps to 403 `USER_NOT_REGISTERED`, a disallowed role maps to 403 `FORBIDDEN_ROLE`, and a missing/non-member resource maps to 404 `NOT_FOUND`; denied requests never invoke handlers.
- **N2 Input boundary:** Strict Zod schemas validate JSON bodies, path parameters, and query parameters; malformed JSON/content type maps to 400; malformed UUIDs, invalid enums, invalid pagination, unknown keys, and server-managed fields map to 422 with field details.
- **N3 Data isolation:** Composite foreign keys and service seams prevent a task, epic, sprint, checkpoint, proposal, activity item, standup, or digest from referencing a different project through a client-supplied identifier.
- **N4 Logging:** Request logs contain the request id, status, and stable error code only; they never contain credentials, tokens, registration codes, prompt text, response text, or raw request secrets.
- **N5 Time rules:** Instants are stored and serialized in UTC; calendar dates use `Asia/Singapore`; mutable entities start at version 1; every mutable update uses an atomic `WHERE id = ? AND version = ?` compare-and-increment and maps zero affected rows to `409 CONFLICT_VERSION`.
- **N6 Verification:** An executable test compares generated OpenAPI method, path, operation id, request schema, response schema, and policy key with the registered route table; source scans enforce that `apps/web` does not import Prisma or `packages/db` and that routes do not omit policy entries.

