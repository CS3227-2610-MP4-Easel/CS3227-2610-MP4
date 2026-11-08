# Requirements

## Functional

- F1. The owner records Vercel deployment metadata for the merged SHA and requires the canonical project ID, `development` alias, successful deployment state, and exact merged SHA, then records fixed development smoke results.
- F2. `runSeed` rejects a `DATABASE_URL` whose parsed host and database target do not match the immutable code-owned target map for `APP_TIER`, before constructing Prisma or returning through a supplied test client.
- F3. `runProductionMigration` reads every entry in `workflow/deployment/migrations.manifest`, validates every migration checksum and path, and invokes Prisma only after all entries succeed.
- F4. Production resource validation requires `VERCEL_ENV=production`; development remains `preview`.
- F5. Development evidence is collected by the owner through read-only Vercel inspection and fixed smoke requests; repository workflows and application runtime receive no Vercel deployment token.
- F6. Production migration child processes receive only the allowlisted migration environment and temporary `DATABASE_URL`, never `DIRECT_DATABASE_URL`.
- F9. Production deployment is triggered only by the protected workflow after migration/build validation through the owner-created production Vercel Deploy Hook; Git auto-deploy for production is disabled.

## Non-functional

- N1. No production credential is printed, returned, or included in an error message.
- N2. Failed identity, target, or checksum validation performs no database mutation.
- N3. Existing callers and the Prisma schema remain unchanged.
- N4. A Vercel deployment is accepted only when the owner records that it was created strictly after the authoritative GitHub merge-commit timestamp and the `development` alias belongs to that exact deployment ID.
