import { EmptyBodySchema, PlanListQuerySchema, PlanProposalPageSchema, PlanEpicEditBodySchema, PlanCheckpointsBodySchema, PlanEpicAddBodySchema, ProposalVersionQuerySchema, PlanApprovalSchema, PlanCreateBodySchema, PlanEpicSchema, PlanProposalSchema, ProposalVersionBodySchema, type RouteDefinition } from "@agile/contracts";
import { loadPmSettings, PlanFlowError, type PlanFlow } from "@agile/pm";
import { errorResponse, HttpError } from "../errors.js";
import { bodyTooLarge, route } from "./shared.js";

// Validation only: a bad PM_SIMILAR_ITEMS stops startup as W4's settings do.
loadPmSettings(process.env);

const CREATE_MAX_BYTES = 32_768;
const SMALL_MAX_BYTES = 1_024;
const INDEX_PATTERN = /^(0|[1-9][0-9]{0,2})$/;

// The size check intentionally runs before authorisation (a `before` hook): it reads at most `max` bytes, so it is bounded, and it matches the W4 endpoints.
const bodyLimit = (max: number): NonNullable<RouteDefinition["before"]> => async ({ requestId, request }) => {
  if (await bodyTooLarge(request, max)) return errorResponse(new HttpError("PAYLOAD_TOO_LARGE", 413, "The request body is too large."), requestId);
};

/** The flow already turned every proposal and gateway failure into a PlanFlowError; anything else is rethrown (500). */
async function respond(requestId: string, status: 200 | 201, run: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await run(), { status });
  } catch (error) {
    if (!(error instanceof PlanFlowError)) throw error;
    const details = error.details ? [{ field: "reason", message: error.details.reason }] : undefined;
    const response = errorResponse(new HttpError(error.code, error.status, error.message, details), requestId);
    if (error.retryAfterSeconds !== undefined) response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
}

/** Endpoints 34, 35, 37, 40 and 41 (spec `api.md`); `flow` is read per request so tests can pass a fake. */
export function pmRoutes(flow: () => PlanFlow): RouteDefinition[] {
  const caller = (userId: string) => ({ userId, role: "PM" as const });
  return [
    {
      ...route("endpoint-34"),
      bodySchema: PlanCreateBodySchema,
      responseSchema: PlanProposalSchema,
      before: bodyLimit(CREATE_MAX_BYTES),
      handler: ({ requestId, input, principal, request }) =>
        respond(requestId, 201, () => flow().createPlan({ caller: caller(principal!.userId), projectId: request.params.id!, idea: (input.body as { idea: string }).idea })),
    },
    {
      ...route("endpoint-35"),
      responseSchema: PlanProposalSchema,
      handler: ({ requestId, principal, request }) =>
        respond(requestId, 200, () => flow().getProposal({ caller: caller(principal!.userId), proposalId: request.params.proposalId! })),
    },
    {
      ...route("endpoint-37"),
      bodySchema: EmptyBodySchema,
      responseSchema: PlanEpicSchema,
      before: bodyLimit(SMALL_MAX_BYTES),
      handler: ({ requestId, principal, request }) => {
        const index = request.params.index ?? "";
        if (!INDEX_PATTERN.test(index)) throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
        return respond(requestId, 200, () => flow().expandEpic({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, index: Number(index) }));
      },
    },
    {
      ...route("endpoint-36"), querySchema: PlanListQuerySchema, responseSchema: PlanProposalPageSchema,
      handler: ({ requestId, principal, request, input }) => respond(requestId, 200, () => flow().listProposals({ caller: caller(principal!.userId), projectId: request.params.id!, ...(input.query as { page: number; size: number; status?: "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED" }) })),
    },
    {
      ...route("endpoint-38"), bodySchema: PlanEpicEditBodySchema, responseSchema: PlanProposalSchema, before: bodyLimit(262_144),
      handler: ({ requestId, principal, request, input }) => {
        const index = request.params.index ?? "";
        if (!INDEX_PATTERN.test(index)) throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
        return respond(requestId, 200, () => flow().editEpic({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, index: Number(index), ...(input.body as Omit<Parameters<PlanFlow["editEpic"]>[0], "caller" | "proposalId" | "index">) }));
      },
    },
    {
      ...route("endpoint-39"), bodySchema: ProposalVersionBodySchema, responseSchema: PlanProposalSchema, before: bodyLimit(SMALL_MAX_BYTES),
      handler: ({ requestId, principal, request, input }) => {
        const index = request.params.index ?? "";
        if (!INDEX_PATTERN.test(index)) throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
        return respond(requestId, 200, () => flow().regenerateEpic({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, index: Number(index), version: (input.body as { version: number }).version }));
      },
    },
    {
      ...route("endpoint-61"), bodySchema: ProposalVersionBodySchema, responseSchema: PlanProposalSchema, before: bodyLimit(SMALL_MAX_BYTES),
      handler: ({ requestId, principal, request, input }) => respond(requestId, 200, () => flow().expandAll({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, version: (input.body as { version: number }).version })),
    },
    {
      ...route("endpoint-58"), bodySchema: PlanCheckpointsBodySchema, responseSchema: PlanProposalSchema, before: bodyLimit(16_384),
      handler: ({ requestId, principal, request, input }) => respond(requestId, 200, () => flow().replaceCheckpoints({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, ...(input.body as Omit<Parameters<PlanFlow["replaceCheckpoints"]>[0], "caller" | "proposalId">) })),
    },
    {
      ...route("endpoint-59"), bodySchema: PlanEpicAddBodySchema, responseSchema: PlanProposalSchema, before: bodyLimit(CREATE_MAX_BYTES),
      handler: ({ requestId, principal, request, input }) => respond(requestId, 201, () => flow().addEpic({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, ...(input.body as Omit<Parameters<PlanFlow["addEpic"]>[0], "caller" | "proposalId">) })),
    },
    {
      ...route("endpoint-60"), querySchema: ProposalVersionQuerySchema, responseSchema: PlanProposalSchema,
      handler: ({ requestId, principal, request, input }) => {
        const index = request.params.index ?? "";
        if (!INDEX_PATTERN.test(index)) throw new HttpError("NOT_FOUND", 404, "The requested resource was not found.");
        return respond(requestId, 200, () => flow().deleteEpic({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, index: Number(index), version: (input.query as { version: number }).version }));
      },
    },
    {
      ...route("endpoint-40"),
      bodySchema: ProposalVersionBodySchema,
      responseSchema: PlanApprovalSchema,
      before: bodyLimit(SMALL_MAX_BYTES),
      handler: ({ requestId, input, principal, request }) =>
        respond(requestId, 200, () => flow().approve({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, version: (input.body as { version: number }).version })),
    },
    {
      ...route("endpoint-41"),
      bodySchema: ProposalVersionBodySchema,
      responseSchema: PlanProposalSchema,
      before: bodyLimit(SMALL_MAX_BYTES),
      handler: ({ requestId, input, principal, request }) =>
        respond(requestId, 200, () => flow().reject({ caller: caller(principal!.userId), proposalId: request.params.proposalId!, version: (input.body as { version: number }).version })),
    },
  ];
}
