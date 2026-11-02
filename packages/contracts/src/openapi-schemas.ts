import { getPolicyMap } from "./policy.js";

export type OpenApiSchema = Record<string, unknown>;
export type OpenApiSchemaRegistry = Readonly<Record<string, OpenApiSchema>>;

export const ProjectDetailJsonSchema: OpenApiSchema = {
  type: "object",
  required: ["id", "name", "brief", "status", "createdBy", "createdAt", "updatedAt", "version", "progress"],
  properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, brief: { type: ["string", "null"] }, status: { type: "string" }, createdBy: { type: "string", format: "uuid" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, version: { type: "integer", minimum: 1 }, progress: { type: "object" } },
};
export const PageProjectDetailSchema: OpenApiSchema = { type: "object", required: ["items", "page", "size", "total"], properties: { items: { type: "array", items: { $ref: "#/components/schemas/ProjectDetail" } }, page: { type: "integer" }, size: { type: "integer" }, total: { type: "integer" } } };
export const FactsJsonSchema: OpenApiSchema = { type: "object", required: ["asOf", "pointsTotal", "pointsDone", "pointsRemaining", "unestimatedTasks", "velocity", "avgVelocity", "projectedCompletionDate", "checkpoints", "overload"], properties: { asOf: { type: "string", format: "date-time" }, pointsTotal: { type: "number" }, pointsDone: { type: "number" }, pointsRemaining: { type: "number" }, unestimatedTasks: { type: "integer" }, velocity: { type: "array" }, avgVelocity: { type: ["number", "null"] }, projectedCompletionDate: { type: ["string", "null"], format: "date" }, checkpoints: { type: "array" }, overload: { type: "array" } } };

const genericResponse: OpenApiSchema = { type: "object", additionalProperties: true };
const genericRequest: OpenApiSchema = { type: "object", additionalProperties: true };

export function createOpenApiSchemaRegistry(entries: Iterable<readonly [string, OpenApiSchema]>): OpenApiSchemaRegistry {
  const registry: Record<string, OpenApiSchema> = {};
  for (const [name, schema] of entries) {
    const existing = registry[name];
    if (existing && JSON.stringify(existing) !== JSON.stringify(schema)) throw new Error(`OPENAPI_SCHEMA_CONFLICT: ${name}`);
    registry[name] = schema;
  }
  return Object.freeze({ ...registry });
}

const entries: Array<readonly [string, OpenApiSchema]> = [
  ["ProjectDetail", ProjectDetailJsonSchema],
  ["PageProjectDetail", PageProjectDetailSchema],
  ["Facts", FactsJsonSchema],
  ["PROJECT_FACTS_READResponse", FactsJsonSchema],
];
for (const policy of getPolicyMap()) {
  const responseName = `${policy.operationId}Response`;
  const response = responseName === "PROJECT_LISTResponse" ? PageProjectDetailSchema : responseName === "PROJECT_READResponse" ? ProjectDetailJsonSchema : responseName === "PROJECT_FACTS_READResponse" ? FactsJsonSchema : genericResponse;
  entries.push([responseName, response]);
  if (policy.requestSchema) entries.push([`${policy.operationId}Request`, genericRequest]);
}

export const OPENAPI_SCHEMA_REGISTRY = createOpenApiSchemaRegistry(entries);
