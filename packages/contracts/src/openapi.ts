export type OpenApiRouteRecord = { operationId: string; method: string; path: string; requestSchema?: unknown; responseSchema: Record<string, unknown>; policyKey: string; successStatus?: 200 | 201 | 204 };

function requireSchema(schema: Record<string, unknown>, label: string): Record<string, unknown> {
  if (Object.keys(schema).length === 0) throw new Error(`${label} schema is required`);
  return schema;
}

export function generateOpenApiDocument(routes: OpenApiRouteRecord[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const path = paths[route.path] ?? {};
    const responseSchema = requireSchema(route.responseSchema, "response");
    const successStatus = String(route.successStatus ?? 200);
    const response: Record<string, unknown> = { description: "Contract response" };
    if (successStatus !== "204") response.content = { "application/json": { schema: responseSchema } };
    const operation: Record<string, unknown> = {
      operationId: route.operationId,
      responses: { [successStatus]: response },
      "x-policy-key": route.policyKey,
    };
    if (route.requestSchema !== undefined) operation.requestBody = { required: true, content: { "application/json": { schema: requireSchema(route.requestSchema as Record<string, unknown>, "request") } } };
    path[route.method.toLowerCase()] = operation;
    paths[route.path] = path;
  }
  return {
    openapi: "3.1.0",
    info: { title: "Agile Platform API", version: "0.1.0" },
    paths,
  };
}
