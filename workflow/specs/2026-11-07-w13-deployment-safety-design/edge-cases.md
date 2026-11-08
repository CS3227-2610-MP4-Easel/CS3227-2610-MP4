# Edge cases

| ID | Requirement | Scenario | Expected behavior (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1, N2 | Vercel metadata has the wrong project ID | Deployment check fails before success output | Prevents checking a different project | unit |
| E2 | F1, N2 | Vercel metadata commit differs from `GITHUB_SHA` | Deployment check fails with a commit mismatch | Prevents stale deployment approval | unit |
| E3 | F1, N2 | Vercel deployment state is not `READY` | Deployment check fails | Prevents failed/building deployment approval | unit |
| E4 | F1, N1 | Vercel API returns no exact commit or more than one candidate | Workflow fails without printing response body or token | Prevents ambiguous evidence | service |
| E5 | F2, N2 | `APP_TIER=dev` with a production database hostname | Seed rejects before Prisma construction | Prevents production writes under a dev label | unit |
| E6 | F2, N2 | Database URL is malformed or missing | Seed rejects before Prisma construction | Prevents undefined target behavior | unit |
| E7 | F2 | Local/test uses its allowed target | Seed proceeds to the supplied client or constructed client | Preserves supported non-production use | unit |
| E8 | F3, N2 | Manifest checksum differs from migration SQL | Migration runner does not invoke Prisma | Prevents unreviewed schema mutation | unit |
| E9 | F3 | Manifest has a missing, duplicate, or extra migration entry | Migration runner fails closed before Prisma | Prevents incomplete evidence | unit |
| E10 | F4 | Production startup provides `VERCEL_ENV=production` | Resource validation passes | Makes production deployable | unit |
| E11 | F4 | Production startup provides `VERCEL_ENV=preview` | Resource validation rejects `VERCEL_ENV` | Prevents cross-tier startup | unit |
| E12 | N1 | Any failure contains a secret URL or token | Error contains only a setting or fixed reason | Prevents credential disclosure | unit |
| E13 | F1, N4 | Two READY deployments have the same SHA, but only an older one owns `development` | The lookup fails unless the alias belongs to the selected deployment created after the push | Prevents stale same-SHA approval | service |
| E14 | F5 | Pull-request workflow or application runtime attempts to access `VERCEL_TOKEN` | No token is present | Preserves the trust boundary | workflow |
| E15 | F2, N2 | Caller changes `NEON_HOST` and `NEON_PROJECT` to production alongside a production URL while keeping `APP_TIER=dev` | Seed rejects against the code-owned dev target map | Prevents tautological target checks | unit |
| E16 | F2, N2 | Supplied fake client is passed with a mismatched target | Seed rejects and fake client receives zero calls | Prevents test seam bypass | unit |
| E17 | F3, F6, N2 | Direct migration URL points to development or is inherited by the child process | Runner rejects before Prisma, and child env excludes `DIRECT_DATABASE_URL` | Prevents wrong-tier migration and secret leakage | unit |
| E18 | F3, N2 | Manifest has a missing, duplicate, unsorted, malformed, or extra entry | Runner rejects before either Prisma command | Keeps all migrations bound to reviewed bytes | unit |
| E19 | F4 | Production has missing fields or `VERCEL_ENV=preview` | Startup rejects the first missing/mismatched resource setting | Prevents partial validation bypass | unit |
| E20 | F4 | Complete production identity uses `VERCEL_ENV=production` and `VERCEL_GIT_COMMIT_REF=main` | Startup accepts the resource set | Makes production deployable | unit |
| E21 | F1, F5 | No Vercel deployment is ready when the lookup begins, then the current push becomes `READY` | The workflow polls and accepts only the exact deployment selected by the current commit's check | Handles normal provider build delay without selecting an unrelated deployment | service |
| E22 | F1, F5 | The current Vercel check remains missing, truncated, or ambiguous until timeout | The workflow exits nonzero and never invokes the checked-out verifier or smoke step | Prevents timeout fallback from becoming an approval | service |
| E23 | F2, N2 | Each local/dev/test tier is substituted with another tier's host, project, or database path | Target validation rejects before client construction for every cross-tier substitution | Tests the complete target boundary rather than one production example | unit |
| E24 | F3, N2 | A migration file is omitted from the manifest or a manifest entry has no repository file | Runner rejects before Prisma validation or deployment | Prevents a partial manifest from authorizing schema changes | unit |
| E25 | N1 | A preflight or child-process failure includes a token, full URL, query string, or response body | Error and diagnostic output contain only fixed labels and non-secret identifiers | Keeps both normal and failure paths redacted | unit |
| E26 | F1, F5 | Current GitHub Vercel check points to deployment UID A, while another same-SHA deployment B is newer | Only A is inspected; B cannot satisfy the check | Binds evidence to the current push's provider check | service |
| E27 | F5 | The checked-out repository modifies a verifier or script | Token-bearing lookup still runs before checkout and no token is present in later steps | Prevents repository code from exfiltrating the token | workflow |
| E28 | F2, F3 | `NEON_PROJECT` or database path is wrong while hostname matches | Target validation rejects before any client or Prisma command | Host alone does not prove project/database identity | unit |
| E29 | F3, F6 | Executor captures its arguments and environment | Exactly two calls are observable on success, in validate/deploy order, with the allowlisted environment and derived validated URL | Makes subprocess safety testable | unit |

## What could corrupt data

- A forged or stale Vercel deployment could expose the wrong application build; F1 requires exact API-returned identity and readiness.
- A development-labeled seed pointed at production could write demo rows into production; F2 requires target validation before Prisma construction.
- A changed migration could alter production schema without review; F3 requires the committed checksum before Prisma runs.
