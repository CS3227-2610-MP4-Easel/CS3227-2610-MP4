import type { ResourceResolver } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves request.params.proposalId to the proposal's project (endpoints 35, 37, 40, 41). */
export function createProposalResolvers(db: FilteredDbClient): ResourceResolver {
  return async (_operationId, request) => {
    const proposalId = (request as { params?: { proposalId?: unknown } } | null | undefined)?.params?.proposalId;
    if (typeof proposalId !== "string" || !UUID.test(proposalId)) return null;
    const row = await db.aiProposal.findFirst({ where: { id: proposalId } });
    if (!row) return null;
    return { kind: "PROPOSAL", projectId: row.projectId, ownerId: row.createdBy, state: "ACTIVE" };
  };
}
