# Applied conventions

- Vercel project identity means the immutable canonical `prj_...` system project ID, not the display slug; the verifier does not accept a caller-supplied manifest for project or alias identity.
- Deployment identity is accepted only from owner-inspected Vercel metadata; GitHub event fields provide only the expected commit and push timestamp. No repository workflow or application runtime receives a Vercel deployment token.
- Database target validation uses `new URL(...).hostname` and database name against the committed tier target map; credentials, query strings, and full URLs never appear in errors. `NEON_HOST` and `NEON_PROJECT` are observations that must match the code-owned map, not the allowlist source.
- Migration manifests are repository-relative, one line per migration, with `<path> <lowercase sha256>`, raw file-byte hashing, no blank/comment/duplicate/extra entries, and sorted migration paths.
- The tier manifest has separate application `env` and Vercel `vercelEnv` fields: production uses `production`; development uses `preview`.
- The migration child environment is an explicit allowlist and excludes `DIRECT_DATABASE_URL` and unrelated secrets.

## Canonical target map

| Application tier | `env` | `vercelEnv` | Branch | `NEON_HOST` | `NEON_PROJECT` | Database name / URL path |
|---|---|---|---|---|---|---|
| local | `local` | `local` | `local` | `localhost` | `local` | `/agile_platform` |
| development | `dev` | `preview` | `development` | `dev.neon.tech` | `agile-platform-dev` | `/agile_platform` |
| preview | `preview` | `preview` | any non-protected source ref | none | none | none |
| production | `prod` | `production` | `main` | `prod.neon.tech` | `agile-platform-prod` | `/agile_platform` |
| test | `test` | `test` | `test` | `localhost` | `test` | `/agile_platform` |

The code-owned map is the only allowlist. `NEON_HOST` and `NEON_PROJECT` supplied at runtime must equal the row selected by `APP_TIER`; they cannot redefine it. It is stored in `workflow/deployment/tier-manifest.json`; `env` remains the application tier, `vercelEnv` is mandatory for Vercel comparison, and `databaseName` is mandatory for database URL comparison. Auth, seed, migration, and workflow validation use one validated loader.
