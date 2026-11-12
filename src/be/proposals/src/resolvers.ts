import type { ResourceResolver } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves request.params.proposalId to the proposal's project (endpoints 35, 37, 40, 41). */
export function createProposalResolvers(db: FilteredDbClient): ResourceResolver {
  return async (operationId, request) => {
    const proposalId = (request as { params?: { proposalId?: unknown } } | null | undefined)?.params?.proposalId;
    if (operationId === "LEAD_PROPOSAL_LIST") {
      const projectId = (request as { params?: { id?: unknown } } | null | undefined)?.params?.id;
      if (typeof projectId !== "string" || !UUID.test(projectId)) return null;
      const project = await (db as any).project.findFirst({ where: { id: projectId }, select: { id: true, status: true } });
      return project && project.status !== "ARCHIVED" ? { kind: "PROJECT", projectId, state: "ACTIVE" } : null;
    }
    if (typeof proposalId !== "string" || !UUID.test(proposalId)) return null;
    const row = await db.aiProposal.findFirst({ where: { id: proposalId, ...(operationId.startsWith("LEAD_") ? { kind: "REPLAN" } : {}) }, select: { id: true, projectId: true, createdBy: true, project: { select: { status: true } } } });
    if (!row) return null;
    return { kind: "PROPOSAL", projectId: row.projectId, ownerId: row.createdBy, state: row.project?.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE" };
  };
}
