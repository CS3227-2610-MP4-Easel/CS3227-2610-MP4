import type { PlanProposal } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";
import { epicContentHash } from "./create.js";
import { assertWholePlan, guardEdit, isLive, type Checkpoint } from "./edit-common.js";
import { ProposalError } from "./errors.js";
import { lockEpic } from "./locks.js";
import { getProposalView } from "./view.js";

type Input = { proposalId: string; actorId: string; version: number };
const payloadOf = (payload: unknown) => (payload ?? {}) as { checkpoints?: Checkpoint[]; [key: string]: unknown };
async function view(db: FilteredDbClient, i: Input): Promise<PlanProposal> {
  const result = await getProposalView(db, i.proposalId, i.actorId);
  if (!result) throw new ProposalError("NOT_FOUND");
  return result;
}
export async function addEpic(db: FilteredDbClient, i: Input & { title: string; description: string; checkpointName: string | null }): Promise<PlanProposal> {
  await db.$transaction(async tx => {
    const proposal = await guardEdit(tx, i);
    const payload = payloadOf(proposal.payload), checkpoints = payload.checkpoints ?? [];
    if (i.checkpointName !== null && !checkpoints.some(c => c.name === i.checkpointName)) throw new ProposalError("VALIDATION_FAILED", "checkpointName");
    const rows = await tx.proposalEpic.findMany({ where: { proposalId: i.proposalId }, orderBy: { index: "asc" } });
    const epic = { title: i.title, description: i.description, checkpointName: i.checkpointName, expansionStatus: "PENDING", tasks: null };
    assertWholePlan(checkpoints, [...rows, epic]);
    await tx.proposalEpic.create({ data: { proposalId: i.proposalId, index: rows.length, title: i.title, description: i.description, checkpointName: i.checkpointName, contentHash: epicContentHash(i.title, i.description, i.checkpointName), expansionStatus: "PENDING" } });
    await tx.aiProposal.update({ where: { id: i.proposalId }, data: { payload: { ...payload, edited: true }, version: proposal.version + 1 } });
  });
  return view(db, i);
}
export async function deleteEpic(db: FilteredDbClient, i: Input & { index: number; now?: Date }): Promise<PlanProposal> {
  await db.$transaction(async tx => {
    const proposal = await guardEdit(tx, i);
    const rows = await tx.proposalEpic.findMany({ where: { proposalId: i.proposalId }, orderBy: { index: "asc" } });
    if (!Number.isInteger(i.index) || i.index < 0 || i.index >= rows.length) throw new ProposalError("NOT_FOUND");
    if (rows.length === 1) throw new ProposalError("VALIDATION_FAILED", "epics");
    if (rows.some(row => isLive(row, i.now ?? new Date()))) throw new ProposalError("CONFLICT_STATE");
    const payload = payloadOf(proposal.payload);
    assertWholePlan(payload.checkpoints ?? [], rows.filter(row => row.index !== i.index));
    const watermark = Math.max((payload.epicVersionWatermark as number | undefined) ?? 0, ...rows.map(row => row.version)) + 1;
    if (watermark > 2_147_483_646) throw new ProposalError("CONFLICT_STATE");
    for (const row of rows.slice(i.index)) if (!await lockEpic(tx, i.proposalId, row.index)) throw new ProposalError("NOT_FOUND");
    await tx.proposalEpic.delete({ where: { proposalId_index: { proposalId: i.proposalId, index: i.index } } });
    for (const row of rows.slice(i.index + 1)) await tx.proposalEpic.update({ where: { proposalId_index: { proposalId: i.proposalId, index: row.index } }, data: { index: row.index - 1, version: watermark } });
    await tx.aiProposal.update({ where: { id: i.proposalId }, data: { payload: { ...payload, edited: true, epicVersionWatermark: watermark }, version: proposal.version + 1 } });
  });
  return view(db, i);
}
