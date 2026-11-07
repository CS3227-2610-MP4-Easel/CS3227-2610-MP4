# W13 operational interfaces

These are operator and CI operations, not public application endpoints.

| Operation | Caller / authorization | Inputs | Output / evidence | Errors and security |
|---|---|---|---|---|
| `deployDev(commit)` | Repository owner merges the reviewed PR into `development`; Vercel Git integration automatically deploys the canonical dev project/alias | exact merged commit; no caller-supplied credentials | canonical dev alias, checked-out SHA, tier, smoke-check results | acceptance requires Vercel deployment metadata `githubCommitSha` equals the merged `development` SHA and alias equals `tier-manifest.vercelAlias`; missing config, health, DB, or auth check stops deployment, while SoCLaaS failure records `AI_ENABLED=false` and is a degraded non-blocking dev result |
| `migrateProduction(commit)` | approved GitHub Environment job only; protected `main`, after required CI checks and review | exact protected SHA; migration manifest; environment-provided production target | migration name/checksum, compatibility result, timestamps | detached checkout verifies `git rev-parse HEAD` and manifest hash before secrets or mutation; run `DATABASE_URL="$DIRECT_DATABASE_URL" npm --workspace @agile/db exec prisma migrate deploy -- --schema prisma/schema.prisma`, then clear the mapping; any mismatch or validation failure stops |
| `deployProduction(commit)` | same approved job after migration and recovery readiness; one `production` concurrency group with `cancel-in-progress=false` | exact protected `main` SHA and fixed production Vercel target | immutable candidate URL, smoke evidence, promoted URL, SHA | detached checkout verifies `git rev-parse HEAD`; `sha256sum workflow/deployment/migrations.manifest` is recorded; the built artifact digest and Vercel Deployment API `meta.githubCommitSha` equal the protected SHA; build once, smoke-test candidate, then promote/alias; failed smoke never promotes |
| `seed(tier)` | local or dev maintenance job; target is resolved from tier, never caller-supplied; production rejected | tier, deterministic seed version | counts and stable seed version | production target, forged tier, or non-allowlisted host is rejected before connection; rerun is idempotent |
| `recoveryRehearsal(tier)` | repository owner / approved operations job; restricted rehearsal target only; restore is performed manually through the approved Neon operation | approved backup reference, fixed rehearsal target, seed version | backup reference, migration checksum, restore start/end, measured RPO, measured RTO, seed result, owner, outcome | missing backup, sensitive target, incomplete evidence, or target breach blocks production readiness; production data never restores to local/preview/dev; W13 adds runbook/preflight/evidence, not automatic restore tooling |
| `smoke(tier)` | protected post-deploy job with tier-scoped credentials; never PR CI | deployed candidate/alias URL, expected tier, fixed test identity | named health, pooled DB, direct migration, Prisma/serverless, Hono route, auth, limiter, and SoCLaaS results | wrong tier, forged forwarded IP, foreign Firebase token, failed health/DB/AI check, or redaction failure fails the job; no credentials or prompt text logged |

The existing `GET /api/health` response remains `{ "status": "UP" }`. Smoke checks use the
existing application contracts and do not add a deployment-only public endpoint. Evidence is an
allowlisted structured record; raw subprocess output and failure dumps are not uploaded.

The protected smoke harness is a workflow file from the protected `main` ref and does not execute
branch-controlled scripts with live credentials. It calls only fixed HTTP requests; its fixtures
are the deployed URL, a protected per-tier Firebase smoke token, and the W4 `check-code` route.
The token is not created by seed data.

| Check | Request | Expected result |
|---|---|---|
| health | `GET /api/health` | `200` and `{ "status": "UP" }` |
| pooled database/auth | authenticated `GET /api/me` with protected smoke token | `200`; evidence names `pooled-runtime-db` |
| foreign auth | same route with token from another Firebase project | `401` |
| limiter | repeated W4 `check-code` requests while varying forwarded-IP headers | same limiter bucket; no bypass |
| AI reachability | deployed runtime `GET /v1/models` through the SoCLaaS client | dev returns smoke status `degraded`, records `AI_ENABLED=false`, and remains deployable; production returns `fail` and does not promote unless the owner records the approved fallback |
| serverless route | health and `/api/me` requests through deployed Next/Hono path | successful response proves route mount and serverless client |
