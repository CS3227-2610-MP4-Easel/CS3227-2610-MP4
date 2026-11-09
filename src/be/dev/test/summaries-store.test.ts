import assert from "node:assert/strict";
import test from "node:test";
import { currentSummaries, insertSummaries, loadOwnItems, summaryFlagged } from "../src/store/summaries.js";

const key = { guardVersion: "g1", promptVersion: "v1" };
const items = [
  { id: "a", uploadedBy: "u1", projectId: "p", contentHash: "ha", flagged: false, occurredAt: new Date(0) },
  { id: "b", uploadedBy: "u2", projectId: "p", contentHash: "hb", flagged: true, occurredAt: new Date(0) },
  { id: "c", uploadedBy: "u1", projectId: "q", contentHash: "hc", flagged: false, occurredAt: new Date(0) },
  { id: "d", uploadedBy: "u1", projectId: "p", contentHash: "hd", flagged: true, occurredAt: new Date(0) },
];
const sums = [
  { id: "s1", itemId: "a", contentHash: "ha", guardVersion: "g1", promptVersion: "v1", oneLiner: "x", flagged: false },
  { id: "s2", itemId: "d", contentHash: "old", guardVersion: "g1", promptVersion: "v1", oneLiner: "y", flagged: true },
  { id: "s3", itemId: "b", contentHash: "hb", guardVersion: "g1", promptVersion: "v1", oneLiner: "z", flagged: true },
  { id: "s4", itemId: "a", contentHash: "ha", guardVersion: "g0", promptVersion: "v1", oneLiner: "w", flagged: true },
];
const inSet = (v: unknown, c: any) => (c && typeof c === "object" && "in" in c ? c.in.includes(v) : v === c);
const db = {
  activityItem: { findMany: async ({ where }: any) => items.filter((r) => Object.entries(where).every(([k, c]) => inSet((r as any)[k], c))) },
  itemSummary: { findMany: async ({ where }: any) => sums.filter((r) => Object.entries(where).every(([k, c]) => inSet((r as any)[k], c))) },
};

test("loadOwnItems returns the caller's items in itemIds order", async () => {
  const rows = await loadOwnItems(db, "u1", "p", ["d", "a"]);
  assert.deepEqual(rows.map((r) => r.id), ["d", "a"]);
});

test("loadOwnItems throws NOT_FOUND for foreign, other-project and missing ids alike", async () => {
  for (const id of ["b", "c", "zzz"]) await assert.rejects(loadOwnItems(db, "u1", "p", ["a", id]), { message: "NOT_FOUND" });
});

test("currentSummaries matches contentHash, guardVersion and promptVersion", async () => {
  const m = await currentSummaries(db, [{ id: "a", contentHash: "ha" }, { id: "d", contentHash: "hd" }], key);
  assert.deepEqual([...m.keys()], ["a"]);
  assert.deepEqual(m.get("a"), { id: "s1", oneLiner: "x", flagged: false });
});

test("summaryFlagged is true only for the caller's own flagged summaries", async () => {
  assert.equal(await summaryFlagged(db, "u1", ["s1"]), false);
  assert.equal(await summaryFlagged(db, "u1", ["s1", "s2"]), true);
  assert.equal(await summaryFlagged(db, "u1", ["s3"]), false);
  assert.equal(await summaryFlagged(db, "u1", []), false);
});

test("insertSummaries writes createMany with skipDuplicates and the key through one write", async () => {
  const calls: any[] = [];
  const tx = {
    project: { update: async () => ({}), findFirst: async () => ({ status: "ACTIVE" }) },
    itemSummary: { createMany: async (a: unknown) => { calls.push(a); } },
  };
  const deps = { db: { $transaction: async (fn: any) => fn(tx) } as never, requireMember: async () => {} };
  await insertSummaries(deps, "u1", "p", [{ itemId: "a", contentHash: "ha", oneLiner: "x", flagged: false, callId: "c1" }], key);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].skipDuplicates, true);
  assert.deepEqual(calls[0].data, [{ itemId: "a", contentHash: "ha", oneLiner: "x", flagged: false, callId: "c1", guardVersion: "g1", promptVersion: "v1" }]);
});

test("insertSummaries on an archived project rejects CONFLICT_STATE without writing", async () => {
  let wrote = 0;
  const tx = { project: { update: async () => ({}), findFirst: async () => ({ status: "ARCHIVED" }) }, itemSummary: { createMany: async () => { wrote++; } } };
  const deps = { db: { $transaction: async (fn: any) => fn(tx) } as never, requireMember: async () => {} };
  await assert.rejects(insertSummaries(deps, "u1", "p", [{ itemId: "a", contentHash: "ha", oneLiner: "x", flagged: false, callId: "c1" }], key), { message: "CONFLICT_STATE" });
  assert.equal(wrote, 0);
});
