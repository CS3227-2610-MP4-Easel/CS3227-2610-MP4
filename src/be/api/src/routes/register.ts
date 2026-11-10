import type { Hono } from "hono";
import type { z } from "zod/v3";
import { policyForRoute, validateRouteRegistration, type ApiContext, type RouteDefinition } from "@agile/contracts";
import { HttpError, parseInput, parseJsonBody } from "../errors.js";
import { authorizeAdder, authorizeRequest, type AuthDependencies } from "../middleware/auth.js";

export type ApiEnv = { Variables: { requestId: string } };

const registered = new WeakMap<object, RouteDefinition[]>();
const isSchema = (value: unknown): value is z.ZodTypeAny => Boolean(value) && typeof (value as { safeParse?: unknown }).safeParse === "function";
const EDIT_BODY_KEYS = new Set(["endpoint-38", "endpoint-39", "endpoint-58", "endpoint-59", "endpoint-61"]);
const honoPath = (path: string) => path.replace(/\{(\w+)\}/g, ":$1");

/** Routes registered on `app` through `registerRoute`; `apiApp` must contain nothing else. */
export function registeredRoutes(app: Hono<ApiEnv>): readonly RouteDefinition[] { return registered.get(app) ?? []; }

/** Every route goes through the policy map: authorize, parse, run the handler, then commit or roll back
 * the authorization transaction. Throws at registration for a missing/duplicate/mismatched policy,
 * or for a non-public route when `deps` are not supplied. */
export function registerRoute(app: Hono<ApiEnv>, route: RouteDefinition, deps?: AuthDependencies): void {
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
      const parseBody = async () => {
        try { return await parseJsonBody(c.req.raw); } catch (error) {
          if (EDIT_BODY_KEYS.has(route.policyKey) && (c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json") && error instanceof HttpError && error.code === "BAD_REQUEST") throw new HttpError("VALIDATION_FAILED", 422, "The request body is not valid.");
          throw error;
        }
      };
      const input = {
        params: isSchema(route.paramsSchema) ? parseInput(route.paramsSchema, request.params) : request.params,
        query: isSchema(route.querySchema) ? parseInput(route.querySchema, Object.fromEntries(url.searchParams)) : Object.fromEntries(url.searchParams),
        body: isSchema(route.bodySchema) ? parseInput(route.bodySchema, await parseBody()) : undefined,
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
