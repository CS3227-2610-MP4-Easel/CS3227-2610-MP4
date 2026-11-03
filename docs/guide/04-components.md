# 4. Components

## Frontend (`src/fe`)

The W10 prototype remains the frontend handoff:

- `app/[[...slug]]/page.tsx`: one catch-all route. `lib/screens.ts` maps each URL to a screen per role.
- `app/api/as`: sets the role cookie.
- `components/canvas/`: the page layouts, one per screen and role.
- `components/live/`: the parts that read and write through the data layer (board, backlog, sprints, members, checkpoints, health, standups, usage, task drawer).
- `lib/api/`: types, fixtures, store and the endpoint-named functions (see section 3).

## Contracts (`src/be/contracts`)

- **Purpose:** single source for Zod request/response schemas, stable errors, pagination, OpenAPI schemas, route definitions, and the 57-operation policy map.
- **API:** exports the frozen interfaces, schemas, `ROUTES` types, authorization predicates, and OpenAPI helpers from [`src/be/contracts/src/index.ts`](../../src/be/contracts/src/index.ts).
- **Invariants:** every route has a stable operation ID and policy entry; request validation rejects unknown or malformed input; the policy map is the authorization source of truth.

## Database (`src/be/db`)

- **Purpose:** owns the Prisma schema/migrations and the request-facing filtered client.
- **API:** [`createDbClient`](../../src/be/db/src/client.ts), transaction helpers, visibility policy, and maintenance boundaries.
- **Invariants:** soft-deleted and archived data is hidden by default; compound unique reads are normalized through visible reads; raw SQL and extension escape hatches are hidden; nested writes and relation filters still require explicit caller authorization.

## API (`src/be/api`)

- **Purpose:** owns the Hono boundary, request IDs, error mapping, route registration, and authorization seam.
- **API:** [`createApiApp`](../../src/be/api/src/app.ts), [`registerRoute`](../../src/be/api/src/routes/register.ts), the shared [`ROUTES`](../../src/be/api/src/routes/index.ts), and `createPredicateEvaluator`.
- **Invariants:** routes are registered through the policy gate; handlers do not check roles; resource resolvers belong to table-owning modules and must fail closed for hidden or missing resources.
- **Deviations:** authorization precedes input parsing (D2), and registration is app/dependency-aware (D3).

## LLM gateway package (`src/be/llm-gateway`)

The package boundary is established for the frozen-first `LlmGateway.run` seam; runtime guards, metering, and SoCLaaS integration remain downstream work.
