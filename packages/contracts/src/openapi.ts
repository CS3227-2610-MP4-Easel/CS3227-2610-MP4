export type OpenApiRouteRecord = { operationId: string; method: string; path: string; responseSchema: unknown; policyKey: string };

export function generateOpenApiDocument(routes: OpenApiRouteRecord[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const path = paths[route.path] ?? {};
    path[route.method.toLowerCase()] = { operationId: route.operationId, responses: { default: { description: "Contract response" } }, "x-policy-key": route.policyKey };
    paths[route.path] = path;
  }
  return {
    openapi: "3.1.0",
    info: { title: "Agile Platform API", version: "0.1.0" },
    paths,
  };
}
