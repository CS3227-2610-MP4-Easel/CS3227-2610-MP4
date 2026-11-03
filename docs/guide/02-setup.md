# 2. Setting Up

From the repository root:

```bash
npm install
npm test
npm run typecheck
npm run lint
npm --workspace @agile/db run prisma:validate
```

The Prisma schema reads `DATABASE_URL`. Integration tests use `W1_INTEGRATION_DATABASE_URL` when a PostgreSQL database is available; without it, the integration test is skipped. Production migration credentials (`DATABASE_URL` and `DIRECT_DATABASE_URL`) are supplied only by the protected deployment environment.

To run the frontend locally, change to `src/fe` and use its existing development script:

```bash
cd src/fe
npm run dev        # http://localhost:3100
```

Pick a role by opening `/api/as?role=pm&to=/` (also `lead`, `dev`). This sets a role cookie; the role bar on every page switches it too.
