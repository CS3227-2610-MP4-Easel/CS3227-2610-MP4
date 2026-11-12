# W13 data and environment model

W13 adds no application tables or endpoint entities. It defines deployment metadata and seed
ownership around the existing W1 schema.

## Environment contract

| Tier | Source | Data services | AI mode | Secret scope |
|---|---|---|---|---|
| local | working tree | local Postgres or Neon dev branch; non-production Firebase project | mock by default | local ignored files only; no production values; Firebase emulator is not supported by the current W4 auth contract |
| dev | `development` | dedicated Neon and Firebase projects; dev SoCLaaS key | live smoke-capable | Vercel Preview variables scoped to `development` |
| preview | pull-request ref other than `development` | no real data services and no Prisma client construction | mock-only UI/health surface; auth/data routes return W4's `500 INTERNAL` when settings are absent | no data or production credentials |
| prod | protected `main` | dedicated Neon and Firebase projects; production SoCLaaS key | live | protected Vercel Production variables and GitHub Environment secrets |

Required names are `APP_TIER`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `FIREBASE_PROJECT_ID`,
`REGISTRATION_CODE_PM`, `REGISTRATION_CODE_DEV_LEAD`, `REGISTRATION_CODE_DEVELOPER`,
`RATE_KEY_SECRET`, `SOCLaaS_BASE_URL`, `SOCLaaS_API_KEY`, and `AI_ENABLED`, with values scoped
per tier. The frontend additionally receives non-secret `NEXT_PUBLIC_FIREBASE_API_KEY`,
`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and
`NEXT_PUBLIC_FIREBASE_APP_ID`. Secrets are never committed or printed. `FIREBASE_AUTH_EMULATOR_HOST`
must be unset on every tier.

Mock previews omit all Firebase variables; dev and prod receive the four public Firebase variables
from their matching Vercel scope.

Each tier also has a non-secret resource-identity record in the versioned
`workflow/deployment/tier-manifest.json`: allowed Vercel project and alias,
Firebase project id, Neon hostname/project identity, SoCLaaS endpoint, and expected `env` value.
Startup and every seed/migration/smoke operation compare exact normalized resource identities with
this manifest before constructing a Prisma client or sending a request. URLs and project ids are
never ordinary workflow inputs. The manifest is reviewed as a protected workflow/configuration
file and cannot be supplied by a PR or workflow-dispatch input.

## Seed scope

The seed contains deterministic demo users for PM, Dev Lead, and Developer; one active project;
one membership set; checkpoints, epics, tasks, and at least three closed sprints with stable
story-point history so the forecast can demonstrate known velocity. Seed users use non-production
Firebase UIDs and documented local/dev-only registration codes. Production seed execution is not
permitted; production data is created through the application or an explicitly approved migration
operation.

Seed rows contain non-production Firebase UIDs only. A protected dev smoke setup provisions one
Firebase test account outside the repository, binds its UID to the seeded Developer row, and
supplies a short-lived token only to the fixed post-deploy smoke harness. Production smoke uses a
separately provisioned production test identity. Credentials and tokens are protected secrets,
never seed data or artifacts; identities are isolated per tier and removed or disabled after the
deployment window.

## Migration and rollback

The existing Prisma migration remains the schema source of truth. W13 must add a repeatable
procedure that validates the schema, runs Prisma with `DATABASE_URL` set to the protected
`DIRECT_DATABASE_URL` value only inside the migration job, and
keeps the previous application compatible during deployment. The job runs
`DATABASE_URL="$DIRECT_DATABASE_URL" npm --workspace @agile/db exec prisma validate -- --schema prisma/schema.prisma`
before `prisma migrate deploy`, and clears the direct URL in a shell-finally boundary. No down migration is used. If a
migration fails, the job stops, preserves the evidence, and the operator restores the last known
good database through Neon before applying a corrected forward migration. If candidate smoke fails
after a successful expand/contract migration, the previous application remains compatible and the
candidate is not promoted; if compatibility is lost, the owner performs the manual Neon restore
before retrying. A failed or unverified backup/recovery check blocks production.
