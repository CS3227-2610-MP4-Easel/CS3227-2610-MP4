# W1 API and Frozen Interfaces

## Normative API source

`docs/architecture/contracts.md` §§1–5 is the single source of truth for endpoint methods, paths, request schemas, response schemas, common errors, policy rows, and the frozen-first interfaces. W1 does not duplicate the 57 endpoint definitions. The W1 contract test reads that document's endpoint table and compares it with the registered route metadata and generated OpenAPI document.

If this spec and `contracts.md` disagree, the branch stops and the discrepancy is resolved in the normative contract source before implementation continues.

## W1 route and Next.js mount

`packages/api` exports the Hono app. `apps/web/app/api/[[...route]]/route.ts` owns the Next.js adapter and `/api` mount. `GET /api/health` is the only W1 handler: it is public, performs no database query, and returns HTTP 200, `Content-Type: application/json`, a server-generated `X-Request-Id`, and `{ "status": "UP" }`.

## Canonical authorization seam

The canonical role enum is `PM | DEV_LEAD | DEVELOPER`; the aliases `LEAD → DEV_LEAD` and `DEV → DEVELOPER` are accepted only when translating architecture notation. The policy map in `contracts.md` is authoritative and contains exactly one entry per endpoint, including public, token-only, registered-user, role, membership, self, assignee, and adder requirements.

```ts
type AuthState = "PUBLIC" | "TOKEN" | "REGISTERED";
type Predicate = "NONE" | "MEMBER" | "SELF" | "ASSIGNEE" | "ADDER" | "MEMBER_OR_ASSIGNEE" | "MEMBER_PROJECTS";
type UserRole = "PM" | "DEV_LEAD" | "DEVELOPER";
type Principal = { firebaseUid: string; userId: string; role: UserRole };
type ApiRequest = { method: string; path: string; params: Record<string, string>; query: URLSearchParams; body: unknown };
type ApiContext = { requestId: string; request: ApiRequest; principal?: Principal };
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type AuthError = "UNAUTHENTICATED" | "USER_NOT_REGISTERED";
type PolicyError = "FORBIDDEN_ROLE" | "NOT_FOUND";
type AuthDependencies = {
  resolvePrincipal(authorization: string | undefined): Promise<{ firebaseUid: string; tokenClaims: Record<string, unknown> }>;
  lookupRegisteredUser(firebaseUid: string): Promise<Principal>;
  requireMember(userId: string, projectId: string): Promise<void>;
  evaluatePredicate(predicate: Predicate, principal: Principal, request: ApiRequest): Promise<void>;
};
type RouteDefinition = {
  operationId: string;
  method: HttpMethod;
  path: string;
  bodySchema?: unknown;
  paramsSchema?: unknown;
  querySchema?: unknown;
  responseSchema: unknown;
  policyKey: string;
  handler: (context: ApiContext) => Promise<Response>;
};
registerRoute(route: RouteDefinition): void;
```

`registerRoute` rejects a missing policy key, duplicate operation id, duplicate method/path pair, or route metadata that differs from the normative policy entry. The canonical middleware pipeline is: generate request id; match the route; for `PUBLIC`, parse route inputs; for `TOKEN` or `REGISTERED`, resolve the bearer token first; for `REGISTERED`, look up the local user; parse path/query/body with strict schemas; evaluate role; evaluate membership/ownership; invoke the handler; map errors. Therefore a malformed protected request without a valid token returns 401 before schema validation, while a malformed public request returns 400 or 422. Resolver failures map to 401 `UNAUTHENTICATED`, 403 `USER_NOT_REGISTERED`, 403 `FORBIDDEN_ROLE`, or 404 `NOT_FOUND` exactly as named by the error union.

Predicate semantics are fixed: `MEMBER` resolves the target project membership; `SELF` resolves the target resource owner against the principal; `ASSIGNEE` resolves the task assignee against the principal; `ADDER` checks the caller role against the target role rule in `contracts.md`; `MEMBER_OR_ASSIGNEE` means `DEV_LEAD → MEMBER` and `DEVELOPER → ASSIGNEE`; `MEMBER_PROJECTS` returns only projects where the principal is a member; `NONE` performs no resource lookup. A failed resource or membership lookup returns 404 without confirming existence.

## Parity and frozen-first verification

The parity fixture expands `contracts.md` §3 into 57 route records and compares method, path, operation id, request schema, response schema, policy key, auth state, role set, predicate, and endpoint-specific error mapping with the registered route table and generated OpenAPI document. It also asserts that each endpoint appears exactly once.

The frozen-first types and behavior are not restated here: `contracts.md` §5 is authoritative for `LlmGateway.run`, `AiContext.assemble`, `Sessions`, and `Core`, including result unions, Zod output schemas, `NotMember`, session caps/abandonment, transaction prohibition for gateway calls, opaque transaction handling, strict apply validation, project-id ignoring, membership/writability re-checks, and task-event writes. W1 provides compile-time consumer fixtures and runtime contract tests against that source. W2, W5, and W6 provide implementations.

