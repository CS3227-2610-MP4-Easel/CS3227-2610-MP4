export type OpenApiRouteRecord = { operationId: string; method: string; path: string; responseSchema: unknown; policyKey: string };

export function generateOpenApiDocument(routes: OpenApiRouteRecord[]) {
  return {
    openapi: "3.1.0",
    info: { title: "Agile Platform API", version: "0.1.0" },
    paths: Object.fromEntries(routes.map((route) => [route.path, { [route.method.toLowerCase()]: { operationId: route.operationId, responses: { default: { description: "Contract response" } }, "x-policy-key": route.policyKey } }])),
  };
}
