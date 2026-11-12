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

The browser needs four more, all from the Firebase console's web app settings (they identify the project; they are not secrets):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | the Firebase web app the sign-in screen talks to |

**Tier configuration.** `APP_TIER=dev` targets the `agile-platform-dev` Firebase/Neon resources;
production targets `agile-platform-prod`. The code-owned target map in
[`src/be/db/src/tier-targets.ts`](../../src/be/db/src/tier-targets.ts) is authoritative:
development uses Neon project `falling-rice-06970921` and production uses `super-sunset-36592949`.
Production runtime uses the pooled database host, while migrations use the protected
`DIRECT_DATABASE_URL` direct host. Do not substitute one for the other.

For local sign-in, use the development Firebase project and keep its domain in Authorized domains.
The four `NEXT_PUBLIC_FIREBASE_*` values belong to the matching tier. Local PostgreSQL 16 is used
for integration tests; production migrations run only from the protected GitHub workflow, not from
a local Prisma command.

Locally, copy `src/fe/.env.example` to `src/fe/.env.local` and fill it in. Never commit secrets (AD-32).

**Firebase for local sign-in.** In a Firebase project for development: turn on Email/Password sign-in, register a web app (its config gives the four values above), and keep `localhost` in Authorized domains. `FIREBASE_PROJECT_ID` is the same project's id.

**Local PostgreSQL for integration tests.** Run PostgreSQL 16 locally (for example a Docker container named `agile-pg-test` on port 5433), apply the migrations, and set `W1_INTEGRATION_DATABASE_URL` to it; without it the integration tests skip.

To run the frontend locally, change to `src/fe` and use its existing development script:

```bash
cd src/fe
npm run dev        # http://localhost:3100
```

**Auth modes.** `authMode` picks one per request (`src/fe/lib/auth/mode.ts`):

- `firebase` — real sign-in and registration (endpoints 2-4). Used when the four `NEXT_PUBLIC_FIREBASE_*` values are set.
- `prototype` — the clickable prototype, for mock previews only (`APP_TIER=preview`, none of the Firebase values, and not Vercel production). Pick a role by opening `/api/as?role=pm&to=/` (also `lead`, `dev`); this sets a role cookie, and the role bar on every page switches it too. `/api/as` returns 404 in every other mode.
- `unconfigured` — any other combination; pages show "Sign-in is not configured for this deployment."
