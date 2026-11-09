import { inDevWrite, type DevWriteDeps } from "./writable.js";

export type Key = { guardVersion: string; promptVersion: string };
export type OwnItem = { id: string; contentHash: string; flagged: boolean; occurredAt: Date };
export type SummaryRow = { itemId: string; contentHash: string; oneLiner: string; flagged: boolean; callId: string };

type Read = { findMany(args: unknown): Promise<any[]> };
type SummaryDb = { activityItem: Read; itemSummary: Read };

export async function loadOwnItems(db: unknown, userId: string, projectId: string, itemIds: string[]): Promise<OwnItem[]> {
  const rows: OwnItem[] = await (db as SummaryDb).activityItem.findMany({ where: { id: { in: itemIds }, projectId, uploadedBy: userId }, select: { id: true, contentHash: true, flagged: true, occurredAt: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return itemIds.map((id) => { const row = byId.get(id); if (!row) throw new Error("NOT_FOUND"); return row; });
}

export async function currentSummaries(db: unknown, items: { id: string; contentHash: string }[], key: Key): Promise<Map<string, { id: string; oneLiner: string; flagged: boolean }>> {
  const out = new Map<string, { id: string; oneLiner: string; flagged: boolean }>();
  if (!items.length) return out;
  const rows: { id: string; itemId: string; contentHash: string; oneLiner: string; flagged: boolean }[] = await (db as SummaryDb).itemSummary.findMany({
    where: { itemId: { in: items.map((i) => i.id) }, guardVersion: key.guardVersion, promptVersion: key.promptVersion },
    select: { id: true, itemId: true, contentHash: true, oneLiner: true, flagged: true },
  });
  const hash = new Map(items.map((i) => [i.id, i.contentHash]));
  for (const r of rows) if (hash.get(r.itemId) === r.contentHash) out.set(r.itemId, { id: r.id, oneLiner: r.oneLiner, flagged: r.flagged });
  return out;
}

export async function insertSummaries(deps: DevWriteDeps, userId: string, projectId: string, rows: SummaryRow[], key: Key): Promise<void> {
  if (!rows.length) return;
  await inDevWrite(deps, userId, projectId, async (tx) => {
    const data = rows.map((r) => ({ itemId: r.itemId, contentHash: r.contentHash, oneLiner: r.oneLiner, flagged: r.flagged, callId: r.callId, guardVersion: key.guardVersion, promptVersion: key.promptVersion }));
    await (tx as { itemSummary: { createMany(args: unknown): Promise<unknown> } }).itemSummary.createMany({ data, skipDuplicates: true });
  });
}

export async function summaryFlagged(db: unknown, userId: string, summaryIds: string[]): Promise<boolean> {
  if (!summaryIds.length) return false;
  const d = db as SummaryDb;
  const summaries: { itemId: string; flagged: boolean }[] = await d.itemSummary.findMany({ where: { id: { in: summaryIds } }, select: { itemId: true, flagged: true } });
  const flagged = summaries.filter((s) => s.flagged);
  if (!flagged.length) return false;
  const own: { id: string }[] = await d.activityItem.findMany({ where: { id: { in: flagged.map((s) => s.itemId) }, uploadedBy: userId }, select: { id: true } });
  return own.length > 0;
}
