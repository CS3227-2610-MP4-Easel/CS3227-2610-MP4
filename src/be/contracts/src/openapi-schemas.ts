import { getPolicyMap } from "./policy.js";
import { TaskStatusSchema } from "./enums.js";
import {
  ActivityItemInputSchema, CheckpointSchema, DigestSchema, EpicSchema, FactsSchema, LeadOverviewSchema, MemberSchema, PageProjectDetailSchema,
  PlanEpicEditBodySchema, PlanCheckpointsBodySchema, PlanEpicAddBodySchema, ProposalVersionBodySchema, PlanApprovalSchema, PlanEpicSchema, PlanProposalSchema, ProgressSchema, ProjectDetailSchema, ProjectInputSchema, ProjectSchema, ReplanApprovalSchema,
  ReplanApprovalBodySchema, ReplanProposalSchema, ReplanRejectionBodySchema, ReplanRejectionSchema, ProposalPageSchema, SprintCloseBodySchema, SprintPageSchema, SprintSchema, StandupSchema, StandupContentSchema, TaskEventSchema, TaskSchema, UploadResponseSchema, SummaryResponseSchema, UsageSessionSchema, UsageSummarySchema, UserSchema,
} from "./schemas.js";

export type OpenApiSchema = Record<string, unknown>;
export type OpenApiSchemaRegistry = Readonly<Record<string, OpenApiSchema>>;
type ZodLike = { _def: any };

function zodToJsonSchema(schema: ZodLike): OpenApiSchema {
  const def = schema._def;
  switch (def.typeName) {
    case "ZodObject": {
      const properties: Record<string, OpenApiSchema> = {};
      const required: string[] = [];
      for (const [key, child] of Object.entries(def.shape())) {
        properties[key] = zodToJsonSchema(child as ZodLike);
        if ((child as ZodLike)._def.typeName !== "ZodOptional" && (child as ZodLike)._def.typeName !== "ZodDefault") required.push(key);
      }
      return { type: "object", ...(required.length ? { required } : {}), properties, additionalProperties: def.unknownKeys !== "strict" };
    }
    case "ZodString": {
      const result: OpenApiSchema = { type: "string" };
      for (const check of def.checks ?? []) {
        if (check.kind === "min") result.minLength = check.value;
        if (check.kind === "max") result.maxLength = check.value;
        if (check.kind === "email") result.format = "email";
        if (check.kind === "uuid") result.format = "uuid";
        if (check.kind === "datetime") result.format = "date-time";
        if (check.kind === "url") result.format = "uri";
        if (check.kind === "regex") {
          result.pattern = check.regex.source;
          if (check.regex.source === "^\\d{4}-\\d{2}-\\d{2}$") result.format = "date";
        }
        if (check.kind === "startsWith") result.pattern = `^${check.value}`;
      }
      return result;
    }
    case "ZodNumber": {
      const result: OpenApiSchema = { type: def.checks?.some((check: any) => check.kind === "int") ? "integer" : "number" };
      for (const check of def.checks ?? []) {
        if (check.kind === "min") result[check.inclusive === false ? "exclusiveMinimum" : "minimum"] = check.value;
        if (check.kind === "max") result[check.inclusive === false ? "exclusiveMaximum" : "maximum"] = check.value;
      }
      return result;
    }
    case "ZodBoolean": return { type: "boolean" };
    case "ZodArray": {
      const result: OpenApiSchema = { type: "array", items: zodToJsonSchema(def.type) };
      if (def.minLength?.value !== null && def.minLength?.value !== undefined) result.minItems = def.minLength.value;
      if (def.maxLength?.value !== null && def.maxLength?.value !== undefined) result.maxItems = def.maxLength.value;
      if (def.exactLength?.value !== null && def.exactLength?.value !== undefined) result.minItems = result.maxItems = def.exactLength.value;
      return result;
    }
    case "ZodNullable": return { anyOf: [zodToJsonSchema(def.innerType), { type: "null" }] };
    case "ZodOptional": return zodToJsonSchema(def.innerType);
    case "ZodDefault": return zodToJsonSchema(def.innerType);
    case "ZodLiteral": return { enum: [def.value] };
    case "ZodEnum": return { type: "string", enum: def.values };
    case "ZodUnion": return { anyOf: def.options.map((option: ZodLike) => zodToJsonSchema(option)) };
    case "ZodDiscriminatedUnion": return { oneOf: [...def.options.values()].map((option: ZodLike) => zodToJsonSchema(option)) };
    case "ZodEffects": return zodToJsonSchema(def.schema);
    default: return { type: "object", additionalProperties: false };
  }
}

const schema = (value: ZodLike): OpenApiSchema => zodToJsonSchema(value);
const object = (properties: Record<string, OpenApiSchema>, required: string[] = []): OpenApiSchema => ({ type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false });
const string = (format?: string): OpenApiSchema => ({ type: "string", ...(format ? { format } : {}) });
const uuid = string("uuid");
const date: OpenApiSchema = { type: "string", format: "date", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };

export const ProjectDetailJsonSchema = schema(ProjectDetailSchema);
export const PageProjectDetailJsonSchema = schema(PageProjectDetailSchema);
export const FactsJsonSchema = schema(FactsSchema);
export const SprintPageJsonSchema = schema(SprintPageSchema);
export const ProposalPageJsonSchema = schema(ProposalPageSchema);

const requestSchemas: Record<string, OpenApiSchema> = {
  AUTH_CODE_CHECK: object({ role: { type: "string", enum: ["PM", "LEAD", "DEV", "DEV_LEAD", "DEVELOPER"] }, code: string() }, ["role", "code"]),
  AUTH_REGISTER: object({ displayName: string(), role: { type: "string", enum: ["PM", "DEV_LEAD", "DEVELOPER"] }, code: string() }, ["displayName", "role", "code"]), PM_PROJECT_CREATE: schema(ProjectInputSchema),
  PM_PROJECT_UPDATE: object({ name: string(), brief: { type: ["string", "null"] }, status: { type: "string", enum: ["ARCHIVED"] }, version: { type: "integer" } }, ["version"]),
  PROJECT_MEMBER_ADD: object({ email: { type: "string", format: "email" } }, ["email"]),
  CHECKPOINT_CREATE: object({ name: string(), targetDate: date }, ["name", "targetDate"]), CHECKPOINT_UPDATE: object({ name: string(), targetDate: date, version: { type: "integer" } }, ["version"]),
  EPIC_CREATE: object({ title: string(), description: { type: ["string", "null"] }, checkpointId: { anyOf: [uuid, { type: "null" }] } }, ["title"]), EPIC_UPDATE: object({ title: string(), description: { type: ["string", "null"] }, checkpointId: { anyOf: [uuid, { type: "null" }] }, position: { type: "integer" }, version: { type: "integer" } }, ["version"]),
  TASK_CREATE: object({ epicId: uuid, title: string(), description: { type: ["string", "null"] }, acceptanceCriteria: { type: "array", items: string() }, storyPoints: { anyOf: [{ type: "integer", minimum: 1, maximum: 20 }, { type: "null" }] }, assigneeId: { anyOf: [uuid, { type: "null" }] } }, ["epicId", "title"]),
  TASK_UPDATE: object({ title: string(), description: { type: ["string", "null"] }, acceptanceCriteria: { type: "array", items: string() }, storyPoints: { anyOf: [{ type: "integer", minimum: 1, maximum: 20 }, { type: "null" }] }, epicId: uuid, assigneeId: { anyOf: [uuid, { type: "null" }] }, sprintId: { anyOf: [uuid, { type: "null" }] }, version: { type: "integer" } }, ["version"]),
  TASK_STATUS_UPDATE: object({ status: schema(TaskStatusSchema), blocked: { type: "boolean" }, blockedReason: { type: ["string", "null"] }, version: { type: "integer" } }, ["status", "version"]),
  SPRINT_CREATE: object({ name: string(), startDate: date, endDate: date }, ["name", "startDate", "endDate"]), SPRINT_UPDATE: object({ name: string(), startDate: date, endDate: date, version: { type: "integer" } }, ["version"]), SPRINT_START: object({ version: { type: "integer" } }, ["version"]), SPRINT_CLOSE: schema(SprintCloseBodySchema),
  PM_PLAN_CREATE: object({ idea: { type: "string", minLength: 20, maxLength: 2000 } }, ["idea"]), PM_EPIC_UPDATE: schema(PlanEpicEditBodySchema), PM_EPIC_REGENERATE: schema(ProposalVersionBodySchema), PM_PROPOSAL_EXPAND_ALL: schema(ProposalVersionBodySchema), PM_PROPOSAL_CHECKPOINTS_UPDATE: schema(PlanCheckpointsBodySchema), PM_PROPOSAL_EPIC_CREATE: schema(PlanEpicAddBodySchema), PM_PROPOSAL_APPROVE: object({ version: { type: "integer" } }, ["version"]), PM_PROPOSAL_REJECT: object({ version: { type: "integer" } }, ["version"]),
  LEAD_DIGEST_CREATE: object({}), LEAD_PROPOSAL_APPROVE: schema(ReplanApprovalBodySchema), LEAD_PROPOSAL_REJECT: schema(ReplanRejectionBodySchema),
  DEV_UPLOAD_CREATE: object({ items: { type: "array", items: schema(ActivityItemInputSchema), maxItems: 100 } }, ["items"]), DEV_SUMMARY_CREATE: object({ itemIds: { type: "array", items: uuid, maxItems: 10 } }, ["itemIds"]), DEV_STANDUP_CREATE: object({ date: { anyOf: [date, { type: "null" }] } }), DEV_STANDUP_UPDATE: object({ content: schema(StandupContentSchema), version: { type: "integer" } }, ["content", "version"]), DEV_STANDUP_FEEDBACK: object({ feedback: { anyOf: [string(), { type: "null" }] }, accept: { type: "boolean" } }),
};

const responseSchemas: Record<string, OpenApiSchema> = {
  HEALTH_READ: object({ status: { type: "string", enum: ["UP"] } }, ["status"]), AUTH_CODE_CHECK: object({ valid: { type: "boolean" } }, ["valid"]), AUTH_REGISTER: schema(UserSchema), ME_READ: schema(UserSchema),
  PROJECT_LIST: PageProjectDetailJsonSchema, PROJECT_READ: ProjectDetailJsonSchema, PM_PROJECT_CREATE: schema(ProjectSchema), PM_PROJECT_UPDATE: schema(ProjectSchema), PROJECT_MEMBER_ADD: schema(MemberSchema),
  PROJECT_MEMBER_LIST: { type: "array", items: schema(MemberSchema) }, CHECKPOINT_LIST: { type: "array", items: schema(CheckpointSchema) }, CHECKPOINT_CREATE: schema(CheckpointSchema), CHECKPOINT_UPDATE: schema(CheckpointSchema), EPIC_LIST: { type: "array", items: schema(EpicSchema) }, EPIC_CREATE: schema(EpicSchema), EPIC_UPDATE: schema(EpicSchema), TASK_LIST: { type: "array", items: schema(TaskSchema) }, TASK_READ: schema(TaskSchema), TASK_CREATE: schema(TaskSchema), TASK_UPDATE: schema(TaskSchema), TASK_STATUS_UPDATE: schema(TaskSchema), TASK_EVENT_LIST: { type: "array", items: schema(TaskEventSchema) },
  SPRINT_LIST: SprintPageJsonSchema, SPRINT_CREATE: schema(SprintSchema), SPRINT_UPDATE: schema(SprintSchema), SPRINT_START: schema(SprintSchema), SPRINT_CLOSE: schema(SprintSchema), PROJECT_PROGRESS_READ: schema(ProgressSchema), PROJECT_FACTS_READ: schema(FactsSchema), PM_PLAN_CREATE: schema(PlanProposalSchema), PM_PROPOSAL_READ: schema(PlanProposalSchema), PM_PROPOSAL_LIST: { type: "array", items: schema(PlanProposalSchema) }, PM_EPIC_EXPAND: schema(PlanEpicSchema), PM_EPIC_UPDATE: schema(PlanProposalSchema), PM_EPIC_REGENERATE: schema(PlanProposalSchema), PM_PROPOSAL_CHECKPOINTS_UPDATE: schema(PlanProposalSchema), PM_PROPOSAL_EPIC_CREATE: schema(PlanProposalSchema), PM_PROPOSAL_EPIC_DELETE: schema(PlanProposalSchema), PM_PROPOSAL_EXPAND_ALL: schema(PlanProposalSchema), PM_PROPOSAL_APPROVE: schema(PlanApprovalSchema), PM_PROPOSAL_REJECT: schema(PlanProposalSchema),
  LEAD_OVERVIEW_READ: schema(LeadOverviewSchema), LEAD_DIGEST_CREATE: schema(DigestSchema), LEAD_DIGEST_LATEST_READ: schema(DigestSchema), LEAD_PROPOSAL_LIST: ProposalPageJsonSchema, LEAD_PROPOSAL_APPROVE: schema(ReplanApprovalSchema), LEAD_PROPOSAL_REJECT: schema(ReplanRejectionSchema), DEV_UPLOAD_CREATE: schema(UploadResponseSchema), DEV_SUMMARY_CREATE: schema(SummaryResponseSchema), DEV_STANDUP_CREATE: schema(StandupSchema), DEV_STANDUP_MINE_READ: schema(StandupSchema), DEV_STANDUP_UPDATE: schema(StandupSchema), DEV_STANDUP_FEEDBACK: schema(StandupSchema), LEAD_STANDUP_LIST: object({ items: { type: "array", items: schema(StandupSchema) }, page: { type: "integer" }, size: { type: "integer" }, total: { type: "integer" } }, ["items", "page", "size", "total"]), USAGE_SESSION_LIST: { type: "array", items: schema(UsageSessionSchema) }, USAGE_SUMMARY_READ: { type: "array", items: schema(UsageSummarySchema) },
};

for (const name of ["EPIC_LIST", "TASK_LIST", "TASK_EVENT_LIST", "PM_PROPOSAL_LIST", "USAGE_SESSION_LIST"]) {
  responseSchemas[name] = object({ items: responseSchemas[name], page: { type: "integer", minimum: 0 }, size: { type: "integer", minimum: 1 }, total: { type: "integer", minimum: 0 } }, ["items", "page", "size", "total"]);
}

export function createOpenApiSchemaRegistry(entries: Iterable<readonly [string, OpenApiSchema]>): OpenApiSchemaRegistry {
  const registry: Record<string, OpenApiSchema> = {};
  for (const [name, value] of entries) {
    if (registry[name] && JSON.stringify(registry[name]) !== JSON.stringify(value)) throw new Error(`OPENAPI_SCHEMA_CONFLICT: ${name}`);
    registry[name] = value;
  }
  return Object.freeze({ ...registry });
}

const entries: Array<readonly [string, OpenApiSchema]> = [["ProjectDetail", ProjectDetailJsonSchema], ["PageProjectDetail", PageProjectDetailJsonSchema], ["Facts", FactsJsonSchema], ["PROJECT_FACTS_READResponse", responseSchemas.PROJECT_FACTS_READ]];
for (const policy of getPolicyMap()) {
  entries.push([`${policy.operationId}Response`, responseSchemas[policy.operationId] ?? object({})]);
  if (policy.requestSchema) entries.push([`${policy.operationId}Request`, requestSchemas[policy.operationId] ?? object({})]);
}
export const OPENAPI_SCHEMA_REGISTRY = createOpenApiSchemaRegistry(entries);
