import { getPolicyMap, type PolicyEntry } from "./policy.js";
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type RouteDefinition = {
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
export type ApiContext = { requestId: string; request: { method: string; path: string; params: Record<string, string>; query: URLSearchParams; body: unknown }; principal?: { firebaseUid: string; userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" } };

export function validateRouteRegistration(routes: RouteDefinition[]): void {
  const policies = getPolicyMap();
  const policyByKey = new Map(policies.map((policy) => [policy.policyKey, policy]));
  const operationIds = new Set<string>();
  const methodPaths = new Set<string>();
  for (const route of routes) {
    if (operationIds.has(route.operationId)) throw new Error("duplicate operation id");
    operationIds.add(route.operationId);
    const methodPath = `${route.method} ${route.path}`;
    if (methodPaths.has(methodPath)) throw new Error("duplicate method/path");
    methodPaths.add(methodPath);
    const policy = policyByKey.get(route.policyKey);
    if (!policy) throw new Error("missing policy");
    if (policy.operationId !== route.operationId || policy.method !== route.method || policy.path !== route.path) throw new Error("metadata mismatch");
  }
}

export function policyForRoute(policyKey: string): PolicyEntry {
  const policy = getPolicyMap().find((entry) => entry.policyKey === policyKey);
  if (!policy) throw new Error("missing policy");
  return policy;
}
