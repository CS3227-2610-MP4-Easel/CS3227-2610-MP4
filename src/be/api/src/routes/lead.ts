import { DigestSchema, FactsSchema, policyForRoute, type RouteDefinition } from "@agile/contracts";
import { z } from "zod/v3";
import type { Digest, Facts } from "@agile/contracts";
import { errorResponse, HttpError } from "../errors.js";

type Actor = { userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
type LeadFlow = {
  facts(projectId: string, callerId?: string): Promise<Facts>;
  createDigest(caller: { userId: string; role: "DEV_LEAD" }, projectId: string): Promise<Digest>;
  latestDigest(caller: { userId: string; role: "DEV_LEAD" }, projectId: string): Promise<Digest | null>;
};
export type LeadRouteServices = { runtime: () => LeadFlow };

const Id = z.object({ id: z.string().uuid() }).strict();
const EmptyBody = z.object({}).strict();
const route = (key: string) => { const policy = policyForRoute(key); return { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: key }; };

function leadError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const value = error as { code?: unknown; retryAfterSeconds?: unknown };
  const code = typeof value?.code === "string" ? value.code : error instanceof Error ? error.message : "";
  if (code === "NOT_MEMBER" || code === "NOT_FOUND") return new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  if (["AI_UNAVAILABLE", "AI_DISABLED", "BLOCKED_INPUT", "REQUEST_REFUSED", "ROLE_DENIED"].includes(code)) return new HttpError(code, 503, "The AI request could not be completed.");
  if (code === "AI_BUSY") return new HttpError("AI_BUSY", 429, "The AI service is busy.", [{ field: "retryAfterSeconds", message: String(value.retryAfterSeconds ?? 1) }]);
  return error instanceof HttpError ? error : new HttpError("INTERNAL_ERROR", 500, "Internal server error.");
}

async function invoke<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { throw leadError(error); }
}

/** Endpoints 42, 44 and 45. Authorization and role checks remain exclusively in the policy gate. */
export function createLeadRoutes(services: LeadRouteServices): RouteDefinition[] {
  return [
    { ...route("endpoint-42"), paramsSchema: Id, responseSchema: FactsSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.runtime().facts((input.params as { id: string }).id, (principal as Actor | undefined)?.userId))) },
    { ...route("endpoint-44"), paramsSchema: Id, bodySchema: EmptyBody, responseSchema: DigestSchema, handler: async ({ principal, input, requestId }) => {
      try {
        const digest = await services.runtime().createDigest(principal as { userId: string; role: "DEV_LEAD" }, (input.params as { id: string }).id);
        return Response.json(digest);
      } catch (error) {
        const mapped = leadError(error);
        const response = errorResponse(mapped, requestId);
        if (mapped.code === "AI_BUSY") response.headers.set("Retry-After", (error as { retryAfterSeconds?: unknown }).retryAfterSeconds != null ? String((error as { retryAfterSeconds: unknown }).retryAfterSeconds) : "1");
        return response;
      }
    } },
    { ...route("endpoint-45"), paramsSchema: Id, responseSchema: DigestSchema, handler: async ({ principal, input }) => {
      const digest = await invoke(() => services.runtime().latestDigest(principal as { userId: string; role: "DEV_LEAD" }, (input.params as { id: string }).id));
      if (!digest) throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
      return Response.json({ ...digest, cached: false });
    } },
  ];
}
