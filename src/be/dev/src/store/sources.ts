import { registerContextSource, type ContextRow, type ContextSource } from "@agile/ai-context";
import { currentSummaries, type Key } from "./summaries.js";

type Item = { id: string; itemType: string; repo: string; title: string; body: string | null; files: unknown; occurredAt: Date; contentHash: string };
type Db = { activityItem: { findMany(args: unknown): Promise<any[]> } };

const oneLine = (s: string) => s.replace(/[\r\n\u2028\u2029]/g, " ");

export function createDevContextSources(db: unknown, key: Key): { activityItems: ContextSource; itemSummaries: ContextSource } {
  const d = db as Db;
  const activityItems: ContextSource = async ({ caller, projectId, options }) => {
    const ids = options.itemIds ?? [];
    if (!ids.length) return [];
    const rows: Item[] = await d.activityItem.findMany({ where: { id: { in: ids }, projectId, uploadedBy: caller.userId }, select: { id: true, itemType: true, repo: true, title: true, body: true, files: true, occurredAt: true, contentHash: true } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const out: ContextRow[] = [];
    ids.forEach((id, i) => {
      const r = byId.get(id);
      if (!r) return;
      const files = Array.isArray(r.files) ? (r.files as string[]) : [];
      const text = `n=${i + 1} ${r.itemType} ${r.repo || "-"} ${r.title}` + (r.body ? ` | ${r.body}` : "") + (files.length ? ` | files: ${files.join(", ")}` : "");
      out.push({ projectId, ref: { type: "ACTIVITY_ITEM", id }, ownerId: caller.userId, text: [...oneLine(text)].slice(0, 900).join("") });
    });
    return out;
  };
  const itemSummaries: ContextSource = async ({ caller, projectId, options }) => {
    const w = options.window;
    if (!w) return [];
    const items: Item[] = await d.activityItem.findMany({ where: { projectId, uploadedBy: caller.userId, occurredAt: { gte: w.from, lt: w.to } }, select: { id: true, occurredAt: true, contentHash: true } });
    const current = await currentSummaries(db, items, key);
    return items.filter((i) => current.has(i.id))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, 100)
      .map((i) => { const s = current.get(i.id)!; return { projectId, ref: { type: "ITEM_SUMMARY", id: s.id }, ownerId: caller.userId, text: oneLine(s.oneLiner) } satisfies ContextRow; });
  };
  return { activityItems, itemSummaries };
}

export function registerDevContextSources(db: unknown, key: Key, register: typeof registerContextSource = registerContextSource): void {
  const s = createDevContextSources(db, key);
  register("dev.activityItems", s.activityItems);
  register("dev.itemSummaries", s.itemSummaries);
}
