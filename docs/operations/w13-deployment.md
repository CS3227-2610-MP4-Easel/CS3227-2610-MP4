# W13 deployment and recovery runbook

## Development deployment check

The protected `w13-development-verification` environment needs a read-only
`VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_DEV_ALIAS`. Set `VERCEL_DEV_ALIAS`
to the exact development hostname shown by Vercel, without `https://`. The
check compares it with the selected deployment's `aliases[]` response.

## Production migration

Production migration is an owner-approved protected GitHub Environment operation. It runs only
from protected `main`, after checkout and commit/resource identity checks. The job validates the
schema and committed migration checksum, then runs the forward migration with the protected direct
Neon connection:

```text
DATABASE_URL="$DIRECT_DATABASE_URL" npm --workspace @agile/db exec prisma validate -- --schema prisma/schema.prisma
DATABASE_URL="$DIRECT_DATABASE_URL" npm --workspace @agile/db exec prisma migrate deploy -- --schema prisma/schema.prisma
```

The direct URL exists only in the migration process environment and is cleared in the finalizer.
No down migration is used. If a migration fails, stop the job and preserve only redacted evidence.

## Manual recovery rehearsal

The owner confirms that the active Neon plan supports RPO no greater than 24 hours and RTO no
greater than 4 hours. Recovery is performed manually through the approved restricted Neon target.
An ordinary developer environment, generic preview deployment, production project, or target
containing production data is not permitted. The owner may use an explicitly approved isolated
branch in a separate development project (for example, `agile-platform-dev/w13-recovery-baseline`)
only when it contains synthetic non-production data, has no production credentials or application
wiring, and is used solely for this owner-operated rehearsal. Restore the last known-good backup,
apply a corrected forward migration, and reapply the non-production seed only where the approved
rehearsal target permits it.

Record a redacted evidence object containing exactly: `target`, `backupReference`,
`migrationChecksum`, `restoreStartedAt`, `restoreEndedAt`, `rpoHours`, `rtoHours`, `seedResult`,
`owner`, and `outcome`. Production readiness remains blocked when any field is missing or the
measured RPO/RTO exceeds its limit.
