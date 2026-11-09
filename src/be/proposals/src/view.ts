import type { PlanProposal } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";

type PlanEpic = PlanProposal["epics"][number];
type EpicRow = {
  index: number; title: string; description: string; checkpointName: string | null; contentHash: string;
  expansionStatus: "PENDING" | "IN_PROGRESS" | "DONE" | "FAILED"; leaseExpiresAt: Date | null; tasks: unknown; error: string | null;
};

/** An IN_PROGRESS row whose lease is strictly before `now` is shown (and claimable) as PENDING. */
export function toPlanEpic(row: EpicRow, now: Date = new Date()): PlanEpic {
  const expired = row.expansionStatus === "IN_PROGRESS" && row.leaseExpiresAt !== null && row.leaseExpiresAt.getTime() < now.getTime();
  return {
    index: row.index, title: row.title, description: row.description, checkpointName: row.checkpointName, contentHash: row.contentHash,
    expansion: { status: expired ? "PENDING" : row.expansionStatus, tasks: (row.tasks ?? null) as PlanEpic["expansion"]["tasks"], error: row.error },
  };
}

type Stored = { approach?: unknown; checkpoints?: unknown; retrieved?: unknown };
type RetrievedId = { source: string; projectId: string; id: string };
type ProposalRow = NonNullable<Awaited<ReturnType<FilteredDbClient["aiProposal"]["findFirst"]>>>;
type ProposalEpicRow = Awaited<ReturnType<FilteredDbClient["proposalEpic"]["findMany"]>>[number];

function storedRetrieved(value: unknown): RetrievedId[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is RetrievedId => !!v && typeof v === "object"
    && typeof (v as RetrievedId).source === "string" && typeof (v as RetrievedId).projectId === "string" && typeof (v as RetrievedId).id === "string");
}

async function buildViews(db: FilteredDbClient, proposals: ProposalRow[], epicRows: ProposalEpicRow[], viewerId: string): Promise<PlanProposal[]> {
  if (!proposals.length) return [];
  const ids = proposals.flatMap((p) => storedRetrieved(((p.payload ?? {}) as Stored).retrieved));
  const candidateProjects = [...new Set([...proposals.map((p) => p.projectId), ...ids.map((r) => r.projectId)])];
  const memberships = await db.projectMember.findMany({ where: { userId: viewerId, projectId: { in: candidateProjects } } });
  const memberOf = [...new Set(memberships.map((m) => m.projectId))];
  const projects = ids.length ? await db.project.findMany({ where: { id: { in: memberOf } } }) : [];
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const visible = ids.filter((r) => names.has(r.projectId));
  const epicIds = visible.filter((r) => r.source === "EPIC").map((r) => r.id);
  const taskIds = visible.filter((r) => r.source === "TASK").map((r) => r.id);
  const [epics, tasks] = await Promise.all([
    epicIds.length ? db.epic.findMany({ where: { id: { in: epicIds }, projectId: { in: memberOf } } }) : Promise.resolve([]),
    taskIds.length ? db.task.findMany({ where: { id: { in: taskIds }, projectId: { in: memberOf } } }) : Promise.resolve([]),
  ]);
  const titles = new Map<string, { projectId: string; title: string }>([
    ...epics.map((e) => [`EPIC:${e.id}`, { projectId: e.projectId, title: e.title }] as const),
    ...tasks.map((t) => [`TASK:${t.id}`, { projectId: t.projectId, title: t.title }] as const),
  ]);
  const now = new Date();
  return proposals.filter((p) => memberOf.includes(p.projectId)).map((proposal) => {
    const payload = (proposal.payload ?? {}) as Stored;
    const retrieved: PlanProposal["retrieved"] = [];
    for (const r of storedRetrieved(payload.retrieved)) {
      const found = titles.get(`${r.source}:${r.id}`);
      if (!names.has(r.projectId) || !found || found.projectId !== r.projectId || found.title.length === 0) continue;
      retrieved.push({ source: r.source, projectId: r.projectId, projectName: names.get(r.projectId)!, id: r.id, title: found.title });
    }
    return {
      id: proposal.id, projectId: proposal.projectId, kind: "PLAN", status: proposal.status, approach: typeof payload.approach === "string" ? payload.approach : "",
      checkpoints: (Array.isArray(payload.checkpoints) ? payload.checkpoints : []) as PlanProposal["checkpoints"],
      epics: epicRows.filter((row) => row.proposalId === proposal.id).map((row) => toPlanEpic(row, now)), retrieved, flagged: proposal.flagged, createdBy: proposal.createdBy,
      createdAt: proposal.createdAt.toISOString(), updatedAt: proposal.updatedAt.toISOString(), version: proposal.version,
    };
  });
}

/** Reads a plan proposal; retrieved titles and project names are looked up per viewer (member projects only). */
export async function getProposalView(db: FilteredDbClient, proposalId: string, viewerId: string): Promise<PlanProposal | null> {
  const [proposal, epicRows] = await Promise.all([
    db.aiProposal.findFirst({ where: { id: proposalId } }),
    db.proposalEpic.findMany({ where: { proposalId }, orderBy: { index: "asc" } }),
  ]);
  return proposal ? (await buildViews(db, [proposal], epicRows, viewerId))[0] ?? null : null;
}

export async function listProposals(db: FilteredDbClient, i: { projectId: string; viewerId: string; status?: "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED"; page: number; size: number }): Promise<{ items: PlanProposal[]; page: number; size: number; total: number } | null> {
  const member = await db.projectMember.findFirst({ where: { userId: i.viewerId, projectId: i.projectId } });
  if (!member) return null;
  const where = { projectId: i.projectId, kind: "PLAN" as const, ...(i.status ? { status: i.status } : {}) };
  const total = await db.aiProposal.count({ where });
  const proposals = await db.aiProposal.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: i.page * i.size, take: i.size });
  const epicRows = proposals.length ? await db.proposalEpic.findMany({ where: { proposalId: { in: proposals.map((p) => p.id) } }, orderBy: { index: "asc" } }) : [];
  const items = await buildViews(db, proposals, epicRows, i.viewerId);
  return { items, page: i.page, size: i.size, total };
}
