# Requirements

## Functional

- F1. The owner records Vercel deployment metadata for the merged SHA and requires the canonical project ID, `development` alias, successful deployment state, and exact merged SHA, then records fixed development smoke results.
- F2. `runSeed` rejects a `DATABASE_URL` whose parsed host and database target do not match the immutable code-owned target map for `APP_TIER`, before constructing Prisma or returning through a supplied test client.
- F3. `runProductionMigration` reads every entry in `workflow/deployment/migrations.manifest`, validates every migration checksum and path, and invokes Prisma only after all entries succeed.
- F4. Production resource validation requires `VERCEL_ENV=production`; development remains `preview`. The protected production workflow requirement is superseded by SD7; the owner performs production migration/deployment manually.
- F5. Development evidence is collected by the owner through read-only Vercel inspection and fixed smoke requests; repository workflows and application runtime receive no Vercel deployment token.
- F6. Superseded by SD7: production migration is owner-operated and must keep direct database credentials out of application runtime and logs.

## Non-functional

- N1. No production credential is printed, returned, or included in an error message.
- N2. Failed identity, target, or checksum validation performs no database mutation.
- N3. Existing callers and the Prisma schema remain unchanged.
- N4. A Vercel deployment is accepted only when the owner records that it was created strictly after the authoritative GitHub merge-commit timestamp and the `development` alias belongs to that exact deployment ID.
