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

function storedRetrieved(value: unknown): RetrievedId[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is RetrievedId => !!v && typeof v === "object"
    && typeof (v as RetrievedId).source === "string" && typeof (v as RetrievedId).projectId === "string" && typeof (v as RetrievedId).id === "string");
}

/** Reads a plan proposal; retrieved titles and project names are looked up per viewer (member projects only). */
export async function getProposalView(db: FilteredDbClient, proposalId: string, viewerId: string): Promise<PlanProposal | null> {
  const [proposal, epicRows] = await Promise.all([
    db.aiProposal.findFirst({ where: { id: proposalId } }),
    db.proposalEpic.findMany({ where: { proposalId }, orderBy: { index: "asc" } }),
  ]);
  if (!proposal) return null;
  const payload = (proposal.payload ?? {}) as Stored;
  const ids = storedRetrieved(payload.retrieved);
  const candidateProjects = [...new Set([proposal.projectId, ...ids.map((r) => r.projectId)])];
  const memberships = await db.projectMember.findMany({ where: { userId: viewerId, projectId: { in: candidateProjects } } });
  if (!memberships.some((m) => m.projectId === proposal.projectId)) return null;
  const retrieved: PlanProposal["retrieved"] = [];
  if (ids.length > 0) {
    const memberOf = [...new Set(memberships.map((m) => m.projectId))];
    if (memberOf.length > 0) {
      const projects = await db.project.findMany({ where: { id: { in: memberOf } } });
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
      for (const r of visible) {
        const found = titles.get(`${r.source}:${r.id}`);
        if (!found || found.projectId !== r.projectId || found.title.length === 0) continue; // unresolved or mismatched: omit
        retrieved.push({ source: r.source, projectId: r.projectId, projectName: names.get(r.projectId)!, id: r.id, title: found.title });
      }
    }
  }
  const now = new Date();
  return {
    id: proposal.id, projectId: proposal.projectId, kind: "PLAN", status: proposal.status, approach: typeof payload.approach === "string" ? payload.approach : "",
    checkpoints: (Array.isArray(payload.checkpoints) ? payload.checkpoints : []) as PlanProposal["checkpoints"],
    epics: epicRows.map((row) => toPlanEpic(row, now)), retrieved, flagged: proposal.flagged, createdBy: proposal.createdBy,
    createdAt: proposal.createdAt.toISOString(), updatedAt: proposal.updatedAt.toISOString(), version: proposal.version,
  };
}
