import { ProposalPageSchema, ReplanApprovalBodySchema, ReplanApprovalSchema, ReplanProposalSchema, ReplanRejectionBodySchema, policyForRoute, type RouteDefinition } from "@agile/contracts";
import { z } from "zod/v3";
import { ProposalError, type ProposalService } from "@agile/proposals";
import { HttpError } from "../errors.js";

type Actor = { userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
export type ProposalRouteServices = { proposals: Pick<ProposalService, "list" | "approve" | "reject"> };

const Id = z.object({ id: z.string().uuid() }).strict();
const ProposalId = z.object({ proposalId: z.string().uuid() }).strict();
const route = (key: string) => { const policy = policyForRoute(key); return { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey: key }; };

function mapError(error: unknown): HttpError {
  const code = error instanceof ProposalError ? error.code : error instanceof Error ? error.message : "";
  if (code === "NOT_FOUND") return new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
  if (code === "FORBIDDEN_ROLE") return new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
  if (code === "VALIDATION_FAILED") {
    const details = error instanceof ProposalError && error.details ? Object.entries(error.details).map(([field, value]) => ({ field, message: String(value) })) : undefined;
    return new HttpError("VALIDATION_FAILED", 422, "The request is not valid.", details);
  }
  if (code === "CONFLICT_VERSION") return new HttpError("CONFLICT_VERSION", 409, "The resource was modified by another request.");
  if (code === "CONFLICT_STATE") return new HttpError("CONFLICT_STATE", 409, "The proposal is no longer in an applicable state.");
  return error instanceof HttpError ? error : new HttpError("INTERNAL_ERROR", 500, "Internal server error.");
}

async function invoke<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { throw mapError(error); }
}

const actor = (value: Actor | undefined) => {
  if (!value) throw new HttpError("FORBIDDEN_ROLE", 403, "The user's role cannot access this operation.");
  return value;
};

export function createProposalRoutes(services: ProposalRouteServices): RouteDefinition[] {
  return [
    { ...route("endpoint-46"), paramsSchema: Id, querySchema: z.object({ page: z.coerce.number().int().min(0).max(10_000).default(0), size: z.coerce.number().int().min(1).max(100).default(20) }).strict(), responseSchema: ProposalPageSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.proposals.list({ actorId: actor(principal).userId, projectId: (input.params as { id: string }).id, ...(input.query as { page: number; size: number }) }))) },
    { ...route("endpoint-47"), paramsSchema: ProposalId, bodySchema: ReplanApprovalBodySchema, responseSchema: ReplanApprovalSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.proposals.approve({ proposalId: (input.params as { proposalId: string }).proposalId, ...(input.body as { version: number; suggestionIds: string[] }), actorId: actor(principal).userId }))) },
    { ...route("endpoint-48"), paramsSchema: ProposalId, bodySchema: ReplanRejectionBodySchema, responseSchema: ReplanProposalSchema, handler: async ({ principal, input }) => Response.json(await invoke(() => services.proposals.reject({ proposalId: (input.params as { proposalId: string }).proposalId, ...(input.body as { version: number }), actorId: actor(principal).userId }))) },
  ];
}
