# W13 conventions

- Environment names are exactly `local`, `dev`, `preview`, `prod`, and `test`; `APP_TIER` selects one.
- `development` maps to dev; protected `main` maps to prod; every other preview maps to mock-only preview (AD-53 clarification of AD-29).
- Runtime uses the pooled `DATABASE_URL`; the migration job temporarily maps its protected `DIRECT_DATABASE_URL` secret to Prisma's `DATABASE_URL` input, then clears it. Recovery uses Neon’s protected restore operation, never a developer-supplied URL.
- Production secrets exist only in Vercel Production variables or the protected GitHub Environment; they are never stored in `.env` files, fixtures, seed data, logs, or PR workflow outputs.
- Smoke evidence is structured, timestamped in UTC, tied to an exact commit and tier, and redacts credentials, tokens, registration codes, prompt text, and response text.
- Seed versions are deterministic and idempotent; production seed execution is rejected.
- CI uses the mock gateway; only explicitly scoped deployed-tier smoke checks may call SoCLaaS.
- `FIREBASE_AUTH_EMULATOR_HOST` is unset; local auth uses a non-production Firebase project under the existing W4 Admin SDK contract.
- Migrations are forward-only. Recovery uses restore plus a corrected forward migration, never a down migration.
- Resource identities are allowlisted per tier before any database client or live service client is constructed; workflow inputs cannot supply URLs, project IDs, aliases, or restore targets.
- The non-secret allowlist is `workflow/deployment/tier-manifest.json`, versioned with fields `tier`, `branch`, `vercelProject`, `vercelAlias`, `firebaseProjectId`, `neonHost`, `neonProject`, `soclaasBaseUrl`, and `env`; secrets are resolved only from the matching protected environment. Validation compares exact normalized values and fails before client construction.
- A credential-free preview is intentionally health/UI-only: the API entry path must return the existing `500 INTERNAL` contract for auth/data routes without constructing Prisma or a Firebase verifier. This is the only supported mock-preview runtime.
- The limiter smoke gate is valid only when the Vercel project is configured to strip client-supplied `x-vercel-forwarded-for` and `x-forwarded-for` before the request reaches the app; if the deployed header-variation test fails, dev/prod readiness fails and the deployment remains blocked.
- Production workflows run only from protected workflow definitions on `main`, use least-privilege permissions and fixed inputs, reject `pull_request_target` and untrusted artifacts, and inject secrets only after checkout/SHA/manifest checks. The live smoke harness is fixed infrastructure and does not execute branch-controlled code with live keys.
