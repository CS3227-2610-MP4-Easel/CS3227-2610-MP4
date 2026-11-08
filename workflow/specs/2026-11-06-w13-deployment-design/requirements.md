# W13 requirements

## Functional

| ID | Requirement | Acceptance criterion |
|---|---|---|
| F1 | Local configuration supports mock mode without production credentials. | Given only local non-production settings, when the app starts, then it starts with mock AI and does not require production service credentials. |
| F2 | The `development` branch maps to the dev Vercel Preview tier. | Given a merge to `development`, when deployment completes, then the app uses dev Neon, Firebase, SoCLaaS, registration codes, and rate secret, and records `env=dev`. |
| F3 | Other pull-request previews are isolated from real data services. | Given a pull-request preview other than `development`, when it starts, then it uses mock mode and has no Neon, Firebase, SoCLaaS, registration-code, or rate-secret variables. |
| F4 | Production migration and deployment require the protected GitHub Environment job. | Given a candidate on protected `main`, when the job is not approved or required checks/review are absent, then neither production migration nor production deployment occurs; after approval, both run against production resources only. |
| F5 | Migration execution is forward-only and compatible with the previous application version. | Given a clean or previous-version database, when the production migration check runs, then the expand/contract compatibility check, migration checksum, and Prisma validation pass before mutation. |
| F6 | Seed data is repeatable and demonstration-safe. | Given an empty dev database, when the seed procedure runs twice, then the second run produces the same logical records without duplicate users or projects and contains no secrets. |
| F7 | Deployment evidence covers health, database, authentication, and AI reachability. | Given a deployed dev or prod tier, when smoke checks run, then each named check emits `pass`, `degraded` (dev AI reachability only), or `fail` evidence with tier, commit, timestamp, and outcome without credentials or tokens; production cannot promote on `degraded` or `fail`. |
| F8 | Recovery evidence records the Neon backup/restore check and seed reapplication. | Given a recovery rehearsal, when it completes, then evidence records the backup, migration checksum, restore start/end, measured RPO/RTO, seed result, owner, and outcome. |

## Non-functional

| ID | Requirement | Acceptance criterion |
|---|---|---|
| N1 | Production credentials are CI-only. | A repository search, PR job inspection, and developer setup inspection find no production credential value or production database URL. |
| N2 | Recovery target is explicit. | The active Neon plan is checked for at most 24-hour recovery-point loss and 4-hour recovery-time target; failure to verify leaves production deployment blocked. |
| N3 | Live AI is never called by CI tests. | CI test execution uses the mock gateway and does not make a SoCLaaS request. |
