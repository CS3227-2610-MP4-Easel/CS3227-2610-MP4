# 7. Testing

From the repository root:

| Command | Checks |
|---|---|
| `npm test` | root tests and all backend tests under `src/be/**/*.test.ts`; PostgreSQL integration uses `W1_INTEGRATION_DATABASE_URL` when set |
| `npm run typecheck` | backend TypeScript project references, then the standalone `src/fe` typecheck |
| `npm run lint` | root TypeScript build/lint boundary |
| `npm --workspace @agile/db run prisma:validate` | validates `src/be/db/prisma/schema.prisma` |

**Integration tests and CI.** The W2 and W4 integration tests (gateway rows, sessions, limiter) need PostgreSQL 16 and skip when `W1_INTEGRATION_DATABASE_URL` is unset. W12's CI does not set it yet, so CI skips them; the CI owner is to add a Postgres service and fail when the variable is missing. Run them locally against a database.

**Gateway tests.** Unit tests run over in-memory fakes with an injectable clock; `tests/setup-auth-env.ts` defaults `LLM_MODE=mock` and blocks requests to SoCLaaS, so the suite never calls the live service. A leak test checks that no prompt, response or key reaches a stored row across every admission path. Feature modules register mock responses with `registerMockResponse` and call `assertStaticSectionsFit` in a test.

**Guard tests.** `src/be/llm-gateway/test/guards.test.ts` pins `GUARD_VERSION` to a fingerprint of the rules: whoever changes a guard rule bumps `GUARD_VERSION` and adds its `KNOWN` entry.

**Process security.** `tests/process-security/` covers the agent hook, the policy file and the review-approval checks; the trusted workflow re-evaluates approvals on review events.

From `src/fe`, the existing frontend checks remain:

| Command | Checks |
|---|---|
| `npm run lint` | no import of `api/fixtures` or `api/store` outside `lib/api` |
| `npm run typecheck` | TypeScript |
| `npm run build` | production build |
| `npm run smoke` | with the dev server running, every route listed on `/screens` returns 200 for each role |
| `npm run linkcheck` | no dead link; every screen is reachable for each role |
