import { z } from "zod/v3";
import type { Core, ReplanApproval, ReplanProposal } from "@agile/contracts";
import { ReplanProposalSchema, SuggestionSchema } from "@agile/contracts";
import { inMutationTransaction, type FilteredDbClient, type MutationTransactionClient } from "@agile/db";
import type { Prisma } from "@prisma/client";
import { ProposalError } from "./errors.js";
import { lockDomainRow, lockProposal, lockSession } from "./locks.js";

export type TransactionSessionCloseInput = {
  sessionId: string;
  proposalId: string | null;
  projectId: string;
  feature: "LEAD_DIGEST";
  ownerId: string;
  outcome: "ACCEPTED" | "REJECTED";
  actorId: string;
};

/** Structural port: proposals owns the transaction boundary, not the gateway package. */
export type TransactionSessionCloser = {
  closeInTransaction(tx: MutationTransactionClient, input: TransactionSessionCloseInput): Promise<void>;
};

export type ProposalPage = { items: ReplanProposal[]; page: number; size: number; total: number };
export type CreateReplanInput = {
  projectId: string;
  sessionId: string;
  creatorId: string;
  suggestions: Suggestion[];
  explanation: string;
  flagged: boolean;
};
export type ReplanQuery = { actorId: string; projectId: string; page: number; size: number; status?: "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED" };
export type ReplanApprovalInput = { proposalId: string; version: number; suggestionIds: string[]; actorId: string; projectId?: string };
export type ReplanRejectionInput = { proposalId: string; version: number; actorId: string; projectId?: string };

type ReplanPayload = { suggestions?: unknown; explanation?: unknown; appliedSuggestionIds?: unknown } & Record<string, unknown>;
type Row = Record<string, any>;
type Tx = MutationTransactionClient & Record<string, any>;

// Stored proposal payloads and response envelopes are not capped here. The request contract
// bounds only the selected suggestionIds array; this keeps replay/listing lossless.
const suggestionList = z.array(SuggestionSchema);
type Suggestion = z.infer<typeof SuggestionSchema>;
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const codeOf = (error: unknown) => error instanceof Error ? error.message : "";

function payloadOf(value: unknown): ReplanPayload {
  return value && typeof value === "object" ? value as ReplanPayload : {};
}

function validateSuggestions(value: unknown): Suggestion[] {
  const parsed = suggestionList.safeParse(value);
  if (!parsed.success) throw new ProposalError("VALIDATION_FAILED", { field: "suggestions" });
  const ids = parsed.data.map((suggestion) => suggestion.id);
  if (new Set(ids).size !== ids.length) throw new ProposalError("VALIDATION_FAILED", { field: "suggestionIds", message: "Suggestion IDs must be unique." });
  return parsed.data;
}

function replanView(row: Row): ReplanProposal {
  const payload = payloadOf(row.payload);
  const parsed = suggestionList.safeParse(payload.suggestions);
  if (!parsed.success || typeof payload.explanation !== "string") throw new ProposalError("CONFLICT_STATE");
  return ReplanProposalSchema.parse({
    id: row.id, projectId: row.projectId, kind: "REPLAN", status: row.status, suggestions: parsed.data,
    explanation: payload.explanation, flagged: Boolean(row.flagged), createdAt: iso(row.createdAt), version: row.version,
  });
}

async function lockProject(tx: Tx, projectId: string): Promise<void> {
  try {
    await tx.project.update({ where: { id: projectId }, data: { version: { increment: 0 } }, select: { id: true } });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") throw new ProposalError("NOT_FOUND");
    throw error;
  }
}

async function projectAccess(tx: Tx, actorId: string, projectId: string, write: boolean): Promise<void> {
  const project = await tx.project.findFirst({ where: { id: projectId }, select: { id: true, status: true } });
  if (!project) throw new ProposalError("NOT_FOUND");
  if (project.status !== "ACTIVE") throw new ProposalError(write ? "CONFLICT_STATE" : "NOT_FOUND");
  const member = await tx.projectMember.findFirst({ where: { projectId, userId: actorId }, select: { projectId: true } });
  if (!member) throw new ProposalError("NOT_FOUND");
}

function sessionWhere(sessionId: string, projectId: string, ownerId: string, environment: string, open = true) {
  return { id: sessionId, projectId, userId: ownerId, env: environment, feature: "LEAD_DIGEST" as const, ...(open ? { outcome: "OPEN" as const } : {}) };
}

async function boundSession(tx: Tx, input: { sessionId: string; projectId: string; ownerId: string }, environment: string): Promise<Row> {
  const session = await tx.aiSession.findFirst({ where: sessionWhere(input.sessionId, input.projectId, input.ownerId, environment) });
  if (!session) throw new ProposalError("CONFLICT_STATE");
  return session;
}

async function lockReferencedRows(tx: Tx, projectId: string, suggestions: Suggestion[]): Promise<void> {
  for (const suggestion of suggestions) {
    const kind = suggestion.type === "MOVE_CHECKPOINT_DATE" ? "checkpoint" : suggestion.type === "MOVE_EPIC_TO_CHECKPOINT" ? "epic" : "task";
    const id = suggestion.type === "MOVE_CHECKPOINT_DATE" ? suggestion.checkpointId : suggestion.type === "MOVE_EPIC_TO_CHECKPOINT" ? suggestion.epicId : suggestion.taskId;
    if (!await lockDomainRow(tx, kind, id, projectId)) throw new ProposalError("VALIDATION_FAILED", { field: "suggestions", message: "A suggestion references a resource outside the project." });
    if (suggestion.type === "MOVE_EPIC_TO_CHECKPOINT" && suggestion.checkpointId && !await lockDomainRow(tx, "checkpoint", suggestion.checkpointId, projectId)) {
      throw new ProposalError("VALIDATION_FAILED", { field: "suggestions", message: "A suggestion references a checkpoint outside the project." });
    }
  }
}

async function proposalHint(db: FilteredDbClient, proposalId: string): Promise<string> {
  const row = await db.aiProposal.findFirst({ where: { id: proposalId }, select: { projectId: true } });
  if (!row) throw new ProposalError("NOT_FOUND");
  return row.projectId;
}

export function createProposalService(options: { db: FilteredDbClient; core: Pick<Core, "applyReplan">; sessionCloser: TransactionSessionCloser; environment?: string }) {
  const { db, core, sessionCloser } = options;
  const environment = options.environment ?? process.env.APP_TIER ?? "test";

  async function createReplanInTransaction(txInput: MutationTransactionClient, input: CreateReplanInput): Promise<{ proposalId: string; supersededProposalIds: string[] }> {
    const tx = txInput as Tx;
    const suggestions = validateSuggestions(input.suggestions);
    await lockProject(tx, input.projectId);
    await projectAccess(tx, input.creatorId, input.projectId, true);
    await boundSession(tx, { sessionId: input.sessionId, projectId: input.projectId, ownerId: input.creatorId }, environment);

    const pending = await tx.aiProposal.findMany({ where: { projectId: input.projectId, kind: "REPLAN", status: "PENDING" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const supersededProposalIds: string[] = [];
    for (const candidate of pending as Row[]) {
      const locked = await lockProposal(tx, candidate.id);
      if (!locked || locked.status !== "PENDING") continue;
      const oldSession = await lockSession(tx, locked.sessionId);
      await tx.aiProposal.update({ where: { id: locked.id }, data: { status: "SUPERSEDED", version: locked.version + 1 }, select: { id: true } });
      if (oldSession?.outcome === "OPEN") {
        await sessionCloser.closeInTransaction(txInput, {
          sessionId: locked.sessionId, proposalId: locked.id, projectId: locked.projectId, feature: "LEAD_DIGEST",
          ownerId: locked.createdBy, outcome: "REJECTED", actorId: input.creatorId,
        });
      }
      supersededProposalIds.push(locked.id);
    }

    const proposal = await tx.aiProposal.create({
      data: { projectId: input.projectId, kind: "REPLAN", status: "PENDING", payload: { suggestions, explanation: input.explanation }, sessionId: input.sessionId, createdBy: input.creatorId, flagged: input.flagged },
      select: { id: true },
    });
    return { proposalId: proposal.id, supersededProposalIds };
  }

  async function createReplan(input: CreateReplanInput) {
    return inMutationTransaction(db, (tx) => lockProject(tx as Tx, input.projectId), (tx) => projectAccess(tx as Tx, input.creatorId, input.projectId, true), (tx) => createReplanInTransaction(tx as MutationTransactionClient, input));
  }

  async function list(input: ReplanQuery): Promise<ProposalPage> {
    if (!Number.isInteger(input.page) || input.page < 0 || !Number.isInteger(input.size) || input.size < 1 || input.size > 100) throw new ProposalError("VALIDATION_FAILED", { field: "page" });
    await projectAccess(db as unknown as Tx, input.actorId, input.projectId, false);
    const where = { projectId: input.projectId, kind: "REPLAN" as const, ...(input.status ? { status: input.status } : {}) };
    const [rows, total] = await Promise.all([
      db.aiProposal.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: input.page * input.size, take: input.size }),
      db.aiProposal.count({ where }),
    ]);
    return { items: rows.map(replanView), page: input.page, size: input.size, total };
  }

  async function approve(input: ReplanApprovalInput): Promise<ReplanApproval> {
    const projectId = input.projectId ?? await proposalHint(db, input.proposalId);
    return inMutationTransaction(db, (tx) => lockProject(tx as Tx, projectId), (tx) => projectAccess(tx as Tx, input.actorId, projectId, true), async (txInput) => {
      const tx = txInput as Tx;
      const proposal = await lockProposal(tx, input.proposalId) as Row | null;
      if (!proposal || proposal.projectId !== projectId || proposal.kind !== "REPLAN") throw new ProposalError("NOT_FOUND");
      const payload = payloadOf(proposal.payload);
      if (proposal.status === "APPROVED") {
        const applied = z.array(z.string().uuid()).safeParse(payload.appliedSuggestionIds);
        if (!applied.success) throw new ProposalError("CONFLICT_STATE");
        return { proposalId: proposal.id, status: "APPROVED" as const, applied: applied.data };
      }
      if (proposal.status !== "PENDING") throw new ProposalError("CONFLICT_STATE");
      if (proposal.version !== input.version) throw new ProposalError("CONFLICT_VERSION");
      const session = await lockSession(tx, proposal.sessionId) as Row | null;
      if (!session || session.feature !== "LEAD_DIGEST" || session.projectId !== projectId || session.userId !== proposal.createdBy || session.env !== environment || session.outcome !== "OPEN") throw new ProposalError("CONFLICT_STATE");
      const suggestions = validateSuggestions(payload.suggestions);
      if (!Array.isArray(input.suggestionIds) || input.suggestionIds.length > 100 || new Set(input.suggestionIds).size !== input.suggestionIds.length) throw new ProposalError("VALIDATION_FAILED", { field: "suggestionIds" });
      const selected = input.suggestionIds.map((id) => suggestions.find((suggestion) => suggestion.id === id));
      if (selected.some((suggestion): suggestion is undefined => !suggestion)) throw new ProposalError("VALIDATION_FAILED", { field: "suggestionIds" });
      const chosen = selected as Suggestion[];
      await lockReferencedRows(tx, projectId, chosen);
      try {
        await core.applyReplan(tx, projectId, { suggestions: chosen }, input.actorId);
      } catch (error) {
        const message = codeOf(error);
        if (message === "FORBIDDEN_ROLE") throw new ProposalError("FORBIDDEN_ROLE");
        if (message === "VALIDATION_FAILED") throw new ProposalError("VALIDATION_FAILED");
        if (message === "CONFLICT_STATE") throw new ProposalError("CONFLICT_STATE");
        throw error;
      }
      await tx.aiProposal.update({ where: { id: proposal.id }, data: { status: "APPROVED", appliedBy: input.actorId, appliedAt: new Date(), payload: { ...payload, appliedSuggestionIds: input.suggestionIds } as Prisma.InputJsonValue, version: proposal.version + 1 }, select: { id: true } });
      await sessionCloser.closeInTransaction(tx, { sessionId: session.id, proposalId: proposal.id, projectId, feature: "LEAD_DIGEST", ownerId: session.userId, outcome: "ACCEPTED", actorId: input.actorId });
      return { proposalId: proposal.id, status: "APPROVED" as const, applied: input.suggestionIds };
    });
  }

  async function reject(input: ReplanRejectionInput): Promise<ReplanProposal> {
    const projectId = input.projectId ?? await proposalHint(db, input.proposalId);
    return inMutationTransaction(db, (tx) => lockProject(tx as Tx, projectId), (tx) => projectAccess(tx as Tx, input.actorId, projectId, true), async (txInput) => {
      const tx = txInput as Tx;
      const proposal = await lockProposal(tx, input.proposalId) as Row | null;
      if (!proposal || proposal.projectId !== projectId || proposal.kind !== "REPLAN") throw new ProposalError("NOT_FOUND");
      if (proposal.status !== "PENDING") throw new ProposalError("CONFLICT_STATE");
      if (proposal.version !== input.version) throw new ProposalError("CONFLICT_VERSION");
      const session = await lockSession(tx, proposal.sessionId) as Row | null;
      if (!session || session.feature !== "LEAD_DIGEST" || session.projectId !== projectId || session.userId !== proposal.createdBy || session.env !== environment || session.outcome !== "OPEN") throw new ProposalError("CONFLICT_STATE");
      if (session.userId !== input.actorId) throw new ProposalError("NOT_FOUND");
      await tx.aiProposal.update({ where: { id: proposal.id }, data: { status: "REJECTED", version: proposal.version + 1 }, select: { id: true } });
      await sessionCloser.closeInTransaction(tx, { sessionId: session.id, proposalId: proposal.id, projectId, feature: "LEAD_DIGEST", ownerId: session.userId, outcome: "REJECTED", actorId: input.actorId });
      return replanView({ ...proposal, status: "REJECTED", version: proposal.version + 1 });
    });
  }

  return { list, createReplan, createReplanInTransaction, approve, reject };
}

export type ProposalService = ReturnType<typeof createProposalService>;
