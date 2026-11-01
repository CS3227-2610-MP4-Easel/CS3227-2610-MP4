# W1 Conventions

- Workspace package names are `@agile-platform/contracts`, `@agile-platform/db`, `@agile-platform/api`, and `@agile-platform/llm-gateway`; application code lives under `apps/web`.
- `packages/contracts` contains schemas and pure types only; it has no Prisma import, database access, network call, or side effect.
- `packages/db` is the only package that imports Prisma; `apps/web` never imports `packages/db` or Prisma.
- `packages/api` depends on contracts and exported domain seams; it exports the Hono app. `apps/web/app/api/[[...route]]/route.ts` owns the Next.js adapter/mount. Route handlers do not import another module's tables or perform role checks.
- Route operation identifiers are stable uppercase names tied to endpoint numbers, for example `HEALTH_READ` and `PM_PROJECT_CREATE`; the policy map is the only source for allowed roles, authentication state, rate limits, and ownership predicates.
- Error codes are uppercase string literals. `details` is an array of `{ field, message }`; unexpected errors expose only the request id.
- Request ids are UUIDs generated at the API boundary for every request; client-supplied `X-Request-Id` values are ignored or overwritten.
- All external input is parsed by a strict Zod schema before handler logic, including body, path, and query values. Server-managed fields are absent from client input schemas and are rejected if submitted.
- The API boundary runs token verification, registered-user lookup, policy evaluation, ownership evaluation, then the handler; denied requests never invoke a handler.
- Ordinary Prisma reads, relation reads, counts, aggregates, and group-bys apply the soft-delete and archived-project filters. Request-facing code cannot use raw SQL or the maintenance-read capability.
- Tests use an in-process mock gateway and a disposable test database or deterministic database fixture; CI does not call SoCLaaS.
- `.env` files and generated Prisma artifacts are ignored; no credentials, tokens, registration codes, prompts, or model responses are committed. Secret scanning and process-security enforcement belong to W12.

