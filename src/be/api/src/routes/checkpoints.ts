import { z } from "zod/v3";
import { policyForRoute, type RouteDefinition } from "@agile/contracts";
import { HttpError } from "../errors.js";

type Actor = { userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
export type CheckpointsRouteServices = { list(actor: Actor, projectId: string): Promise<unknown>; create(actor: Actor, projectId: string, input: { name: string; targetDate: string }): Promise<unknown>; patch(actor: Actor, id: string, input: { name?: string; targetDate?: string; version: number }): Promise<unknown> };
const Id = z.object({ id: z.string().uuid() }).strict();
const CalendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Must be a calendar date.");
export const CheckpointCreateBodySchema = z.object({ name: z.string().min(1).max(200), targetDate: CalendarDate }).strict();
const CheckpointPatchBodySchema = z.object({ name: z.string().min(1).max(200).optional(), targetDate: CalendarDate.optional(), version: z.number().int().positive() }).strict();
const route = (key: string) => { const policy = policyForRoute(key); return { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: key }; };
const actor = (value: Actor | undefined) => { if (!value) throw new Error("FORBIDDEN_ROLE"); return value; };

/** Endpoints 12-13; authorization is the policy gate's responsibility, not these handlers'. */
export function createCheckpointsRoutes(services: CheckpointsRouteServices): RouteDefinition[] {
  return [
    { ...route("endpoint-12"), paramsSchema: Id, responseSchema: {}, handler: async ({ principal, input }) => Response.json(await services.list(actor(principal), (input.params as { id: string }).id)) },
    { ...route("endpoint-13"), paramsSchema: Id, bodySchema: CheckpointCreateBodySchema, responseSchema: {}, handler: async ({ principal, input }) => Response.json(await services.create(actor(principal), (input.params as { id: string }).id, input.body as { name: string; targetDate: string }), { status: 201 }) },
    { ...route("endpoint-14"), paramsSchema: Id, bodySchema: CheckpointPatchBodySchema, responseSchema: {}, handler: async ({ principal, input }) => {
      try { return Response.json(await services.patch(actor(principal), (input.params as { id: string }).id, input.body as { name?: string; targetDate?: string; version: number })); }
      catch (error) { if (error instanceof Error && error.message === "CONFLICT_VERSION") throw new HttpError("CONFLICT_VERSION", 409, "The resource was modified by another request."); throw error; }
    } },
  ];
}
