import type { Standup } from "@agile/contracts";
import { inDevWrite, type DevWriteDeps } from "./writable.js";

type Row = { id: string; projectId: string; developerId: string; standupDate: Date; content: unknown; degraded: boolean; flagged: boolean; inputHash: string; sessionId: string; outcome: string | null; feedback: string | null; createdAt: Date; updatedAt: Date; version: number };
type StandupDb = { standup: { findFirst(args: unknown): Promise<Row | null>; findMany(args: unknown): Promise<Row[]>; count(args: unknown): Promise<number> } };

const dateOf = (date: string) => new Date(`${date}T00:00:00Z`);

export async function findStandup(db: unknown, projectId: string, developerId: string, date: string): Promise<Row | null> {
  return (db as StandupDb).standup.findFirst({ where: { projectId, developerId, standupDate: dateOf(date) } });
}

export async function upsertStandup(deps: DevWriteDeps, userId: string, projectId: string, date: string, v: { content: unknown; inputHash: string; degraded: boolean; flagged: boolean; sessionId: string }): Promise<Row> {
  return inDevWrite(deps, userId, projectId, async (tx) => {
    const fields = { content: v.content, inputHash: v.inputHash, degraded: v.degraded, flagged: v.flagged, sessionId: v.sessionId };
    return (tx as { standup: { upsert(args: unknown): Promise<Row> } }).standup.upsert({
      where: { projectId_developerId_standupDate: { projectId, developerId: userId, standupDate: dateOf(date) } },
      create: { projectId, developerId: userId, standupDate: dateOf(date), ...fields, version: 1 },
      update: { ...fields, version: { increment: 1 } },
    });
  });
}

export function toStandup(row: Row, cached: boolean): Standup {
  return {
    id: row.id, projectId: row.projectId, developerId: row.developerId, date: row.standupDate.toISOString().slice(0, 10), content: row.content as Standup["content"],
    degraded: row.degraded, flagged: row.flagged, cached, outcome: row.outcome as Standup["outcome"], feedback: row.feedback as Standup["feedback"],
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), version: row.version,
  };
}

export function developerIds(members: { userId: string; role: string }[]): string[] {
  return members.filter((m) => m.role === "DEVELOPER").map((m) => m.userId);
}

export async function listLeadStandups(db: unknown, projectId: string, ids: string[], q: { date?: string; developerId?: string; page: number; size: number }): Promise<{ items: Standup[]; page: number; size: number; total: number }> {
  const d = db as StandupDb;
  const where = { projectId, developerId: { in: q.developerId ? ids.filter((id) => id === q.developerId) : ids }, ...(q.date && { standupDate: dateOf(q.date) }) };
  const rows = await d.standup.findMany({ where, orderBy: [{ standupDate: "desc" }, { developerId: "asc" }, { id: "asc" }], skip: q.page * q.size, take: q.size });
  const total = await d.standup.count({ where });
  return { items: rows.map((r) => toStandup(r, false)), page: q.page, size: q.size, total };
}
