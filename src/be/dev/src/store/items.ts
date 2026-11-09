import { createHash } from "node:crypto";
import { ActivityItemInputSchema, defaultStandupDate, standupActivityWindowFor, type UploadResponse } from "@agile/contracts";
import { inDevWrite, type DevWriteDeps } from "./writable.js";

export type UploadDeps = DevWriteDeps & { sanitiseFlag(text: string): boolean; currentKey: { guardVersion: string; promptVersion: string }; now(): Date };

export type ValidItem = { type: "COMMIT" | "PR"; repo: string; externalId: string; title: string; body: string | null; bodyTruncated: boolean; occurredAt: Date; url: string | null; files: string[]; contentHash: string };
export type ValidateResult = { ok: true; item: ValidItem } | { ok: false; reason: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const wellFormed = (s: string) => (s as string & { isWellFormed(): boolean }).isWellFormed();
const KNOWN_KEYS = new Set(["type", "repo", "externalId", "title", "body", "timestamp", "url", "files", "projectId", "uploadedBy", "id", "author"]);
const MIN_TIME = Date.parse("2000-01-01T00:00:00Z");
const bad = (path: string): ValidateResult => ({ ok: false, reason: `${path}: invalid` });

export function validateItem(raw: unknown, now: Date): ValidateResult {
  let input = raw;
  let truncated = false;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as { body?: unknown }).body === "string" && (raw as { body: string }).body.length > 2000) {
    const body = (raw as { body: string }).body;
    const high = (body.charCodeAt(1999) & 0xfc00) === 0xd800;
    input = { ...(raw as object), body: body.slice(0, high ? 1999 : 2000) };
    truncated = true;
  }
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const o = input as Record<string, unknown>;
    for (const k of ["type", "repo", "externalId", "title", "body", "timestamp", "url"]) if (typeof o[k] === "string" && !wellFormed(o[k] as string)) return bad(k);
    if (Array.isArray(o.files)) for (let i = 0; i < o.files.length; i++) if (typeof o.files[i] === "string" && !wellFormed(o.files[i] as string)) return bad(`files.${i}`);
  }
  const parsed = ActivityItemInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const first = issue.code === "unrecognized_keys" ? String(issue.keys[0]) : null;
    const path = first !== null ? (KNOWN_KEYS.has(first) ? first : "item") : issue.path.join(".") || "item";
    return bad(path);
  }
  const v = parsed.data;
  const occurredAt = new Date(v.timestamp);
  const at = occurredAt.getTime();
  if (Number.isNaN(at) || at < MIN_TIME || at > now.getTime() + DAY_MS) return bad("timestamp");
  const repo = v.repo || "";
  const body = v.body ?? null;
  const url = v.url ?? null;
  const contentHash = createHash("sha256").update(JSON.stringify([v.type, repo || null, v.externalId, v.title, body, occurredAt.toISOString(), url, v.files])).digest("hex");
  return { ok: true, item: { type: v.type, repo, externalId: v.externalId, title: v.title, body, bodyTruncated: truncated, occurredAt, url, files: v.files, contentHash } };
}

type Existing = { id: string; itemType: string; repo: string; externalId: string; contentHash: string; flagged: boolean; bodyTruncated: boolean };
type Tx = {
  activityItem: { findMany(args: unknown): Promise<Existing[]>; upsert(args: unknown): Promise<{ id: string }> };
  itemSummary: { findMany(args: unknown): Promise<{ itemId: string; contentHash: string }[]> };
};

export async function uploadItems(deps: UploadDeps, userId: string, projectId: string, items: unknown[]): Promise<UploadResponse> {
  const now = deps.now();
  const rejected: { index: number; reason: string }[] = [];
  const valid: { item: ValidItem; flagged: boolean }[] = [];
  const seen = new Set<string>();
  items.forEach((raw, index) => {
    const r = validateItem(raw, now);
    if (!r.ok) { rejected.push({ index, reason: r.reason }); return; }
    const { item } = r;
    const key = JSON.stringify([item.type, item.repo, item.externalId]);
    if (seen.has(key)) { rejected.push({ index, reason: "duplicate" }); return; }
    seen.add(key);
    valid.push({ item, flagged: deps.sanitiseFlag(item.title + "\n" + (item.body ?? "") + "\n" + item.files.join("\n")) || item.bodyTruncated });
  });
  if (valid.length === 0) return { received: items.length, created: 0, updated: 0, unchanged: 0, rejected, needsSummary: [] };
  const windowStart = standupActivityWindowFor(defaultStandupDate(now), now).from;
  const { guardVersion, promptVersion } = deps.currentKey;

  return inDevWrite(deps, userId, projectId, async (raw) => {
    const tx = raw as Tx;
    let created = 0, updated = 0, unchanged = 0;
    const existing = await tx.activityItem.findMany({
      where: { projectId, uploadedBy: userId, OR: valid.map(({ item }) => ({ itemType: item.type, repo: item.repo, externalId: item.externalId })) },
      select: { id: true, itemType: true, repo: true, externalId: true, contentHash: true, flagged: true, bodyTruncated: true },
    });
    const byKey = new Map(existing.map((e) => [JSON.stringify([e.itemType, e.repo, e.externalId]), e]));
    const stored: { id: string; hash: string; occurredAt: Date }[] = [];
    for (const { item, flagged } of valid) {
      const row = byKey.get(JSON.stringify([item.type, item.repo, item.externalId]));
      const fields = { title: item.title, body: item.body, bodyTruncated: item.bodyTruncated, occurredAt: item.occurredAt, url: item.url, files: item.files, contentHash: item.contentHash, flagged };
      const where = { projectId_uploadedBy_itemType_repo_externalId: { projectId, uploadedBy: userId, itemType: item.type, repo: item.repo, externalId: item.externalId } };
      const create = { projectId, uploadedBy: userId, itemType: item.type, repo: item.repo, externalId: item.externalId, ...fields };
      if (row && row.contentHash === item.contentHash) {
        if (row.flagged !== flagged || row.bodyTruncated !== item.bodyTruncated) await tx.activityItem.upsert({ where, create, update: { flagged, bodyTruncated: item.bodyTruncated } });
        unchanged++; stored.push({ id: row.id, hash: item.contentHash, occurredAt: item.occurredAt }); continue;
      }
      const saved = await tx.activityItem.upsert({ where, create, update: fields });
      if (row) updated++; else created++;
      stored.push({ id: saved.id, hash: item.contentHash, occurredAt: item.occurredAt });
    }
    const inWindow = stored.filter((s) => s.occurredAt >= windowStart);
    let needsSummary: string[] = [];
    if (inWindow.length) {
      const done = await tx.itemSummary.findMany({ where: { itemId: { in: inWindow.map((s) => s.id) }, guardVersion, promptVersion }, select: { itemId: true, contentHash: true } });
      const have = new Set(done.map((d) => `${d.itemId}|${d.contentHash}`));
      needsSummary = inWindow.filter((s) => !have.has(`${s.id}|${s.hash}`))
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((s) => s.id);
    }
    return { received: items.length, created, updated, unchanged, rejected, needsSummary };
  });
}
