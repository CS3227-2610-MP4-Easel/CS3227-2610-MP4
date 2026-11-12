import type { Hono } from "hono";
import type { z } from "zod/v3";
import { policyForRoute, validateRouteRegistration, type ApiContext, type RouteDefinition } from "@agile/contracts";
import { readLimitedBody } from "../body-limit.js";
import { HttpError, parseInput, parseJsonBody } from "../errors.js";
import { authorizeAdder, authorizeRequest, type AuthDependencies } from "../middleware/auth.js";

export type ApiEnv = { Variables: { requestId: string } };
export const STRICT_BODY_PARSER = Symbol("strictBodyParser");
type RegisteredRoute = RouteDefinition & { [STRICT_BODY_PARSER]?: true };

const registered = new WeakMap<object, RouteDefinition[]>();
const isSchema = (value: unknown): value is z.ZodTypeAny => Boolean(value) && typeof (value as { safeParse?: unknown }).safeParse === "function";
const honoPath = (path: string) => path.replace(/\{(\w+)\}/g, ":$1");

/** Body read with a byte cap (413), then the same content-type and JSON rules as `parseJsonBody`. */
async function parseLimitedJson(request: Request, maxBytes: number, options: { strict?: boolean } = {}): Promise<unknown> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new HttpError("BAD_REQUEST", options.strict ? 415 : 400, "Request content type must be application/json.");
  const read = await readLimitedBody(request, maxBytes);
  if (read.tooLarge) throw new HttpError("PAYLOAD_TOO_LARGE", 413, "The request body is too large.");
  try { return JSON.parse(read.text); } catch { throw new HttpError("BAD_REQUEST", options.strict ? 422 : 400, "Request body is not valid JSON."); }
}

/** Routes registered on `app` through `registerRoute`; `apiApp` must contain nothing else. */
export function registeredRoutes(app: Hono<ApiEnv>): readonly RouteDefinition[] { return registered.get(app) ?? []; }

/** Every route goes through the policy map: authorize, parse, run the handler, then commit or roll back
 * the authorization transaction. Throws at registration for a missing/duplicate/mismatched policy,
 * or for a non-public route when `deps` are not supplied. */
export function registerRoute(app: Hono<ApiEnv>, route: RegisteredRoute, deps?: AuthDependencies): void {
  const existing = registered.get(app) ?? [];
  validateRouteRegistration([...existing, route]);
  const policy = policyForRoute(route.policyKey);
  if (policy.authState !== "PUBLIC" && !deps) throw new Error(`authorization dependencies are required for ${route.operationId}`);
  registered.set(app, [...existing, route]);

  app.on(route.method, honoPath(route.path), async (c) => {
    const url = new URL(c.req.url);
    const request = { method: route.method, path: url.pathname, params: c.req.param() as Record<string, string>, query: url.searchParams, body: undefined as unknown };
    // A route's before-hook (rate limits, body size) runs ahead of authorization; a returned response ends the request.
    if (route.before) {
      const early = await route.before({ requestId: c.get("requestId"), request: c.req.raw });
      if (early) {
        const headers = new Headers(early.headers);
        headers.set("X-Request-Id", c.get("requestId"));
        return new Response(early.body, { status: early.status, headers });
      }
    }
    // Authorization runs before input parsing, so a malformed protected request without a valid token is a 401, not a 422.
    const scope = await authorizeRequest(policy, deps as AuthDependencies, c.req.header("authorization"), request, policy.predicate === "ADDER");
    let settled = false;
    try {
      const input = {
        params: isSchema(route.paramsSchema) ? parseInput(route.paramsSchema, request.params) : request.params,
        query: isSchema(route.querySchema) ? parseInput(route.querySchema, Object.fromEntries(url.searchParams)) : Object.fromEntries(url.searchParams),
        body: isSchema(route.bodySchema) ? parseInput(route.bodySchema, route.bodyLimitBytes === undefined ? await parseJsonBody(c.req.raw, { strict: route[STRICT_BODY_PARSER] === true }) : await parseLimitedJson(c.req.raw, route.bodyLimitBytes, { strict: route[STRICT_BODY_PARSER] === true })) : undefined,
      };
      if (policy.predicate === "ADDER" && scope.principal && "userId" in scope.principal) {
        request.body = input.body;
        await authorizeAdder(deps as AuthDependencies, policy, scope.principal, request, scope.tx);
      }
      const principal = scope.principal && "userId" in scope.principal ? scope.principal : undefined;
      // TOKEN routes have a verified token but possibly no users row, so they get the identity instead of a principal.
      const email = scope.principal && !("userId" in scope.principal) ? scope.principal.tokenClaims.email : undefined;
      const identity = scope.principal && typeof email === "string" ? { firebaseUid: scope.principal.firebaseUid, email } : undefined;
      const context: ApiContext = { requestId: c.get("requestId"), request: { ...request, body: input.body }, input, ...(principal ? { principal } : {}), ...(identity ? { identity } : {}) };
      const response = await route.handler(context);
      if (scope.tx) {
        settled = true;
        await (response.status >= 400 ? scope.tx.rollback() : scope.tx.commit());
      }
      return response;
    } catch (error) {
      if (scope.tx && !settled) await scope.tx.rollback();
      throw error;
    }
  });
}
