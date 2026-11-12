# 7. Testing

From the repository root:

| Command | Checks |
|---|---|
| `npm test` | root tests and all backend tests under `src/be/**/*.test.ts`, then the `src/fe` Vitest suite; PostgreSQL integration uses `W1_INTEGRATION_DATABASE_URL` when set |
| `npm run typecheck` | backend TypeScript project references, then the standalone `src/fe` typecheck |
| `npm run lint` | root TypeScript build/lint boundary |
| `npm --workspace @agile/db run prisma:validate` | validates `src/be/db/prisma/schema.prisma` |

**Integration tests and CI.** The integration tests (W2 gateway rows and sessions, W4 limiter, W9's `src/be/dev/test/dev-integration.test.ts`: atomic upload, concurrent summaries and standups, archive races under the project lock) need PostgreSQL 16 and skip when `W1_INTEGRATION_DATABASE_URL` is unset. CI runs a PostgreSQL 16 service, sets the variable and fails if it is missing, so they always run there. Locally, point the variable at a database (section 2).

**Frontend tests.** `src/fe` uses Vitest with jsdom and Testing Library (C68); run them alone with `npm --workspace easel-fe run test`. The Firebase SDK and `fetch` are mocked, and fake timers cover countdowns. `test/source-rules.test.ts` enforces the frontend source rules (see 4 Components, Frontend).

**Gateway tests.** Unit tests run over in-memory fakes with an injectable clock; `tests/setup-auth-env.ts` defaults `LLM_MODE=mock` and blocks requests to SoCLaaS, so the suite never calls the live service. A leak test checks that no prompt, response or key reaches a stored row across every admission path. Feature modules register mock responses with `registerMockResponse` and call `assertStaticSectionsFit` in a test.

**Guard tests.** `src/be/llm-gateway/test/guards.test.ts` pins `GUARD_VERSION` to a fingerprint of the rules: whoever changes a guard rule bumps `GUARD_VERSION` and adds its `KNOWN` entry.

**Process security.** `tests/process-security/` covers the agent hook, the policy file and the review-approval checks; the trusted workflow re-evaluates approvals on review events.

**Core and role-feature suites.** W5 coverage is in `src/be/core/test/` and the API planning and
authorization tests; W8 coverage is in `src/be/lead/test/` plus the lead route/context tests. Run
the root test command for both unit and integration coverage, and set
`W1_INTEGRATION_DATABASE_URL` when PostgreSQL-backed cases are required.

**Security corpus.** W11's declarative corpus and authorization tests run through the real route,
auth, limiter, session, filesystem and network-deny seams. They are part of the backend/root
suite and must remain green without changing the frozen guard rules.

**Deployment safety.** W13 has focused tests for tier targets, seed/migration procedures,
recovery evidence, workflow contracts and production migration ordering. Use
`node scripts/check-workflows.mjs` for workflow validation and the repository's configured secret
scan before changing `.github/workflows/w13-production.yml` or `scripts/w13/`. Production migration
itself is CI-only.

From `src/fe`, the existing frontend checks remain:

| Command | Checks |
|---|---|
| `npm run lint` | no import of `api/fixtures` or `api/store` outside `lib/api` |
| `npm run typecheck` | TypeScript |
| `npm run build` | production build |
| `npm run smoke` | with the dev server running, every route listed on `/screens` returns 200 for each role |
| `npm run linkcheck` | no dead link; every screen is reachable for each role |
