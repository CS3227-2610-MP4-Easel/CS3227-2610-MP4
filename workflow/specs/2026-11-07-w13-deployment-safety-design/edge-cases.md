# Edge cases

| ID | Requirement | Scenario | Expected behavior (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1, N2 | Owner records the wrong project, SHA, deployment ID, alias, or non-READY state | Manual evidence is rejected and T4 remains incomplete | Prevents checking a different or stale deployment | manual |
| E2 | F1, N2 | Deployment creation time is earlier than, equal to, missing, or unparseable against the authoritative push timestamp | T4 remains incomplete; creation must be strictly after the push timestamp | Prevents stale deployment approval | manual |
| E3 | F1, N1 | Owner cannot inspect deployment metadata or alias ownership | T4 remains incomplete and no production gate opens | Prevents unverifiable evidence | manual |
| E4 | F1, N1 | Recorded evidence contains a response body, token, credential URL, or secret | Evidence is rejected and replaced with allowlisted status-only fields; inspecting a response body transiently is allowed | Prevents manual evidence leakage | manual |
| E5 | F2, N2 | `APP_TIER=dev` with a production database hostname | Seed rejects before Prisma construction | Prevents production writes under a dev label | unit |
| E6 | F2, N2 | Database URL is malformed or missing | Seed rejects before Prisma construction | Prevents undefined target behavior | unit |
| E7 | F2 | Local/test uses its allowed target | Seed proceeds to the supplied client or constructed client | Preserves supported non-production use | unit |
| E8 | F3, N2 | Manifest checksum differs from migration SQL | Migration runner does not invoke Prisma | Prevents unreviewed schema mutation | unit |
| E9 | F3 | Manifest has a missing, duplicate, or extra migration entry | Migration runner fails closed before Prisma | Prevents incomplete evidence | unit |
| E10 | F4 | Production startup provides `VERCEL_ENV=production` | Resource validation passes | Makes production deployable | unit |
| E11 | F4 | Production startup provides `VERCEL_ENV=preview` | Resource validation rejects `VERCEL_ENV` | Prevents cross-tier startup | unit |
| E12 | N1 | Any failure contains a secret URL or token | Error contains only a setting or fixed reason | Prevents credential disclosure | unit |
| E13 | F1, N4 | Alias ownership changes after smoke requests complete | Owner rechecks the alias; evidence is invalid unless the same deployment still owns it | Prevents binding smoke results to another deployment | manual |
| E14 | F5 | Pull-request workflow or application runtime attempts to access `VERCEL_TOKEN` | No token is present because T4 is owner-operated | Preserves the trust boundary | workflow |
| E15 | F2, N2 | Caller changes `NEON_HOST` and `NEON_PROJECT` to production alongside a production URL while keeping `APP_TIER=dev` | Seed rejects against the code-owned dev target map | Prevents tautological target checks | unit |
| E16 | F2, N2 | Supplied fake client is passed with a mismatched target | Seed rejects and fake client receives zero calls | Prevents test seam bypass | unit |
| E17 | F3, F6, N2 | Direct migration URL points to development or is inherited by the child process | Runner rejects before Prisma, and child env excludes `DIRECT_DATABASE_URL` | Prevents wrong-tier migration and secret leakage | unit |
| E18 | F3, N2 | Manifest has a missing, duplicate, unsorted, malformed, or extra entry | Runner rejects before either Prisma command | Keeps all migrations bound to reviewed bytes | unit |
| E19 | F4 | Production has missing fields or `VERCEL_ENV=preview` | Startup rejects the first missing/mismatched resource setting | Prevents partial validation bypass | unit |
| E20 | F4 | Complete production identity uses `VERCEL_ENV=production` and `VERCEL_GIT_COMMIT_REF=main` | Startup accepts the resource set | Makes production deployable | unit |
| E21 | F1, F5 | Fixed smoke request is made against an alias other than the inspected `development` deployment | T4 remains incomplete and evidence is rejected | Binds smoke results to deployment identity | manual |
| E22 | F1, F5 | Health, auth, or tier smoke result is missing, unexpected, or unavailable | T4 remains incomplete | Makes manual smoke criteria deterministic | manual |
| E23 | F2, N2 | Each local/dev/test tier is substituted with another tier's host, project, or database path | Target validation rejects before client construction for every cross-tier substitution | Tests the complete target boundary rather than one production example | unit |
| E24 | F3, N2 | A migration file is omitted from the manifest or a manifest entry has no repository file | Runner rejects before Prisma validation or deployment | Prevents a partial manifest from authorizing schema changes | unit |
| E25 | N1 | A preflight or child-process failure includes a token, full URL, query string, or response body | Error and diagnostic output contain only fixed labels and non-secret identifiers | Keeps both normal and failure paths redacted | unit |
| E26 | F1, F5 | Another same-SHA deployment exists | Owner records the deployment ID and alias ownership from the inspected Vercel deployment; evidence from another deployment is invalid | Binds evidence to one deployment | manual |
| E27 | F5 | A repository change attempts to add a deployment token | Review rejects the change; T4 remains owner-operated and token-free | Prevents reintroducing the retired trust boundary | workflow |
| E28 | F2, F3 | `NEON_PROJECT` or database path is wrong while hostname matches | Target validation rejects before any client or Prisma command | Host alone does not prove project/database identity | unit |
| E29 | F3, F6 | Executor captures its arguments and environment | Exactly two calls are observable on success, in validate/deploy order, with the allowlisted environment and derived validated URL | Makes subprocess safety testable | unit |
| E30 | F1, N4 | Owner records a deployment with the wrong SHA, project, alias, or non-READY state | T4 remains incomplete and production deployment is blocked | Prevents manual evidence from becoming a bypass | manual |
| E31 | F1, F5 | Owner omits health, auth, or tier smoke evidence | T4 remains incomplete and no production gate is opened | Keeps manual evidence complete | manual |
| E32 | F5, N1 | Manual evidence contains a token, credential URL, response body, or secret value | Evidence is rejected and must be replaced with redacted fields | Prevents owner evidence from leaking credentials | manual |
| E33 | F1, N4 | Owner follows a redirect from the inspected alias | The request fails on the `3xx`; no redirected origin may satisfy T4 | Binds checks to the inspected deployment | manual |
| E34 | F1, N4 | Owner uses a deployment, project, alias, or push timestamp taken from the inspected deployment instead of the code/GitHub sources | T4 remains incomplete until the code-owned manifest and GitHub merge commit are used | Prevents self-authored comparison baselines | manual |
| E35 | F1 | The retired standup/AI probe is unavailable because W9 is not deployed | No effect on T4; the probe is tracked separately by W9 | Keeps deployment safety independent of feature-slice readiness | manual |
| E45 | F4 | Production migration/deployment automation is retired by SD7 | Owner follows the manual production handover; no repository workflow or Deploy Hook is invoked | Keeps deployment scope explicit | manual |

## What could corrupt data

- A forged or stale Vercel deployment could expose the wrong application build; F1 requires exact API-returned identity and readiness.
- A development-labeled seed pointed at production could write demo rows into production; F2 requires target validation before Prisma construction.
- A changed migration could alter production schema without review; F3 requires the committed checksum before Prisma runs.
