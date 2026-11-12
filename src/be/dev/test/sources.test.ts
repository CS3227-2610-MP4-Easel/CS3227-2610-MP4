import assert from "node:assert/strict";
import test from "node:test";
import { createDevContextSources, registerDevContextSources } from "../src/store/sources.js";

const P = "p1";
const key = { guardVersion: "g1", promptVersion: "v1" };
type Item = { id: string; uploadedBy: string; projectId: string; itemType: string; repo: string; title: string; body: string | null; files: string[]; occurredAt: Date; contentHash: string };
type Sum = { id: string; itemId: string; contentHash: string; guardVersion: string; promptVersion: string; oneLiner: string; flagged: boolean };

const item = (id: string, over: Partial<Item> = {}): Item => ({ id, uploadedBy: "u1", projectId: P, itemType: "COMMIT", repo: "", title: `t-${id}`, body: null, files: [], occurredAt: new Date("2026-11-09T00:00:00Z"), contentHash: `h-${id}`, ...over });

const calls: any[] = [];
function fake(items: Item[], sums: Sum[] = []) {
  const match = (row: Record<string, unknown>, where: Record<string, any>) => Object.entries(where).every(([k, c]) => {
    const v = row[k];
    if (c && typeof c === "object" && !(c instanceof Date)) {
      if ("in" in c) return c.in.includes(v);
      if ("gte" in c || "lt" in c) return (!c.gte || (v as Date) >= c.gte) && (!c.lt || (v as Date) < c.lt);
    }
    return v === c;
  });
  return {
    activityItem: { findMany: async (a: any) => { calls.push(a); const r = items.filter((x) => match(x, a.where)); if (a.orderBy) r.sort((x, y) => y.occurredAt.getTime() - x.occurredAt.getTime() || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)); return a.take ? r.slice(0, a.take) : r; } },
    itemSummary: { findMany: async ({ where }: any) => sums.filter((r) => match(r, where)) },
  };
}
const caller = { userId: "u1", role: "DEVELOPER" as const };
const sum = (id: string, it: Item, over: Partial<Sum> = {}): Sum => ({ id, itemId: it.id, contentHash: it.contentHash, guardVersion: "g1", promptVersion: "v1", oneLiner: `line ${id}`, flagged: false, ...over });

test("E43 another user's item id yields no row; k numbers the position in itemIds", async () => {
  const db = fake([item("a"), item("b", { uploadedBy: "u2" }), item("c")]);
  const rows = await createDevContextSources(db, key).activityItems({ caller, projectId: P, options: { itemIds: ["c", "b", "a"] } });
  assert.deepEqual(rows.map((r) => r.ref.id), ["c", "a"]);
  assert.match(rows[0]!.text, /^n=1 COMMIT - t-c$/);
  assert.match(rows[1]!.text, /^n=3 COMMIT - t-a$/);
  assert.equal(rows[0]!.ownerId, "u1");
  assert.equal(rows[0]!.ref.type, "ACTIVITY_ITEM");
});

test("dev.activityItems is empty without itemIds and ignores other projects", async () => {
  const db = fake([item("a", { projectId: "other" })]);
  const s = createDevContextSources(db, key).activityItems;
  assert.deepEqual(await s({ caller, projectId: P, options: {} }), []);
  assert.deepEqual(await s({ caller, projectId: P, options: { itemIds: ["a"] } }), []);
});

test("activity row is one line and at most 900 code points", async () => {
  const db = fake([item("a", { repo: "r", body: "x\r\ny\nz\u2028w\u2029" + "😀".repeat(2000), files: ["f1", "f2"] })]);
  const [row] = await createDevContextSources(db, key).activityItems({ caller, projectId: P, options: { itemIds: ["a"] } });
  assert.doesNotMatch(row!.text, /[\r\n\u2028\u2029]/);
  assert.equal([...row!.text].length, 900);
  assert.ok(row!.text.startsWith("n=1 COMMIT r t-a | x  y z w "));
  const small = fake([item("b", { body: "bd", files: ["f1", "f2"] })]);
  const [r2] = await createDevContextSources(small, key).activityItems({ caller, projectId: P, options: { itemIds: ["b"] } });
  assert.equal(r2!.text, "n=1 COMMIT - t-b | bd | files: f1, f2");
});

test("E42 itemSummaries: window bounds, newest first, caller only, current only", async () => {
  const from = new Date("2026-11-08T00:00:00Z"), to = new Date("2026-11-09T00:00:00Z");
  const a = item("a", { occurredAt: from }), b = item("b", { occurredAt: new Date("2026-11-08T12:00:00Z") }), c = item("c", { occurredAt: to });
  const d = item("d", { occurredAt: new Date("2026-11-08T13:00:00Z"), uploadedBy: "u2" });
  const e = item("e", { occurredAt: new Date("2026-11-08T14:00:00Z") });
  const f = item("f", { occurredAt: new Date("2026-11-08T15:00:00Z") });
  const db = fake([a, b, c, d, e, f], [sum("sa", a), sum("sb", b), sum("sc", c), sum("sd", d), sum("se", e, { contentHash: "stale" }), sum("sf", f, { promptVersion: "v0" })]);
  const rows = await createDevContextSources(db, key).itemSummaries({ caller, projectId: P, options: { window: { from, to } } });
  assert.deepEqual(rows.map((r) => r.ref.id), ["sb", "sa"]);
  assert.equal(rows[0]!.ref.type, "ITEM_SUMMARY");
  assert.equal(rows[0]!.text, "line sb");
  assert.deepEqual(await createDevContextSources(db, key).itemSummaries({ caller, projectId: P, options: {} }), []);
});

test("E42 itemSummaries caps at 100 and makes one-liners one line", async () => {
  const items = Array.from({ length: 120 }, (_, i) => item(`i${String(i).padStart(3, "0")}`, { occurredAt: new Date(Date.UTC(2026, 10, 8, 0, 0, i)) }));
  const sums = items.map((it, i) => sum(`s${i}`, it, { oneLiner: "a\nb" }));
  const rows = await createDevContextSources(fake(items, sums), key).itemSummaries({ caller, projectId: P, options: { window: { from: new Date("2026-11-08T00:00:00Z"), to: new Date("2026-11-09T00:00:00Z") } } });
  assert.equal(rows.length, 100);
  assert.equal(rows[0]!.ref.id, "s119");
  assert.equal(rows[0]!.text, "a b");
});

const wide = { window: { from: new Date(0), to: new Date("2027-01-01T00:00:00Z") } };

test("E42 itemSummaries omits an in-window current summary of another project", async () => {
  const a = item("a", { projectId: "other" }), b = item("b");
  const rows = await createDevContextSources(fake([a, b], [sum("sa", a), sum("sb", b)]), key).itemSummaries({ caller, projectId: P, options: wide });
  assert.deepEqual(rows.map((r) => r.ref.id), ["sb"]);
});

test("E42 itemSummaries orders equal occurredAt ties by item id ascending", async () => {
  const items = [item("c"), item("a"), item("b")];
  const rows = await createDevContextSources(fake(items, items.map((it) => sum(`s-${it.id}`, it))), key).itemSummaries({ caller, projectId: P, options: wide });
  assert.deepEqual(rows.map((r) => r.ref.id), ["s-a", "s-b", "s-c"]);
});

test("E42 itemSummaries scan is ordered newest first and capped at 500", async () => {
  calls.length = 0;
  await createDevContextSources(fake([]), key).itemSummaries({ caller, projectId: P, options: wide });
  assert.deepEqual(calls[0].orderBy, [{ occurredAt: "desc" }, { id: "asc" }]);
  assert.equal(calls[0].take, 500);
});

test("E43 uppercase ids in itemIds still yield rows in request order", async () => {
  const rows = await createDevContextSources(fake([item("a"), item("b")]), key).activityItems({ caller, projectId: P, options: { itemIds: ["B", "A"] } });
  assert.deepEqual(rows.map((r) => r.ref.id), ["b", "a"]);
  assert.match(rows[0]!.text, /^n=1 /);
  assert.match(rows[1]!.text, /^n=2 /);
});

test("one-line rows also replace VT, FF and NEL", async () => {
  const body = ["x", "y", "z", "w"].join("\v").replace("z", "z" + String.fromCharCode(0x85) + "q").replace("y", "y\f");
  const [row] = await createDevContextSources(fake([item("a", { body })]), key).activityItems({ caller, projectId: P, options: { itemIds: ["a"] } });
  assert.equal(row!.text, "n=1 COMMIT - t-a | x y  z q w");
});

test("registerDevContextSources binds each function to the right id", async () => {
  const seen = new Map<string, any>();
  registerDevContextSources(fake([]), key, ((id: string, fn: unknown) => { seen.set(id, fn); }) as never);
  assert.deepEqual([...seen.keys()], ["dev.activityItems", "dev.itemSummaries"]);
  calls.length = 0;
  await seen.get("dev.itemSummaries")({ caller, projectId: P, options: wide });
  assert.equal(calls[0].take, 500);
  calls.length = 0;
  await seen.get("dev.activityItems")({ caller, projectId: P, options: { itemIds: ["a"] } });
  assert.equal(calls[0].take, undefined);
});
