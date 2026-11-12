import { createHash } from "node:crypto";
import type { FilteredDbClient } from "@agile/db";
import { ProposalError } from "./errors.js";

export type CreateProposalInput = {
  projectId: string; creatorId: string; sessionId: string; flagged: boolean; approach: string;
  checkpoints: { name: string; targetDate: string }[];
  retrieved: { source: "EPIC" | "TASK"; projectId: string; id: string }[];
  epics: { title: string; description: string; checkpointName: string | null }[];
};

export const epicContentHash = (title: string, description: string, checkpointName: string | null): string =>
  createHash("sha256").update(`${title}\n${description}\n${checkpointName ?? ""}`).digest("hex");

/** Stores the proposal and its epic rows in one transaction; returns the proposal id. */
export async function createProposal(db: FilteredDbClient, input: CreateProposalInput): Promise<string> {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findFirst({ where: { id: input.projectId } });
    if (!project) throw new ProposalError("CONFLICT_STATE");
    const proposal = await tx.aiProposal.create({
      data: {
        projectId: input.projectId, kind: "PLAN", status: "PENDING",
        payload: { approach: input.approach, checkpoints: input.checkpoints, retrieved: input.retrieved },
        sessionId: input.sessionId, createdBy: input.creatorId, flagged: input.flagged,
      },
    });
    await tx.proposalEpic.createMany({
      data: input.epics.map((epic, index) => ({
        proposalId: proposal.id, index, title: epic.title, description: epic.description, checkpointName: epic.checkpointName,
        contentHash: epicContentHash(epic.title, epic.description, epic.checkpointName), expansionStatus: "PENDING" as const,
      })),
    });
    return proposal.id;
  });
}
