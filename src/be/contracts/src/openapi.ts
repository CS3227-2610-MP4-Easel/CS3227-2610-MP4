import { OPENAPI_SCHEMA_REGISTRY, type OpenApiSchema, type OpenApiSchemaRegistry } from "./openapi-schemas.js";

export type OpenApiRouteRecord = { operationId: string; method: string; path: string; requestSchema?: unknown; responseSchema: Record<string, unknown>; policyKey: string; successStatus?: 200 | 201 | 204 };

function requireSchema(schema: Record<string, unknown>, label: string): Record<string, unknown> {
  if (Object.keys(schema).length === 0) throw new Error(`${label} schema is required`);
  return schema;
}

function walkRefs(value: unknown, registry: OpenApiSchemaRegistry): void {
  if (Array.isArray(value)) { for (const item of value) walkRefs(item, registry); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.$ref === "string") {
    const prefix = "#/components/schemas/";
    if (!record.$ref.startsWith(prefix) || !registry[record.$ref.slice(prefix.length)]) throw new Error(`OPENAPI_UNRESOLVED_REF: ${record.$ref}`);
  }
  for (const child of Object.values(record)) walkRefs(child, registry);
}

export function generateOpenApiDocument(routes: OpenApiRouteRecord[], schemas: OpenApiSchemaRegistry = OPENAPI_SCHEMA_REGISTRY) {
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
    const parameters = [...route.path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({ name, in: "path", required: true, schema: name === "index" ? { type: "integer", minimum: 0 } : { type: "string", format: "uuid" } }));
    if (parameters.length) operation.parameters = parameters;
    if (route.requestSchema !== undefined) operation.requestBody = { required: true, content: { "application/json": { schema: requireSchema(route.requestSchema as Record<string, unknown>, "request") } } };
    path[route.method.toLowerCase()] = operation;
    paths[route.path] = path;
  }
  const components = { schemas: Object.fromEntries(Object.entries(schemas)) };
  walkRefs(paths, schemas);
  walkRefs(components, schemas);
  return {
    openapi: "3.1.0",
    info: { title: "Agile Platform API", version: "0.1.0" },
    paths,
    components,
  };
}
