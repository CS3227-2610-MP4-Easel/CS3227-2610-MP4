# 3. Architecture

The source-root split is `src/fe` for the Next.js frontend and `src/be/*` for backend packages. The web app lives at `src/fe`, not `apps/web` (C8/C24).

```mermaid
flowchart LR
  subgraph Browser
    S["components/canvas and components/live"]
    A["lib/api"]
    N["Next /api adapter"]
  end
  S --> A --> N
  N --> H["Hono API"]
  H --> P["policy map + authorization"]
  H --> C["src/be/contracts"]
  H --> D["src/be/db filtered client"]
```

1. A screen calls a function in `lib/api`, for example `listTasks`. The W10 prototype currently uses its fixture/store data layer.
2. Live requests enter through the minimal Next catch-all adapter and are forwarded to the Hono API.
3. The API registers route definitions through the shared `ROUTES` list, authorizes through the policy map, validates input with contracts, and uses the filtered Prisma client for database access.
4. Downstream workstreams provide principal lookup, resource resolvers, domain routes, and the remaining live frontend API functions.

## Sign-in and registration

A request carries a Firebase ID token. `src/be/auth` verifies it, then looks up the caller in `users` for the application role. Registration (endpoints 2 and 3) is gated by a per-role registration code and a per-IP limit; the app refuses to start with unsafe auth settings.

## AI call path

```mermaid
sequenceDiagram
  participant F as Feature endpoint
  participant C as ai-context
  participant G as LlmGateway.run
  participant P as Provider (mock or SoCLaaS)
  participant DB as llm_calls
  F->>C: assembleWith(caller, feature, project)
  C-->>F: sections (membership checked twice)
  F->>G: run(call)
  G->>G: admission: role, session, AI_ENABLED, budget, windows, breaker
  G->>G: input guard, boundary, fit to token budget
  G->>DB: row IN_FLIGHT (lease, cost reservation)
  G->>P: request (one retry, 25 s deadline)
  P-->>G: response
  G->>G: output guard, schema check
  G->>DB: finalise row once
  G-->>F: answer or typed error
```

Endpoints never call the provider or build their own context; they go through `assembleWith` and `run`. The mock is the default for tests, previews and CI; CI never calls the live service. Details: [4 Components](04-components.md).

**Rules:** `src/fe` never imports Prisma or `@agile/db`; screens import only from `lib/api`; route handlers do not check roles; and every route is represented in the contracts policy map (AD-01b, AD-55).

| Decision | Why | Ref |
|---|---|---|
| The page layouts reuse the canvas CSS and markup instead of Tailwind and shadcn | Matches the confirmed design exactly; rewriting every page by hand cost more for the same look | D1 |
| Source lives under `src/` | Course requirement | C8 |
| Contracts and policy are centralized in `src/be/contracts` | Prevents endpoint/schema/policy drift | C20 |
| Backend packages live under `src/be/*`; the old frontend scaffold is removed | Preserves the approved source-root and ownership split | C22, C23, C24 |
| The health adapter is the narrow frontend/backend exception | Makes `/api/health` reachable without taking ownership of the frontend implementation | C26 |
| Tokens are verified with `firebase-admin`; the role comes from our database | Vendor key rotation; roles are not claims | C50 |
| `requireMember` lives in `core` (W5), not `auth` | `core` owns `project_members` | C48 |
| Feature modules are workspace packages (`src/be/auth`, `src/be/ai-context`) | `src/be/api` may not import `@agile/db` | C51 |
| W2 builds the whole `run` path with a guard slot; feature owners register mock responses | W3 to W9 need a working gateway and mock | C27 |
| Untrusted sections are wrapped after fitting, with the security suffix in the user message | Truncate before wrapping; flagged input is marked, not blocked | C56 |
| `ai-context` is a source registry with membership through the frozen `Core` | Table ownership stays with the owning modules | C61 |

The implementation differs from the original W1 design in two documented seams: authorization runs before input parsing (D2), and route registration takes the app and dependencies while using the shared registry (D3). The minimal Next adapter is the approved frontend boundary exception (D4).
