# W13 Safety Repairs Design

- **Status:** Amended and approved (operator, 2026-11-12)
- **Format:** v2
- **Risk tier:** High - this change controls database tenancy, production migrations, and production deployment ordering
- **Workstream:** W13 | **Plan:** to be written after Gate 1 approval
- **Constraints consulted:** AD-32, C~3, C~4, C~9, C~10, C~11, C~12, C~13, C~15, and the W13 deployment target contract

## 1. Problem

The W13 recovery exception in `src/be/db/src/tier-targets.ts` accepts a database URL when the
operator supplies matching `NEON_HOST`, `NEON_PROJECT`, and branch labels. Those values are not
trusted evidence that the URL belongs to the approved Neon recovery branch. The seed then performs
upserts, so a mistaken target can create or overwrite demo records.

W13 also retired the protected production workflow while Vercel continues to auto-deploy pushes to
`main`. The runbook invokes Prisma directly and does not enforce the migration wrapper's target and
checksum checks. The desired result is a trusted recovery target, a CI-only migration and deployment
sequence, and a runbook that describes that sequence without offering an unsafe manual path.

## 2. Goals

### Functional

- **F1 - Trusted recovery target.** Recovery seeding accepts only the code-owned tuple `{ project: falling-rice-06970921, branch: w13-recovery-baseline, host: ep-purple-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech, database: neondb }`; operator-provided labels cannot authorize another host. Accept: a URL for another host fails even when all current recovery labels are supplied.
- **F2 - Protected production sequence.** A protected workflow with only `push` to `main` runs the checked-in migration wrapper and triggers the production deployment only after it succeeds. Accept: the workflow has no `pull_request` or `workflow_dispatch` trigger, uses the production Environment, and the Deploy Hook step is unreachable when migration fails or is skipped.
- **F3 - Complete migration checks.** Production CI invokes `node --import tsx scripts/w13/migrate-production.mjs` with `APP_TIER=prod`, the pooled runtime observation, the confirmed non-pooled production migration host, and protected `DIRECT_DATABASE_URL`; direct Prisma commands are removed from the runbook. Accept: the direct URL is validated against the code-owned non-pooled host, while runtime `NEON_HOST` remains the pooled application endpoint; target, manifest, and checksum validation execute before Prisma migration.
- **F4 - No dead workflow exemption.** The checker applies baseline pull-request safety rules to every workflow, then applies one explicit production contract to the committed `w13-production.yml`. Accept: the former filename does not bypass baseline checks, while the production contract requires its exact protected trigger/environment shape.
- **F5 - Regression coverage.** Tests cover wrong recovery hosts, production workflow ordering, checker behavior, and runbook commands. Accept: focused tests fail if any safety boundary regresses.

### Non-functional

- **N1 - Fail closed.** Invalid target identity or migration evidence prevents database writes and deployment-trigger execution. Accept: invalid recovery input and failed migration checks produce no seed writes or deployment request.
- **N2 - Secret minimization.** CI passes only the direct database URL to the migration wrapper and does not expose database credentials or Vercel API tokens in tracked files or evidence. Accept: workflow tests show the child environment is allowlisted and the workflow contains no Vercel API token.

## 3. Non-goals

- No Neon API integration or new external dependency; the repository binds recovery to the owner-confirmed exact direct target rather than inventing an unverified discovery protocol.
- No production schema or seed-record changes.
- No Vercel API token deployment; the existing protected Deploy Hook boundary remains the deployment
  mechanism.
- No reversal of AD-32. C~9 is reversed by C~12.

## 4. Design

### 4.1 Approach

Replace the recovery exception's independently supplied host with an immutable recovery target entry
containing `falling-rice-06970921`, `w13-recovery-baseline`,
`ep-purple-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech`, and `neondb`. The validator compares the
parsed URL and every supplied observation to that entry; it does not accept arbitrary non-production
hosts. This direct host is for the recovery seed/migration operation only; ordinary application
runtime connections remain pooled.

Restore `.github/workflows/w13-production.yml` as a protected `main` workflow. It has only a `push`
trigger for `main`, checks out `github.sha`, validates/builds the candidate, runs the migration wrapper
in the `production` GitHub Environment, and invokes `VERCEL_DEPLOY_HOOK_URL` only after migration
succeeds. Its concurrency group is `production` with `cancel-in-progress: false`. Disable Vercel Git
auto-deploy for `main` and record that setting as a release gate; the Deploy Hook is the only production
deployment trigger. Production keeps separate code-owned hosts for runtime and migration: the pooled
runtime host remains `ep-summer-heart-b3767eul-pooler.c-4.ap-southeast-1.aws.neon.tech`, while the
non-pooled migration host is `ep-summer-heart-b3767eul.c-4.ap-southeast-1.aws.neon.tech`; the
production migration validator compares `DIRECT_DATABASE_URL` with the latter and compares
`NEON_HOST` with the former.

Remove the filename-only exemption. The checker exposes a shared baseline validator plus
`validateProductionWorkflowContract(text, file)`. Directory validation runs the baseline rules for
every file, then runs the production contract only for the committed path
`.github/workflows/w13-production.yml`. The production contract requires `push` on `main` only, no
pull-request or dispatch trigger, `environment: production`, serialized concurrency, pinned approved
actions, checkout of `github.sha`, and migration before the Deploy Hook. A differently named workflow
cannot receive the production allowance.

### 4.2 Data model

No persisted data changes. The logical target map gains code-owned recovery and production migration
target identities with non-null tier, Neon project, branch, runtime host, direct host, and database
name. Existing application runtime targets remain unchanged. If an approved host changes, the target
map and regression fixtures change together; no migration or rollback is required.

### 4.3 Interfaces

| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors | Notes |
|---|---|---|---|---|---|
| `validateDatabaseTarget(env, tier, url?)` | Seed or migration process | Recovery URL host must equal `ep-purple-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech`; production migration URL host must equal `ep-summer-heart-b3767eul.c-4.ap-southeast-1.aws.neon.tech`; project, branch, and database must equal the code-owned tuple | Target entry with tier, project, branch, runtime host, direct host, and database identifiers | Existing fixed target error without URL or credential | Must reject before Prisma client construction |
| `runProductionMigration(env)` | Protected production CI | `APP_TIER=prod`, `DIRECT_DATABASE_URL`, pooled `NEON_HOST`, and `NEON_PROJECT` | `{ migrations: [{ path, checksum }], outcome: "pass" }` | Target, manifest, or checksum error before Prisma | Child receives allowlisted keys only; `DIRECT_DATABASE_URL` becomes `DATABASE_URL` and is not retained as a child key |
| Production workflow | Protected `main` push | `github.sha`, `production` Environment approval, `DIRECT_DATABASE_URL`, `VERCEL_DEPLOY_HOOK_URL` | Successful hook request after successful migration | Any failed/skipped migration prevents hook request | No pull-request or manual-dispatch trigger; `cancel-in-progress: false` |
| Workflow checker | CI security job | Existing workflow files and action manifest | Array of `{ file, rule }` errors | Any baseline or production-contract violation | Baseline applies to all files; production contract is explicit, not filename trust |

### 4.4 UI

None: this is a deployment and database-safety change.

### 4.5 Conventions

- AD-32 is binding: production migration and deployment run only from protected CI.
- The runbook describes owner approvals and Vercel configuration prerequisites, but never instructs
  an operator to run Prisma directly against production.
- Production CI uses the repository migration wrapper as the only migration entry point.
- A deployment trigger is permitted only after the migration step succeeds in the same protected job.
- The production workflow is push-only on `main`; reruns use the same immutable event SHA and cannot
  select an arbitrary ref.

### 4.6 Sequencing constraints

The exact recovery target must be code-owned before recovery tests are updated. The workflow checker
change, production workflow, workflow tests, migration tests, and runbook must land together. Vercel
production auto-deploy must be disabled and redacted evidence recorded before the protected workflow
is enabled or a release is promoted; otherwise the workflow cannot guarantee migration-before-live-code
ordering.

## 5. Edge cases

| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1 | Wrong recovery host with canonical project, branch, database, and matching `NEON_HOST` | Validation fails before seed client construction or any upsert | unit |
| E2 | F1 | Approved recovery host with wrong branch, project, or database | Validation fails with a fixed target error | unit |
| E3 | F1 | Recovery URL is malformed, pooled, production, or missing required observations | Validation fails before seed client construction | unit |
| E4 | F2/F3 | Wrapper fails target, manifest, checksum, Prisma, or command execution | Deployment trigger is not executed | workflow/unit |
| E5 | F2 | Workflow has pull-request, dispatch, non-main, or unprotected execution path | Production contract rejects the file | workflow/unit |
| E6 | F2 | Two production runs overlap | Concurrency serializes them without cancellation | workflow/static |
| E7 | F3 | Runbook or workflow uses direct Prisma migration | Contract test fails; only `node --import tsx scripts/w13/migrate-production.mjs` is accepted | static/unit |
| E8 | F4 | A file with the former privileged filename or another filename uses unsafe triggers/environment | Baseline checks reject it unless the committed production contract also passes | unit |
| E9 | F4 | Existing production workflow uses unpinned or unapproved actions | Checker rejects it | unit |
| E10 | F5 | CI receives a migration secret | Secret is not written to tracked evidence or child environment beyond the direct URL mapping | unit/workflow |

### What could corrupt data

- A wrong recovery URL could upsert demo users and project records into another database; E1 makes
  the URL-to-target binding fail before any client is created.
- New code could become live before its schema exists; E4 and the workflow ordering prevent the
  deployment trigger after any failed or skipped migration.
- A modified migration could change production data unexpectedly; the wrapper's manifest and checksum
  checks run before Prisma. These checks bind the checked-out release files to their committed
  manifest; protected review of the workflow and migration files remains required for approval.

## 6. Security

The process environment is untrusted except for the code-owned target map and protected CI secret
bindings. Recovery validation enforces exact project, branch, host, and database identity before a
Prisma client is constructed. Production CI requires protected `main` execution and GitHub Environment
approval, uses least-privilege repository permissions, serializes production runs, and passes no
Vercel API token. The Deploy Hook URL is a protected secret and is never logged. Failure output and
redacted evidence contain fixed errors, identifiers, and status values only.

Threats covered: an operator typo or copied foreign URL is rejected by F1; a malicious pull request
cannot invoke the production workflow because it has no pull-request trigger or production secrets;
an arbitrary manual ref cannot invoke production because there is no dispatch trigger; a modified
migration must still pass protected review and the checked-in manifest/checksum checks; and an auto-
deploy race is removed by the owner-side Vercel setting plus F2's post-migration trigger.

## 7. Open questions

None. The operator chose to keep AD-32 and restore protected CI; the approved recovery host must be
recorded in the target map from the existing owner-confirmed Neon configuration.

## 8. Decisions made here

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Bind recovery to `falling-rice-06970921 / w13-recovery-baseline / ep-purple-shape-aohygd1w.c-2.ap-southeast-1.aws.neon.tech / neondb` | Labels supplied beside a URL are not proof of Neon ownership; amends C~3 and rejects arbitrary non-production host acceptance | operator, 2026-11-12 |
| SD2 | Restore protected CI and invoke the Deploy Hook only after the migration wrapper succeeds | Preserves AD-32 and closes the Vercel race; rejected manual migration and unrestricted Git auto-deploy | operator, 2026-11-12 |
| SD3 | Remove the filename-only checker exemption and add an explicit production contract | A deleted filename must not reserve privileged behavior for future files; baseline and production checks remain both enforceable | Codex, 2026-11-12 |
| SD4 | Keep the pooled production host for runtime and add the confirmed non-pooled production host for migrations | Prisma migrations require the direct endpoint; Neon confirms `ep-summer-heart-b3767eul.c-4.ap-southeast-1.aws.neon.tech`; using the pooled host for `DIRECT_DATABASE_URL` is rejected | operator, 2026-11-12 |

## 9. Review record

Lenses: Implementer, Tester/QA, Attacker, Maintainer | Rounds: 1 | Resolved: exact recovery tuple, explicit production checker contract, push-only `main` workflow, wrapper command, and Vercel auto-deploy evidence gate. Rejected findings: none.
