# Database migration and recovery procedure

W1 migrations are forward-only and are applied by the protected CI environment with
`npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`. Developer shells and
pull-request jobs must not receive production database credentials.

## Compatibility check

Before deployment, CI validates the schema, regenerates the Prisma client, applies the committed
migration to a clean database, and runs the previous application against the migrated schema. The
previous application must still read and write every field it supports during the deployment
window. Destructive drops, incompatible renames, irreversible transforms, and down migrations
are rejected.

Local schema work uses:

```text
npx prisma migrate dev --name <name> --schema packages/db/prisma/schema.prisma
npx prisma generate --schema packages/db/prisma/schema.prisma
npx prisma validate --schema packages/db/prisma/schema.prisma
```

## Recovery targets and evidence

W13 records the Neon plan backup/restore check, a restore rehearsal, seed-data reapplication, and
timestamps. The recovery target permits at most 24-hour recovery-point loss and requires a
4-hour recovery-time target. A failed migration is handled by restoring the last known-good
database and applying a corrected forward migration; production never runs a down migration.

The evidence record must include the protected environment job, migration name and checksum,
previous application compatibility result, restore start/end timestamps, and the owner/outcome
task log. The protected-CI migration guard is a W12/W13 handoff; W1 documents the requirement but
does not implement CI policy enforcement.
