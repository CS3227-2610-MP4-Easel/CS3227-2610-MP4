import { z } from "zod/v3";
import { defaultStandupDate, policyForRoute, type RouteDefinition } from "@agile/contracts";
import { DevError } from "@agile/dev";
import { contentLengthTooLarge } from "../body-limit.js";
import { errorResponse, HttpError } from "../errors.js";

type Role = "PM" | "DEV_LEAD" | "DEVELOPER";
type Actor = { userId: string; role: Role };
type Caller = { userId: string; role: "DEVELOPER" };
type LeadQuery = { date?: string; developerId?: string; page: number; size: number };
export type DevRouteServices = {
  upload(userId: string, projectId: string, items: unknown[]): Promise<unknown>;
  summaries(caller: Caller, projectId: string, itemIds: string[]): Promise<unknown>;
  standup(caller: Caller, projectId: string, date: string | undefined): Promise<unknown>;
  mine(userId: string, projectId: string, date: string): Promise<unknown>;
  leadList(actor: Actor, projectId: string, query: LeadQuery): Promise<unknown>;
  now?: () => Date;
};

const MAX_UPLOAD_BYTES = 1_048_576;
const Id = z.object({ id: z.string().uuid() }).strict();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const parsed = new Date(`${value}T00:00:00Z`); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value; });
const distinct = (ids: string[]) => new Set(ids).size === ids.length;
const UploadBody = z.object({ items: z.array(z.unknown()).max(100) }).strict();
const SummaryBody = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(10).transform((ids) => ids.map((id) => id.toLowerCase())).refine(distinct) }).strict();
const StandupBody = z.object({ date: z.string().nullable().optional() }).strict();
const MineQuery = z.object({ date: dateString.optional() }).strict();
const LeadListQuery = z.object({ date: dateString.optional(), developerId: z.string().uuid().optional(), page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20) }).strict();

const route = (key: string) => { const policy = policyForRoute(key); return { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: key }; };
const forbidden = () => new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
const actor = (value: Actor | undefined) => { if (!value) throw forbidden(); return value; };
const MESSAGES: Record<string, string> = {
  AI_BUSY: "The AI service is busy. Try again shortly.",
  RATE_LIMITED: "Too many AI requests. Try again later.",
  AI_UNAVAILABLE: "The AI service is unavailable.",
  AI_DISABLED: "AI features are disabled.",
  VALIDATION_FAILED: "The request is not valid.",
  INTERNAL_ERROR: "Internal server error.",
};

/** Runs a service call; a DevError becomes its envelope response, so no handler formats errors itself. */
async function respond(requestId: string, work: () => Promise<unknown>): Promise<Response> {
  try { return Response.json(await work()); } catch (error) {
    if (error instanceof DevError) {
      const response = errorResponse(new HttpError(error.code, error.status, MESSAGES[error.code] ?? MESSAGES.INTERNAL_ERROR, error.details ? [...error.details] : undefined), requestId);
      if (error.retryAfterSeconds !== undefined) response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof Error && error.message === "VALIDATION_FAILED") return errorResponse(new HttpError("VALIDATION_FAILED", 422, MESSAGES.VALIDATION_FAILED), requestId);
    throw error;
  }
}

/** Endpoints 49-52 and 55. Services are injected; handlers only translate validated transport data. */
export function createDevRoutes(services: DevRouteServices): RouteDefinition[] {
  const now = services.now ?? (() => new Date());
  const caller = (principal: Actor | undefined): Caller => ({ userId: actor(principal).userId, role: "DEVELOPER" });
  return [
    { ...route("endpoint-49"), paramsSchema: Id, bodySchema: UploadBody, bodyLimitBytes: MAX_UPLOAD_BYTES, responseSchema: {},
      before: async ({ requestId, request }) => { if (contentLengthTooLarge(request, MAX_UPLOAD_BYTES)) return errorResponse(new HttpError("PAYLOAD_TOO_LARGE", 413, "The request body is too large."), requestId); },
      handler: async ({ requestId, principal, input }) => respond(requestId, () => services.upload(actor(principal).userId, (input.params as { id: string }).id, (input.body as { items: unknown[] }).items)) },
    { ...route("endpoint-50"), paramsSchema: Id, bodySchema: SummaryBody, responseSchema: {},
      handler: async ({ requestId, principal, input }) => respond(requestId, () => services.summaries(caller(principal), (input.params as { id: string }).id, (input.body as { itemIds: string[] }).itemIds)) },
    { ...route("endpoint-51"), paramsSchema: Id, bodySchema: StandupBody, responseSchema: {},
      handler: async ({ requestId, principal, input }) => respond(requestId, () => services.standup(caller(principal), (input.params as { id: string }).id, (input.body as { date?: string | null }).date ?? undefined)) },
    { ...route("endpoint-52"), paramsSchema: Id, querySchema: MineQuery, responseSchema: {},
      handler: async ({ requestId, principal, input }) => respond(requestId, () => services.mine(actor(principal).userId, (input.params as { id: string }).id, (input.query as { date?: string }).date ?? defaultStandupDate(now()))) },
    { ...route("endpoint-55"), paramsSchema: Id, querySchema: LeadListQuery, responseSchema: {},
      handler: async ({ requestId, principal, input }) => respond(requestId, () => services.leadList(actor(principal), (input.params as { id: string }).id, input.query as LeadQuery)) },
  ];
}
