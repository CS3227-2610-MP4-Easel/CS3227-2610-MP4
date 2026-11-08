# W13 deployment and recovery runbook

## Manual development deployment gate

The owner performs this gate after a reviewed commit is merged to `development`:

1. In Vercel, inspect the deployment for the merged SHA and record only the canonical project ID, deployment ID, exact `development` alias, `READY` state, deployment creation time, authoritative push timestamp, owner, and check time.
2. Confirm the deployment creation time is strictly after the GitHub merge-commit timestamp and that the alias is owned by the same deployment ID.
3. Against that exact HTTPS alias, with redirects disabled, run the fixed checks: `GET /api/health` must return `200` with status `UP`; authenticated `GET /api/me` with the protected dev smoke identity must return `200`; a token from another Firebase project must return `401`; confirm the inspected deployment is the `dev` tier; `POST /api/dev/projects/<seeded-project-id>/standups` with `{}` must return `200` and a JSON boolean `degraded` field. Record `ai=pass` only when `degraded` is `false`; record `ai=degraded` only when `degraded` is `true`, `AI_ENABLED=false` is observed, and every non-AI check passes. Missing, non-boolean, or malformed `degraded`, or any `3xx`, fails the gate.
4. Recheck the deployment ID, alias ownership, and `READY` state after the smoke requests. If the alias moved, discard the evidence and repeat against the replacement deployment.
5. Record a redacted evidence object containing exactly: `target`, `commit`, `pushTimestamp`, `deploymentId`, `project`, `alias`, `state`, `createdAt`, `checkedAt`, `health`, `auth`, `foreignAuth`, `tier`, `ai`, `aiEnabled`, `owner`, and `outcome`. Values are status labels, timestamps, IDs, the fixed alias, and `AI_ENABLED` observation only; never record tokens, credential URLs, response bodies, or secrets.

T4 is complete only when all fields are present, `health`, `auth`, `foreignAuth`, and `tier` pass, `ai` is `pass` or approved dev `degraded`, and `outcome` is `pass`. No repository workflow or application runtime receives a Vercel deployment token.

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
