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

Since the Prisma 7 upgrade, `npm test` (its `pretest` runs `prisma generate`) fails unless `DATABASE_URL` is set, so export it locally first.

**Environment variables.** The API validates its auth settings when its module loads, so `next build`, `next dev` and every deployed tier need them:

| Variable | Purpose |
|---|---|
| `APP_TIER` | the tier (`preview`, `dev`, `prod`, ...); mock previews may omit everything below except `APP_TIER=preview` |
| `FIREBASE_PROJECT_ID` | Firebase project used to verify ID tokens |
| `REGISTRATION_CODE_*` (three) | per-role registration codes, 13 to 128 characters, distinct; no demo codes on prod |
| `RATE_KEY_SECRET` | HMAC key for the limiter's client keys; must differ between dev and prod |
| `LLM_MODE` | `mock` or `live`; `test` and `preview` must be mock, `prod` must be live |
| `SOCLAAS_API_KEY` | SoCLaaS key (dev and prod keys differ); sent only to the SoCLaaS URL |
| `AI_ENABLED` | set `false` per tier to switch AI off |

Locally, put them in `src/fe/.env.local`. Never commit secrets (AD-32).

To run the frontend locally, change to `src/fe` and use its existing development script:

```bash
cd src/fe
npm run dev        # http://localhost:3100
```

Pick a role by opening `/api/as?role=pm&to=/` (also `lead`, `dev`). This sets a role cookie; the role bar on every page switches it too.
