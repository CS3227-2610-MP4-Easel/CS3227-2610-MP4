# W13 deployment and recovery runbook

## Manual development deployment gate

The owner performs this gate after a reviewed commit is merged to `development`:

1. In Vercel, inspect the deployment for the merged SHA and record only the canonical project ID, deployment ID, exact `development` alias, `READY` state, deployment creation time, authoritative push timestamp, owner, and check time.
2. Confirm the deployment creation time is strictly after the GitHub merge-commit timestamp and that the alias is owned by the same deployment ID.
3. Against that exact HTTPS alias, with redirects disabled, run the fixed checks: `GET /api/health` must return `200` with status `UP`; authenticated `GET /api/me` with the protected dev smoke identity must return `200`; a token from another Firebase project must return `401`; confirm the inspected deployment is the `dev` tier. Any `3xx` fails the gate. The Developer standup/AI probe is not part of T4 and is tracked by W9 separately.
4. Recheck the deployment ID, alias ownership, and `READY` state after the smoke requests. If the alias moved, discard the evidence and repeat against the replacement deployment.
5. Record a redacted evidence object containing exactly: `target`, `commit`, `pushTimestamp`, `deploymentId`, `project`, `alias`, `state`, `createdAt`, `checkedAt`, `health`, `auth`, `foreignAuth`, `tier`, `owner`, and `outcome`. Values are status labels, timestamps, IDs, and the fixed alias only; never record tokens, credential URLs, response bodies, or secrets.

T4 is complete only when all fields are present, `health`, `auth`, `foreignAuth`, and `tier` pass, and `outcome` is `pass`. No repository workflow or application runtime receives a Vercel deployment token.

## Production migration (protected CI handover)

Production migration and deployment run only from the protected `production` Environment in the
W13 workflow. The owner does not run Prisma or the migration wrapper locally. Before release:

1. In Vercel, disable Production Branch auto-deploy for `main` and record redacted setting evidence
   showing the project, branch, setting state, owner, and check time. Do not record tokens, URLs with
   credentials, the deploy hook URL, response bodies, or secret values.
2. Confirm the release commit and committed migration manifest, then merge or promote that reviewed
   commit to `main`.
3. Confirm that the `main` push starts the protected workflow and that the job pauses for approval
   of the protected `production` Environment. Approve that workflow run in GitHub Actions. Its
   migration action is the sole CI entry point and runs `node --import tsx scripts/w13/migrate-production.mjs`;
   the direct database URL is supplied only to that process environment.
4. Before the hook, the workflow rechecks that remote `main` still equals `github.sha`. This closes
   the ordinary branch-advance race, but Vercel Deploy Hooks do not accept a commit SHA, so the hook
   itself cannot provide exact SHA binding; Vercel may resolve the branch after this check. An exact
   binding requires a Vercel API/token design, which is outside the approved tokenless boundary.
5. Inspect the successful migration evidence and then the successful deployment evidence. A target,
   manifest, checksum, command, or deploy-hook failure is failed release evidence: stop and record no
   successful migration or deployment outcome. No down migration is used.

The release evidence is redacted and limited to status labels, timestamps, commit/deployment IDs,
owner, and approved target identifiers. Never record tokens, credential-bearing URLs, the deploy hook
URL, secret values, or response bodies.

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
