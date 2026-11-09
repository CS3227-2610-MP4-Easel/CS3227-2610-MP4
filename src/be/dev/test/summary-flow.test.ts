import assert from "node:assert/strict";
import test from "node:test";
import { NotMember, type LlmCall, type LlmResult } from "@agile/contracts";
import { isInTransaction } from "@agile/db";
import { createAiContext } from "@agile/ai-context/testing";
import { createLlmGateway, createMockProvider, SessionCapReached, type MockRespond } from "@agile/llm-gateway";
import { DevError } from "../src/errors.js";
import { generateSummaries, type SummaryFlowDeps } from "../src/flows/summaries.js";
import { SUMMARY_PROMPT_VERSION } from "../src/ai/prompts.js";
import { sha256Hex } from "../src/ai/hash.js";
import { createDevContextSources } from "../src/store/sources.js";
import { fakeClock, fakeGatewayDb, fakeHit, fakeSessions, testSettings } from "../../llm-gateway/test/fakes.js";

const U = "00000000-0000-4000-8000-0000000000a1";
const P = "00000000-0000-4000-8000-0000000000c1";
const SESSION = "00000000-0000-4000-8000-0000000000b1";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NOW = new Date("2026-11-09T04:00:00Z");
const RECENT = new Date("2026-11-09T01:00:00Z");
const OLD = new Date("2026-11-01T01:00:00Z");
const key = { guardVersion: "g1", promptVersion: "v1" };
const caller = { userId: U, role: "DEVELOPER" as const };

type Item = { id: string; uploadedBy: string; projectId: string; itemType: string; repo: string; title: string; body: string | null; files: string[]; occurredAt: Date; contentHash: string; flagged: boolean };
type Sum = { id: string; itemId: string; contentHash: string; guardVersion: string; promptVersion: string; oneLiner: string; flagged: boolean; callId?: string };
const item = (n: number, over: Partial<Item> = {}): Item => ({ id: id(n), uploadedBy: U, projectId: P, itemType: "COMMIT", repo: "", title: `title ${n}`, body: null, files: [], occurredAt: RECENT, contentHash: `h${n}`, flagged: false, ...over });
const sum = (n: number, over: Partial<Sum> = {}): Sum => ({ id: `s${n}`, itemId: id(n), contentHash: `h${n}`, guardVersion: "g1", promptVersion: "v1", oneLiner: `cached ${n}`, flagged: false, ...over });

function world(items: Item[], sums: Sum[] = [], opts: { removed?: boolean } = {}) {
  const match = (row: Record<string, unknown>, where: Record<string, any>) => Object.entries(where).every(([k, c]) => {
    const v = row[k];
    if (c && typeof c === "object" && !(c instanceof Date)) {
      if ("in" in c) return c.in.includes(v);
      if ("gte" in c || "lt" in c) return (!c.gte || (v as Date) >= c.gte) && (!c.lt || (v as Date) < c.lt);
    }
    return v === c;
  });
  const reads = {
    activityItem: { findMany: async (a: any) => items.filter((x) => match(x, a.where)) },
    itemSummary: { findMany: async ({ where }: any) => sums.filter((r) => match(r, where)) },
  };
  const state = { transactions: 0, inserted: [] as any[], events: [] as string[], insertInTx: [] as boolean[] };
  const tx = {
    project: { update: async () => ({}), findFirst: async () => ({ status: "ACTIVE" }) },
    activityItem: reads.activityItem,
    itemSummary: { createMany: async ({ data }: any) => { state.insertInTx.push(isInTransaction()); state.inserted.push(...data); } },
  };
  const write = { db: { $transaction: async (fn: any) => { state.transactions++; state.events.push("tx"); return fn(tx); } } as never, requireMember: async () => { if (opts.removed) throw new NotMember(); } };
  return { reads, write, state };
}

function stubs(w: ReturnType<typeof world>, over: Partial<SummaryFlowDeps> & { reply?: LlmResult | (() => Promise<LlmResult>) } = {}) {
  const log = { opens: 0, openArgs: [] as any[], runs: [] as LlmCall[], hits: [] as any[], assembled: [] as any[] };
  const reply = over.reply ?? { ok: true, value: { items: [] }, callId: id(900), flagged: false, truncated: false, cacheHit: false, promptTokens: 1, completionTokens: 1, costMicroUsd: 0 };
  const deps: SummaryFlowDeps = {
    db: w.reads, write: w.write, key, now: () => NOW,
    ai: { assembleWith: async (_c, _f, _p, options) => { log.assembled.push(options); w.state.events.push("assemble"); return { sections: [{ name: "activity-items", kind: "DYNAMIC", priority: 1, budgetTokens: 10, trusted: false, text: "x" }], provenance: [] }; } },
    gateway: { run: async (call) => { log.runs.push(call); w.state.events.push("run"); return typeof reply === "function" ? reply() : reply; } },
    sessions: { openOrReuse: async (i) => { log.opens++; log.openArgs.push(i); w.state.events.push("open"); return SESSION; } },
    recordCacheHit: async (i) => { log.hits.push(i); w.state.events.push("hit"); },
    sanitiseFlag: (t) => t.includes("FLAG"),
    ...over,
  };
  return { deps, log };
}
const okValue = (items: { n: number; oneLiner: string }[]): LlmResult => ({ ok: true, value: { items }, callId: id(900), flagged: false, truncated: false, cacheHit: false, promptTokens: 1, completionTokens: 1, costMicroUsd: 0 });

test("E15 an id owned by another developer is NOT_FOUND with no session and no call", async () => {
  const w = world([item(1), item(2, { uploadedBy: "other" })]);
  const { deps, log } = stubs(w);
  await assert.rejects(generateSummaries(deps, caller, P, [id(1), id(2)]), { message: "NOT_FOUND" });
  assert.equal(log.opens, 0);
  assert.equal(log.runs.length, 0);
  assert.equal(log.assembled.length, 0);
  assert.equal(log.hits.length, 0);
  assert.equal(w.state.transactions, 0);
});

test("E67 an unknown UUID and another developer's id give an identical NOT_FOUND", async () => {
  const w = world([item(2, { uploadedBy: "other" })]);
  const { deps } = stubs(w);
  const a = await generateSummaries(deps, caller, P, [id(2)]).catch((e) => e);
  const b = await generateSummaries(deps, caller, P, [id(77)]).catch((e) => e);
  assert.equal(a.message, "NOT_FOUND");
  assert.equal(a.message, b.message);
  assert.equal(a.constructor, b.constructor);
});

test("E16 all ids cached: no session, no run, all cached, one recordCacheHit", async () => {
  const w = world([item(1), item(2, { occurredAt: OLD })], [sum(1), sum(2)]);
  const { deps, log } = stubs(w);
  const out = await generateSummaries(deps, caller, P, [id(1), id(2)]);
  assert.deepEqual(out, { summaries: [{ itemId: id(1), oneLiner: "cached 1", cached: true }, { itemId: id(2), oneLiner: "cached 2", cached: true }], failed: [] });
  assert.equal(log.opens, 0);
  assert.equal(log.runs.length, 0);
  assert.equal(log.hits.length, 1);
  assert.deepEqual(log.hits[0], { feature: "DEV_SUMMARY", caller, sessionId: null, projectId: P, inputHash: sha256Hex(JSON.stringify([[id(1), "h1"], [id(2), "h2"]])), promptVersion: SUMMARY_PROMPT_VERSION });
});

test("E21 an uncached item before the window is failed and not sent; with nothing else left there is no call", async () => {
  const w = world([item(1, { occurredAt: OLD })]);
  const { deps, log } = stubs(w);
  const out = await generateSummaries(deps, caller, P, [id(1)]);
  assert.deepEqual(out, { summaries: [], failed: [id(1)] });
  assert.equal(log.opens, 0);
  assert.equal(log.hits.length, 0);
  const w2 = world([item(1, { occurredAt: OLD }), item(2)]);
  const s2 = stubs(w2, { reply: okValue([{ n: 1, oneLiner: "two" }]) });
  const out2 = await generateSummaries(s2.deps, caller, P, [id(1), id(2)]);
  assert.deepEqual(s2.log.assembled, [{ itemIds: [id(2)] }]);
  assert.deepEqual(out2, { summaries: [{ itemId: id(2), oneLiner: "two", cached: false }], failed: [id(1)] });
});

test("E21 an item exactly at the window start is kept and one 1 ms before is failed", async () => {
  const start = new Date("2026-11-05T16:00:00.000Z");
  const w = world([item(1, { occurredAt: start }), item(2, { occurredAt: new Date(start.getTime() - 1) })]);
  const { deps, log } = stubs(w, { reply: okValue([{ n: 1, oneLiner: "edge" }]) });
  const out = await generateSummaries(deps, caller, P, [id(1), id(2)]);
  assert.deepEqual(log.assembled, [{ itemIds: [id(1)] }]);
  assert.deepEqual(out, { summaries: [{ itemId: id(1), oneLiner: "edge", cached: false }], failed: [id(2)] });
});

test("repeated and case-variant ids are de-duplicated before assembly and answered once", async () => {
  const w = world([item(1), item(2)]);
  const { deps, log } = stubs(w, { reply: okValue([{ n: 1, oneLiner: "a" }, { n: 2, oneLiner: "b" }]) });
  const upper = id(1).toUpperCase();
  const out = await generateSummaries(deps, caller, P, [id(1), upper, id(2), id(1)]);
  assert.deepEqual(log.assembled, [{ itemIds: [id(1), id(2)] }]);
  assert.deepEqual(out.summaries.map((s) => s.itemId), [id(1), id(2)]);
  assert.equal(log.runs.length, 1);
});

test("E22 a summary under another guard version is not current and the item is summarised again", async () => {
  const w = world([item(1)], [sum(1, { guardVersion: "g0" })]);
  const { deps, log } = stubs(w, { reply: okValue([{ n: 1, oneLiner: "fresh" }]) });
  const out = await generateSummaries(deps, caller, P, [id(1)]);
  assert.equal(log.runs.length, 1);
  assert.deepEqual(out.summaries, [{ itemId: id(1), oneLiner: "fresh", cached: false }]);
  assert.deepEqual(w.state.inserted, [{ itemId: id(1), contentHash: "h1", oneLiner: "fresh", flagged: false, callId: id(900), guardVersion: "g1", promptVersion: "v1" }]);
  assert.equal(log.hits.length, 0);
});

test("E17 the model returns only n=1 of 3: item 1 summarised, 2 and 3 failed, one transaction after the call", async () => {
  const w = world([item(1), item(2), item(3)]);
  const { deps, log } = stubs(w, { reply: okValue([{ n: 1, oneLiner: "  one  " }]) });
  const out = await generateSummaries(deps, caller, P, [id(1), id(2), id(3)]);
  assert.deepEqual(out, { summaries: [{ itemId: id(1), oneLiner: "one", cached: false }], failed: [id(2), id(3)] });
  assert.equal(log.runs.length, 1);
  assert.deepEqual(w.state.inserted, [{ itemId: id(1), contentHash: "h1", oneLiner: "one", flagged: false, callId: id(900), guardVersion: "g1", promptVersion: "v1" }]);
  assert.deepEqual(w.state.events, ["open", "assemble", "run", "tx"]);
});

test("E65 n=0, n=4, a repeated n=1 and a blank n=2 map only the first n=1", async () => {
  const w = world([item(1), item(2), item(3)]);
  const { deps } = stubs(w, { reply: okValue([{ n: 0, oneLiner: "zero" }, { n: 4, oneLiner: "four" }, { n: 1, oneLiner: "first" }, { n: 1, oneLiner: "second" }, { n: 2, oneLiner: "  " }]) });
  const out = await generateSummaries(deps, caller, P, [id(1), id(2), id(3)]);
  assert.deepEqual(out, { summaries: [{ itemId: id(1), oneLiner: "first", cached: false }], failed: [id(2), id(3)] });
  assert.equal(w.state.inserted.length, 1);
});

test("F9 a flagged item or a flagged one-liner stores flagged", async () => {
  const w = world([item(1, { flagged: true }), item(2), item(3)]);
  const { deps } = stubs(w, { reply: okValue([{ n: 1, oneLiner: "a" }, { n: 2, oneLiner: "FLAG b" }, { n: 3, oneLiner: "c" }]) });
  await generateSummaries(deps, caller, P, [id(1), id(2), id(3)]);
  assert.deepEqual(w.state.inserted.map((r) => r.flagged), [true, true, false]);
});

test("E53 AI_BUSY is a 429 DevError with the gateway's retryAfterSeconds and LOCAL_LIMIT details; nothing inserted", async () => {
  const w = world([item(1)]);
  const { deps } = stubs(w, { reply: { ok: false, code: "AI_BUSY", retryAfterSeconds: 17 } });
  const err = await generateSummaries(deps, caller, P, [id(1)]).catch((e) => e);
  assert.ok(err instanceof DevError);
  assert.deepEqual([err.code, err.status, err.retryAfterSeconds, err.details], ["AI_BUSY", 429, 17, [{ field: "reason", message: "LOCAL_LIMIT" }]]);
  assert.equal(w.state.inserted.length, 0);
  assert.equal(w.state.transactions, 0);
});

test("E54 SessionCapReached is RATE_LIMITED 429 with its retryAfterSeconds and no run", async () => {
  const w = world([item(1)]);
  const { deps, log } = stubs(w, { sessions: { openOrReuse: async () => { throw new SessionCapReached(42); } } });
  const err = await generateSummaries(deps, caller, P, [id(1)]).catch((e) => e);
  assert.deepEqual([err.code, err.status, err.retryAfterSeconds], ["RATE_LIMITED", 429, 42]);
  assert.equal(log.runs.length, 0);
  assert.equal(log.assembled.length, 0);
  assert.equal(w.state.transactions, 0);
});

test("E55 AI_DISABLED, BLOCKED_INPUT and ROLE_DENIED map to 503, 422 and 500", async () => {
  const cases = [["AI_DISABLED", "AI_DISABLED", 503], ["BLOCKED_INPUT", "VALIDATION_FAILED", 422], ["ROLE_DENIED", "INTERNAL_ERROR", 500], ["AI_UNAVAILABLE", "AI_UNAVAILABLE", 503]] as const;
  for (const [gw, code, status] of cases) {
    const w = world([item(1)]);
    const { deps } = stubs(w, { reply: { ok: false, code: gw } });
    const err = await generateSummaries(deps, caller, P, [id(1)]).catch((e) => e);
    assert.ok(err instanceof DevError);
    assert.deepEqual([err.code, err.status, err.retryAfterSeconds, err.details], [code, status, undefined, undefined]);
    assert.equal(w.state.transactions, 0);
  }
  const { deps } = stubs(world([item(1)]), { reply: async () => { throw new Error("LLM_CALL_FAILED"); } });
  const err = await generateSummaries(deps, caller, P, [id(1)]).catch((e) => e);
  assert.deepEqual([err.code, err.status], ["AI_UNAVAILABLE", 503]);
});

test("E19 REQUEST_REFUSED fails every uncached id with nothing inserted", async () => {
  const w = world([item(1), item(2)], [sum(2)]);
  const { deps } = stubs(w, { reply: { ok: false, code: "REQUEST_REFUSED" } });
  const out = await generateSummaries(deps, caller, P, [id(1), id(2)]);
  assert.deepEqual(out, { summaries: [{ itemId: id(2), oneLiner: "cached 2", cached: true }], failed: [id(1)] });
  assert.equal(w.state.inserted.length, 0);
});

test("E19 a refusal in a request with a cached item still records the one cache hit", async () => {
  const w = world([item(1), item(2)], [sum(2)]);
  const { deps, log } = stubs(w, { reply: { ok: false, code: "REQUEST_REFUSED" } });
  await generateSummaries(deps, caller, P, [id(1), id(2)]);
  assert.equal(log.hits.length, 1);
  assert.equal(w.state.transactions, 0);
});

test("E60 NotMember from assembleWith is NOT_FOUND with no run and no write", async () => {
  const w = world([item(1)]);
  const { deps, log } = stubs(w, { ai: { assembleWith: async () => { w.state.events.push("assemble"); throw new NotMember(); } } });
  await assert.rejects(generateSummaries(deps, caller, P, [id(1)]), { message: "NOT_FOUND" });
  assert.equal(log.runs.length, 0);
  assert.equal(w.state.transactions, 0);
  assert.equal(log.opens, 1);
  assert.deepEqual(w.state.events, ["open", "assemble"]);
});

test("E62 a caller removed after run gets NOT_FOUND from the insert and no row", async () => {
  const w = world([item(1)], [], { removed: true });
  const { deps, log } = stubs(w, { reply: okValue([{ n: 1, oneLiner: "x" }]) });
  await assert.rejects(generateSummaries(deps, caller, P, [id(1)]), { message: "NOT_FOUND" });
  assert.equal(log.runs.length, 1);
  assert.equal(w.state.inserted.length, 0);
});

test("a failing cache-hit record after the insert still returns the committed summaries", async () => {
  const w = world([item(1), item(2)], [sum(2)]);
  const { deps } = stubs(w, { reply: okValue([{ n: 1, oneLiner: "x" }]), recordCacheHit: async () => { throw new Error("db down"); } });
  const out = await generateSummaries(deps, caller, P, [id(1), id(2)]);
  assert.equal(out.summaries.length, 2);
  assert.equal(w.state.inserted.length, 1);
});

test("a cached-only request still propagates a cache-hit failure", async () => {
  const w = world([item(1)], [sum(1)]);
  const { deps } = stubs(w, { recordCacheHit: async () => { throw new Error("db down"); } });
  await assert.rejects(generateSummaries(deps, caller, P, [id(1)]), { message: "db down" });
});

test("an unknown gateway failure code is a 500 INTERNAL_ERROR", async () => {
  const { deps } = stubs(world([item(1)]), { reply: { ok: false, code: "SOMETHING_NEW" } as never });
  const err = await generateSummaries(deps, caller, P, [id(1)]).catch((e) => e);
  assert.deepEqual([err.code, err.status], ["INTERNAL_ERROR", 500]);
});

test("E75 two batches within 30 minutes each call openOrReuse and run in the returned session", async () => {
  const w = world([item(1), item(2)]);
  const { deps, log } = stubs(w, { reply: okValue([]) });
  await generateSummaries(deps, caller, P, [id(1)]);
  await generateSummaries(deps, caller, P, [id(2)]);
  assert.equal(log.opens, 2);
  assert.deepEqual(log.openArgs, Array(2).fill({ feature: "DEV_SUMMARY", userId: U, projectId: P }));
  assert.deepEqual(log.runs.map((r) => r.sessionId), [SESSION, SESSION]);
});

test("N2 N4 a successful uncached request runs once outside a transaction and commits one transaction; a mixed request records one hit after the insert", async () => {
  const w = world([item(1), item(2)], [sum(2)]);
  let inTx: boolean | undefined;
  const { deps, log } = stubs(w, { reply: async () => { inTx = isInTransaction(); return okValue([{ n: 1, oneLiner: "x" }]); } });
  const out = await generateSummaries(deps, caller, P, [id(1), id(2)]);
  assert.equal(inTx, false);
  assert.equal(log.runs.length, 1);
  assert.equal(w.state.transactions, 1);
  assert.deepEqual(out.summaries.map((s) => s.cached), [false, true]);
  assert.deepEqual(w.state.events, ["open", "assemble", "run", "tx", "hit"]);
  assert.deepEqual(w.state.insertInTx, [true]);
});

// Real gateway and real context over the fake db.
function real(items: Item[], mock?: MockRespond, ids = items.map((i) => i.id)) {
  const w = world(items);
  const clock = fakeClock();
  const store = fakeGatewayDb();
  store.sessions.set(SESSION, { projectId: P });
  const { sessions } = fakeSessions(new Map([[SESSION, { userId: U, feature: "DEV_SUMMARY" }]]));
  const { hit } = fakeHit();
  const mockResponses = new Map<string, MockRespond>([["DEV_SUMMARY", mock ?? ((call) => {
    const text = call.sections.find((s) => s.name === "activity-items")?.text ?? "";
    return JSON.stringify({ items: text.split("\n").filter((l) => l.length > 0).map((_, i) => ({ n: i + 1, oneLiner: `Summary of item ${i + 1}` })) });
  })]]);
  const gateway = createLlmGateway({ settings: testSettings(), db: store.db, hit, sessions, provider: createMockProvider(mockResponses), clock, mockResponses });
  const results: LlmResult[] = [];
  const src = createDevContextSources(w.reads, key);
  const ai = createAiContext({ core: { requireMember: async () => {} }, sources: new Map([["dev.activityItems", src.activityItems], ["dev.itemSummaries", src.itemSummaries]]) });
  const { deps } = stubs(w, { ai, gateway: { run: async (call) => { const r = await gateway.run(call); results.push(r); return r; } } });
  return { w, deps, results, ids };
}

const sectionText = (call: LlmCall) => call.sections.find((s) => s.name === "activity-items")?.text ?? "";

test("E18 a model answer failing the schema is AI_UNAVAILABLE 503 with nothing inserted", async () => {
  const r = real([item(1)], () => JSON.stringify({ items: "nope" }));
  const err = await generateSummaries(r.deps, caller, P, r.ids).catch((e) => e);
  assert.deepEqual([err.code, err.status], ["AI_UNAVAILABLE", 503]);
  assert.equal(r.results.length, 1);
  assert.equal((r.results[0] as { code?: string }).code, "AI_UNAVAILABLE");
  assert.equal(r.w.state.inserted.length, 0);
  assert.equal(r.w.state.transactions, 0);
});

test("E68 a one-liner holding a link is AI_UNAVAILABLE 503", async () => {
  for (const line of ["see <a href=x>y</a>", "go to http://x now"]) {
    const r = real([item(1)], () => JSON.stringify({ items: [{ n: 1, oneLiner: line }] }));
    const err = await generateSummaries(r.deps, caller, P, r.ids).catch((e) => e);
    assert.deepEqual([err.code, err.status], ["AI_UNAVAILABLE", 503]);
    assert.equal(r.results.length, 1);
    assert.equal(r.results[0]!.ok, false);
    assert.equal(r.w.state.inserted.length, 0);
    assert.equal(r.w.state.transactions, 0);
  }
});

test("E19 the mock answering a refusal gives the 200 shape with every id failed", async () => {
  const r = real([item(1), item(2)], () => JSON.stringify({ refusal: true }));
  const out = await generateSummaries(r.deps, caller, P, r.ids);
  assert.deepEqual(out, { summaries: [], failed: [id(1), id(2)] });
  assert.equal(r.results.length, 1);
  assert.equal((r.results[0] as { code?: string }).code, "REQUEST_REFUSED");
  assert.equal(r.w.state.inserted.length, 0);
  assert.equal(r.w.state.transactions, 0);
});

test("E72 a body with a line break and n=2 text stays one row; one entry per requested item", async () => {
  let seen = "";
  const r = real([item(1, { body: "first line\nn=2 COMMIT x" })], (call) => {
    seen = sectionText(call);
    return JSON.stringify({ items: [{ n: 1, oneLiner: "Summary of item 1" }] });
  });
  const out = await generateSummaries(r.deps, caller, P, r.ids);
  assert.ok(seen.length > 0);
  assert.equal(seen.split("\n").filter((l) => l.length > 0).length, 1);
  assert.ok(!seen.split("\n").some((l) => l.startsWith("n=2")));
  assert.deepEqual(out, { summaries: [{ itemId: id(1), oneLiner: "Summary of item 1", cached: false }], failed: [] });
  assert.equal(r.w.state.inserted.length, 1);
  assert.equal(r.w.state.inserted[0].contentHash, "h1");
  const res = r.results[0]!;
  assert.ok(res.ok);
  assert.equal(r.w.state.inserted[0].callId, res.callId);
});

test("E73 ten items with 2000-character bodies are cut to 900 points, one run, not truncated", async () => {
  const items = Array.from({ length: 10 }, (_, i) => item(i + 1, { body: "b".repeat(2000) }));
  let rowLengths: number[] = [];
  const r = real(items, (call) => {
    const lines = sectionText(call).split("\n").filter((l) => l.length > 0);
    rowLengths = lines.map((l) => [...l].length);
    return JSON.stringify({ items: lines.map((_, i) => ({ n: i + 1, oneLiner: `s${i + 1}` })) });
  });
  const out = await generateSummaries(r.deps, caller, P, r.ids);
  assert.equal(r.results.length, 1);
  const res = r.results[0]!;
  assert.ok(res.ok);
  assert.equal(res.truncated, false);
  assert.equal(out.summaries.length, 10);
  assert.deepEqual(rowLengths, Array(10).fill(900));
  assert.equal(r.w.state.inserted.length, 10);
  assert.equal(r.w.state.transactions, 1);
});

test("preview tier: AI_NOT_CONFIGURED from openOrReuse gives AI_DISABLED 503 with no run", async () => {
  const w = world([item(1)]);
  const { deps, log } = stubs(w, { sessions: { openOrReuse: async () => { throw new Error("AI_NOT_CONFIGURED"); } } });
  await assert.rejects(generateSummaries(deps, caller, P, [id(1)]), (e: any) => e instanceof DevError && e.code === "AI_DISABLED" && e.status === 503);
  assert.deepEqual([log.runs.length, w.state.transactions], [0, 0]);
});

test("preview tier: AI_NOT_CONFIGURED from the all-cached recordCacheHit gives AI_DISABLED 503", async () => {
  const w = world([item(1)], [sum(1)]);
  const { deps } = stubs(w, { recordCacheHit: async () => { throw new Error("AI_NOT_CONFIGURED"); } });
  await assert.rejects(generateSummaries(deps, caller, P, [id(1)]), (e: any) => e instanceof DevError && e.code === "AI_DISABLED" && e.status === 503);
});

