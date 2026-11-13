import { z } from "zod/v3";
import { PageQuerySchema, ProjectInputSchema, policyForRoute, type RouteDefinition } from "@agile/contracts";
import { HttpError } from "../errors.js";

type Actor = { userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
export type ProjectsRouteServices = { create(actor: Actor, input: { name: string; brief?: string | null }): Promise<unknown>; list(actor: Actor, query: { page: number; size: number }): Promise<unknown>; detail(actor: Actor, projectId: string): Promise<unknown>; update(actor: Actor, projectId: string, input: { name?: string; brief?: string | null; status?: "ARCHIVED"; version: number }): Promise<unknown>; members(actor: Actor, projectId: string): Promise<unknown>; addMember(actor: Actor, projectId: string, input: { email: string }): Promise<{ member: unknown; created: boolean }>; removeMember(actor: Actor, projectId: string, userId: string): Promise<void> };
const Id = z.object({ projectId: z.string().uuid() }).strict();
const MemberParams = z.object({ projectId: z.string().uuid(), userId: z.string().uuid() }).strict();
const AddMember = z.object({ email: z.string().email() }).strict();
const ProjectPatchBody = z.object({ name: z.string().min(1).max(200).optional(), brief: z.string().max(4000).nullable().optional(), status: z.literal("ARCHIVED").optional(), version: z.number().int().positive() }).strict();
const route = (key: string) => { const policy = policyForRoute(key); return { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: key }; };
const actor = (value: Actor | undefined) => { if (!value) throw new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation."); return value; };
const invoke = async (work: () => Promise<unknown>) => {
  try { return await work(); } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === "FORBIDDEN_ROLE") throw new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
    if (error.message === "VALIDATION_FAILED") throw new HttpError("VALIDATION_FAILED", 422, "The request body is not valid.");
    if (error.message === "CONFLICT_VERSION") throw new HttpError("CONFLICT_VERSION", 409, "The resource was modified by another request.");
    throw error;
  }
};

/** Endpoints 5-11. Services are injected so handlers only translate validated transport data. */
export function createProjectsRoutes(services: ProjectsRouteServices): RouteDefinition[] {
  return [
    { ...route("endpoint-5"), bodySchema: ProjectInputSchema, responseSchema: {}, handler: async ({ principal, input }) => Response.json(await invoke(() => services.create(actor(principal), input.body as { name: string; brief?: string | null })), { status: 201 }) },
    { ...route("endpoint-6"), querySchema: PageQuerySchema, responseSchema: {}, handler: async ({ principal, input }) => Response.json(await invoke(() => services.list(actor(principal), input.query as { page: number; size: number }))) },
    { ...route("endpoint-7"), paramsSchema: Id, responseSchema: {}, handler: async ({ principal, input }) => Response.json(await invoke(() => services.detail(actor(principal), (input.params as { projectId: string }).projectId))) },
    { ...route("endpoint-8"), paramsSchema: Id, bodySchema: ProjectPatchBody, responseSchema: {}, handler: async ({ principal, input }) => Response.json(await invoke(() => services.update(actor(principal), (input.params as { projectId: string }).projectId, input.body as { name?: string; brief?: string | null; status?: "ARCHIVED"; version: number }))) },
    { ...route("endpoint-9"), paramsSchema: Id, responseSchema: {}, handler: async ({ principal, input }) => Response.json(await invoke(() => services.members(actor(principal), (input.params as { projectId: string }).projectId))) },
    { ...route("endpoint-10"), paramsSchema: Id, bodySchema: AddMember, responseSchema: {}, handler: async ({ principal, input }) => {
      const result = await invoke(() => services.addMember(actor(principal), (input.params as { projectId: string }).projectId, input.body as { email: string })) as { member: unknown; created: boolean };
      return Response.json(result.member, { status: result.created ? 201 : 200 });
    } },
    { ...route("endpoint-11"), paramsSchema: MemberParams, responseSchema: {}, handler: async ({ principal, input }) => {
      const params = input.params as { projectId: string; userId: string };
      await invoke(() => services.removeMember(actor(principal), params.projectId, params.userId));
      return new Response(null, { status: 204 });
    } },
  ];
}
