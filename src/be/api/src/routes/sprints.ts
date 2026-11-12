import { PageQuerySchema, ProgressSchema, SprintCloseBodySchema, SprintPageSchema, SprintSchema, policyForRoute, type RouteDefinition } from "@agile/contracts";
import { z } from "zod/v3";
import { HttpError } from "../errors.js";

type Actor = { userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
type SprintService = {
  list(actor: Actor, projectId: string, query: { page: number; size: number }): Promise<unknown>;
  create(actor: Actor, projectId: string, input: { name: string; startDate: string; endDate: string }): Promise<unknown>;
  patch(actor: Actor, sprintId: string, input: { name?: string; startDate?: string; endDate?: string; version: number }): Promise<unknown>;
  start(actor: Actor, sprintId: string, input: { version: number }): Promise<unknown>;
  close(actor: Actor, sprintId: string, input: { version: number; carryOver: Array<{ taskId: string; to: string }> }): Promise<unknown>;
  remove(actor: Actor, sprintId: string, input?: number | { version: number }): Promise<void>;
  progress(actor: Actor, projectId: string): Promise<unknown>;
};
export type SprintRouteServices = { sprints: SprintService };

const Id = z.object({ id: z.string().uuid() }).strict();
const Create = z.object({ name: z.string().min(1).max(200), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
const Patch = z.object({ name: z.string().min(1).max(200).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), version: z.number().int().positive() }).strict().refine((value) => value.name !== undefined || value.startDate !== undefined || value.endDate !== undefined, "At least one sprint field must change");
const Version = z.object({ version: z.number().int().positive() }).strict();
const DeleteQuery = z.object({ version: z.coerce.number().int().positive() }).strict();
const route = (key: string) => { const policy = policyForRoute(key); return { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: key }; };

function mapError(error: unknown): HttpError {
  const code = error instanceof Error ? error.message : "";
  if (code === "NOT_FOUND") return new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  if (code === "FORBIDDEN_ROLE") return new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
  if (code === "VALIDATION_FAILED") return new HttpError("VALIDATION_FAILED", 422, "The request is not valid.");
  if (code === "CONFLICT_VERSION") return new HttpError("CONFLICT_VERSION", 409, "The resource was modified by another request.");
  if (code === "CONFLICT_STATE") return new HttpError("CONFLICT_STATE", 409, "The resource is no longer in an applicable state.");
  return error instanceof HttpError ? error : new HttpError("INTERNAL_ERROR", 500, "Internal server error.");
}

async function invoke<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { throw mapError(error); }
}

const actor = (value: Actor | undefined) => {
  if (!value) throw new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
  return value;
};

export function createSprintRoutes(services: SprintRouteServices): RouteDefinition[] {
  return [
    { ...route("endpoint-27"), paramsSchema: Id, querySchema: PageQuerySchema, responseSchema: SprintPageSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.sprints.list(actor(principal), (input.params as { id: string }).id, input.query as { page: number; size: number }))) },
    { ...route("endpoint-28"), paramsSchema: Id, bodySchema: Create, responseSchema: SprintSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.sprints.create(actor(principal), (input.params as { id: string }).id, input.body as { name: string; startDate: string; endDate: string })), { status: 201 }) },
    { ...route("endpoint-29"), paramsSchema: Id, bodySchema: Patch, responseSchema: SprintSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.sprints.patch(actor(principal), (input.params as { id: string }).id, input.body as { name?: string; startDate?: string; endDate?: string; version: number }))) },
    { ...route("endpoint-30"), paramsSchema: Id, bodySchema: Version, responseSchema: SprintSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.sprints.start(actor(principal), (input.params as { id: string }).id, input.body as { version: number }))) },
    { ...route("endpoint-31"), paramsSchema: Id, bodySchema: SprintCloseBodySchema, responseSchema: SprintSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.sprints.close(actor(principal), (input.params as { id: string }).id, input.body as { version: number; carryOver: Array<{ taskId: string; to: string }> }))) },
    { ...route("endpoint-32"), paramsSchema: Id, querySchema: DeleteQuery, responseSchema: {}, handler: async ({ principal, input }) => { const query = input.query as { version: number }; await invoke(() => services.sprints.remove(actor(principal), (input.params as { id: string }).id, { version: query.version })); return new Response(null, { status: 204 }); } },
    { ...route("endpoint-33"), paramsSchema: Id, responseSchema: ProgressSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.sprints.progress(actor(principal), (input.params as { id: string }).id))) },
  ];
}
