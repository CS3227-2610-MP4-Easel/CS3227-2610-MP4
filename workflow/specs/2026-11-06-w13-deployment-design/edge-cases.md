# W13 edge cases

| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1, N1 | local starts without production variables | starts in mock mode with the supported non-production Firebase settings; it never falls back to production | safe developer setup | service |
| E2 | F2, F3 | pull-request preview other than `development` has data credentials | Vercel variables omit all data and secret settings, preview starts in mock-only UI/health mode, and auth/data routes return `500 INTERNAL` | untrusted code must not reach data | workflow |
| E3 | F2, F3 | tier, `env`, database host, Firebase project, SoCLaaS key, or registration/rate secret belongs to another tier | startup or deployment fails before database access and reports only the setting name | prevents cross-tier identity and data access | service |
| E4 | F4, N1 | production job is triggered from a PR or non-`main` ref, lacks required checks/review, or checks out a different SHA | migration and deployment are rejected before database access | protects production and binds code to review | workflow |
| E5 | F4, F5 | migration checksum differs from committed source | job stops before mutation and records the mismatch | prevents tampered schema changes | workflow |
| E6 | F5 | previous application cannot read the migrated schema or migration is not expand/contract compatible | compatibility check fails and production migration is blocked | safe rollback path | integration |
| E7 | F6 | seed is run twice | the complete logical dataset—counts, values, memberships, checkpoints, epics, tasks, sprints, statuses, points, and history—is byte-for-byte equivalent after the second run and has no duplicates | repeatable environments | integration |
| E8 | F6 | seed target is production | operation is rejected before connecting or writing | prevents demo data leakage | service |
| E9 | F7 | SoCLaaS is unreachable from Vercel | dev smoke is `degraded`, records `AI_ENABLED=false`, and deploy remains healthy for non-AI checks; prod smoke is `fail` and promotion is blocked unless the owner records the approved fallback | verifies G-26 honestly | integration |
| E10 | F7 | forged, duplicate, or comma-varied `x-vercel-forwarded-for` changes the limiter bucket | smoke check fails; the trusted Vercel boundary must overwrite or reject client-supplied values | prevents rate-limit bypass | integration |
| E11 | F7 | Firebase token belongs to another project | auth smoke check returns 401 | prevents cross-tier identity acceptance | integration |
| E12 | F8, N2 | Neon backup cannot restore within the target | production readiness remains blocked and evidence records the failed target | recovery is an acceptance gate | operational |
| E13 | F5, F8 | migration fails halfway | job stops; no down migration runs; operator restores the last known-good backup and applies a corrected forward migration | avoids destructive rollback | operational |
| E14 | F7, N1 | smoke output contains a token, code, prompt, or connection string | redaction test fails the job and the value is not retained in evidence | prevents secret leakage | security |
| E15 | F1 | local sets `FIREBASE_AUTH_EMULATOR_HOST` | startup fails because unsigned emulator tokens are not supported by W4 | prevents forged local identities | service |
| E16 | F4, N2 | recovery readiness has not been verified before production job | production migration/deployment does not start | makes recovery an actual gate | workflow |
| E17 | F7 | `/api/health` is not `{ "status": "UP" }` | smoke fails and candidate is not promoted | verifies the public route | integration |
| E18 | F7 | pooled runtime DB connection or direct migration connection fails | the named connection check fails and evidence identifies the check without a URL | verifies G-32 | integration |
| E19 | F7 | Prisma serverless client or Hono-in-Next route fails | the named check fails and candidate is not promoted | verifies G-32 | integration |
| E20 | F6 | seed lacks PM, Dev Lead, Developer, active project, memberships, checkpoints, epics, tasks, three closed sprints, or stable story-point history | seed validation fails before the tier is marked demo-ready | ensures Tier 1 demonstration data | integration |
| E21 | F6, N1 | seed source or generated data contains a secret or production Firebase UID | secret scan fails and seed is rejected | prevents data leakage | security |
| E22 | F8, N2 | backup is missing, restore fails, or RPO exceeds 24 hours or RTO exceeds 4 hours | readiness remains blocked and evidence records the exact failed measurement | recovery acceptance | operational |
| E23 | F8 | recovery target is local, preview, dev, or otherwise not an approved restricted rehearsal target | restore is rejected before data access | prevents production data exposure | security |
| E24 | F7, N3 | PR CI receives a SoCLaaS key or attempts an outbound live request | workflow fails before the request and no key is exposed; only protected post-deploy smoke may call live SoCLaaS | protects quota and secrets | workflow |
| E25 | F7 | candidate smoke passes but promotion targets a different SHA | promotion is rejected and the candidate remains unpromoted | prevents migration/deploy drift | workflow |
| E26 | F2 | dev settings are missing or dev smoke fails | deployment evidence records the named failure and the dev tier is not marked healthy | makes G-33 observable | workflow |
| E27 | F5 | Prisma validation or clean-database migration fails | production mutation does not start and only redacted failure evidence is retained | protects schema integrity | integration |
| E28 | F6 | seed lacks PM, Dev Lead, Developer, project, memberships, checkpoints, epics, tasks, three closed sprints, or stable story-point history | seed validation fails before demo-ready status | ensures Tier 1 demonstration data | integration |
| E29 | F8 | seed reapplication fails after restore, checksum is missing, or evidence omits a required field | recovery readiness remains blocked and the missing field/failure is recorded | makes recovery complete and auditable | operational |
| E30 | N1 | a production marker appears in tracked files, PR workflow variables, local setup files, logs, summaries, or artifacts | the scan fails before deployment and the marker is absent from retained evidence | prevents secret leakage | security |
| E31 | F7, N1 | migration, Vercel, Firebase, limiter, or SoCLaaS subprocess emits a secret marker | the operation fails or is redacted at capture; raw output and failure dumps are not uploaded | closes non-smoke leakage paths | security |
| E32 | F6 | seed is labelled `dev` but resolves to a production host, or an attacker supplies a host/project URL | operation rejects before Prisma connects | prevents tier-label bypass | security |
| E33 | F8 | recovery restore is attempted through an automated tool or into a developer-accessible target | operation is rejected; only the manual approved Neon runbook is allowed | respects recovery guardrail | operational |
| E34 | N1 | a live key is available before checkout or to a PR-controlled smoke script | workflow fails closed and no request is made | protects production credentials | security |
| E35 | F4, F7 | migration manifest, build artifact, candidate deployment, or promoted deployment identifies a different SHA | operation stops before mutation or promotion and records only the mismatch | prevents commit drift | workflow |
| E36 | F5 | `prisma validate --schema prisma/schema.prisma` fails before migration | migration stops before mutation and clears the direct URL mapping | protects schema integrity | integration |
| E37 | F6 | seed tier is `preview`, `test`, unknown, or otherwise unsupported | seed rejects before Prisma construction | prevents invalid-tier writes | service |
| E38 | F7 | smoke targets the wrong Vercel project/alias, Neon identity, Firebase project, SoCLaaS endpoint, or `env` | smoke fails before live requests | prevents resource confusion | security |
| E39 | F7 | smoke token is missing, expired, malformed, revoked, or not bound to the seeded smoke UID | `/api/me` check fails with the expected auth error and candidate is not promoted | verifies identity provisioning | integration |
| E40 | F8 | recovery evidence omits backup reference, migration checksum, restore times, RPO, RTO, seed result, owner, or outcome | readiness remains blocked and the missing field is named | makes evidence complete | operational |
| E41 | F2 | Vercel deployment metadata has a different commit or canonical alias than the merged `development` commit/manifest | dev tier is not marked healthy and owner must redeploy the merged commit | prevents stale dev tier | workflow |
| E42 | F7 | dev SoCLaaS probe fails | smoke status is exactly `degraded`, `AI_ENABLED=false` is recorded, non-AI checks may pass, and dev is not reported as live-AI healthy | makes the fallback deterministic | integration |
| E43 | F7 | Vercel does not strip a client-supplied forwarded-IP header | limiter readiness fails and dev/prod deployment remains blocked | enforces the trust boundary | security |
| E44 | F7 | smoke harness attempts to execute branch-controlled code with a live key | workflow fails before the request and the key is unavailable to the branch code | protects live credentials | security |

## What could corrupt data

- Applying a migration with the wrong `DIRECT_DATABASE_URL` could alter the wrong tier; the job must validate the tier and database host before mutation.
- Running a non-idempotent seed twice could duplicate memberships or history; seed keys and rerun behavior must be tested against an empty and already-seeded dev database.
- Restoring a backup without recording the migration checksum could leave the application and schema at incompatible versions; recovery evidence must bind the restore to the last known-good migration.
