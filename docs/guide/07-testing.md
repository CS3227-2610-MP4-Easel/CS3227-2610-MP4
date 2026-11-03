# 7. Testing

From the repository root:

| Command | Checks |
|---|---|
| `npm test` | root tests and all backend tests under `src/be/**/*.test.ts`; PostgreSQL integration uses `W1_INTEGRATION_DATABASE_URL` when set |
| `npm run typecheck` | backend TypeScript project references, then the standalone `src/fe` typecheck |
| `npm run lint` | root TypeScript build/lint boundary |
| `npm --workspace @agile/db run prisma:validate` | validates `src/be/db/prisma/schema.prisma` |

From `src/fe`, the existing frontend checks remain:

| Command | Checks |
|---|---|
| `npm run lint` | no import of `api/fixtures` or `api/store` outside `lib/api` |
| `npm run typecheck` | TypeScript |
| `npm run build` | production build |
| `npm run smoke` | with the dev server running, every route listed on `/screens` returns 200 for each role |
| `npm run linkcheck` | no dead link; every screen is reachable for each role |
