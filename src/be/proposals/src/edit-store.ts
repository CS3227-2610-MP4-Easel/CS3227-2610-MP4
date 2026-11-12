import type { PlanProposal } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";
import { epicContentHash } from "./create.js";
import { assertWholePlan, guardEdit, isLive, type Checkpoint } from "./edit-common.js";
import { ProposalError } from "./errors.js";
import type { EpicTask } from "./expand-store.js";
import { lockEpic } from "./locks.js";
import { getProposalView } from "./view.js";

type Input = { proposalId: string; actorId: string; version: number; now?: Date };
const payloadOf = (payload: unknown) => (payload ?? {}) as { checkpoints?: Checkpoint[]; [key: string]: unknown };
async function view(db: FilteredDbClient, i: Input): Promise<PlanProposal> {
  const result = await getProposalView(db, i.proposalId, i.actorId);
  if (!result) throw new ProposalError("NOT_FOUND");
  return result;
}
export async function editEpic(db: FilteredDbClient, i: Input & { index: number; title?: string; description?: string; checkpointName?: string | null; tasks?: EpicTask[] }): Promise<PlanProposal> {
  await db.$transaction(async tx => {
    const proposal = await guardEdit(tx, i);
    const rows = await tx.proposalEpic.findMany({ where: { proposalId: i.proposalId }, orderBy: { index: "asc" } });
    if (!Number.isInteger(i.index) || i.index < 0 || i.index >= rows.length) throw new ProposalError("NOT_FOUND");
    const row = await lockEpic(tx, i.proposalId, i.index);
    if (!row) throw new ProposalError("NOT_FOUND");
    const payload = payloadOf(proposal.payload); const checkpoints = payload.checkpoints ?? [];
    if (i.checkpointName !== undefined && i.checkpointName !== null && !checkpoints.some(c => c.name === i.checkpointName)) throw new ProposalError("VALIDATION_FAILED", "checkpointName");
    if (isLive(row, i.now ?? new Date())) throw new ProposalError("CONFLICT_STATE");
    const title = i.title ?? row.title, description = i.description ?? row.description;
    const checkpointName = i.checkpointName === undefined ? row.checkpointName : i.checkpointName;
    const changed = title !== row.title || description !== row.description || i.tasks !== undefined;
    const updated = { ...row, title, description, checkpointName, expansionStatus: i.tasks !== undefined ? "DONE" : row.expansionStatus, tasks: i.tasks !== undefined ? i.tasks : row.tasks };
    const parsed = assertWholePlan(checkpoints, rows.map(r => r.index === row.index ? updated : r));
    await tx.proposalEpic.update({ where: { proposalId_index: { proposalId: i.proposalId, index: i.index } }, data: { title, description, checkpointName, contentHash: epicContentHash(title, description, checkpointName), ...(changed ? { version: row.version + 1 } : {}), ...(i.tasks !== undefined ? { tasks: parsed.epics[i.index].tasks, expansionStatus: "DONE", leaseExpiresAt: null, error: null } : {}) } });
    await tx.aiProposal.update({ where: { id: i.proposalId }, data: { payload: { ...payload, edited: true }, version: proposal.version + 1 } });
  });
  return view(db, i);
}
export async function replaceCheckpoints(db: FilteredDbClient, i: Input & { checkpoints: { name: string; targetDate: string; previousName?: string }[] }): Promise<PlanProposal> {
  await db.$transaction(async tx => {
    const proposal = await guardEdit(tx, i); const payload = payloadOf(proposal.payload); const old = payload.checkpoints ?? [];
    const previous = new Set<string>();
    for (const checkpoint of i.checkpoints) if (checkpoint.previousName !== undefined) {
      if (!old.some(c => c.name === checkpoint.previousName) || previous.has(checkpoint.previousName)) throw new ProposalError("VALIDATION_FAILED", "previousName");
      previous.add(checkpoint.previousName);
    }
    const checkpoints = i.checkpoints.map(({name, targetDate}) => ({name, targetDate}));
    const rows = await tx.proposalEpic.findMany({ where: { proposalId: i.proposalId }, orderBy: { index: "asc" } });
    const locked = [];
    for (const row of rows) { const epic = await lockEpic(tx, i.proposalId, row.index); if (!epic) throw new ProposalError("NOT_FOUND"); locked.push(epic); }
    const mapped = locked.map(row => ({ ...row, checkpointName: row.checkpointName === null ? null : i.checkpoints.find(c => c.previousName === row.checkpointName)?.name ?? (checkpoints.some(c => c.name === row.checkpointName) ? row.checkpointName : null) }));
    const parsed = assertWholePlan(checkpoints, mapped);
    for (const row of mapped) await tx.proposalEpic.update({ where: { proposalId_index: { proposalId: i.proposalId, index: row.index } }, data: { checkpointName: row.checkpointName, contentHash: epicContentHash(row.title, row.description, row.checkpointName) } });
    await tx.aiProposal.update({ where: { id: i.proposalId }, data: { payload: { ...payload, checkpoints: parsed.checkpoints, edited: true }, version: proposal.version + 1 } });
  });
  return view(db, i);
}
