import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createDbClient, isInTransaction } from "@agile/db";
import { resetContextRegistries } from "@agile/ai-context/testing";
import { createCore } from "@agile/core";
import { defaultStandupDate, standupActivityWindowFor } from "@agile/contracts";
import { createSessions } from "@agile/llm-gateway";
import { createDevRuntime, validateItem } from "@agile/dev";
import { createApiApp } from "../../api/src/app.js";
import { createCoreComposition } from "../../api/src/core-composition.js";
import { createDevComposition, withDevComposition } from "../../api/src/dev-composition.js";
import { createAppDependencies } from "../../api/src/deps.js";
import { insertSummaries } from "../src/store/summaries.js";
import { createDevContextSources } from "../src/store/sources.js";
import { GUARD_VERSION } from "../src/gateway-binding.js";
import { SUMMARY_PROMPT_VERSION } from "../src/ai/prompts.js";
import { integrationUrl, withIntegrationDb, type Fixtures } from "../../llm-gateway/test/fakes.js";

const NOW = new Date("2026-11-09T04:00:00Z");
const RECENT = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
const opts = { skip: !integrationUrl };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const raw = (externalId: string, over: Record<string, unknown> = {}) => ({ type: "COMMIT", externalId, title: `title ${externalId}`, timestamp: RECENT, files: [], ...over });
const caller = (userId: string) => ({ userId, role: "DEVELOPER" as const });

type Db = ReturnType<typeof createDbClient>;
type Stub = { run?: (call: unknown) => Promise<unknown>; wrapDb?: (db: Db) => Db };

// Wraps every transaction's tx; `patch` returns replacement delegates by name.
function wrapTx(db: Db, patch: (tx: object) => Record<string, object>): Db {
  return new Proxy(db, {
    get(target, prop) {
      if (prop !== "$transaction") return Reflect.get(target, prop);
      return (cb: (tx: unknown) => Promise<unknown>, o: unknown) => (target as never as { $transaction: Function }).$transaction((tx: object) => {
        const patched = patch(tx);
        return cb(new Proxy(tx, { get: (t, p) => (typeof p === "string" && p in patched ? patched[p] : Reflect.get(t, p)) }));
      }, o);
    },
  });
}

// Pauses each write transaction right after its recheck read, i.e. while it holds the project row lock.
function lockGate() {
  let reached!: () => void;
  let release!: () => void;
  const hit = new Promise<void>((r) => { reached = r; });
  const open = new Promise<void>((r) => { release = r; });
  const wrapDb = (db: Db) => wrapTx(db, (tx) => {
    const project = (tx as { project: { findFirst: Function } }).project;
    return { project: new Proxy(project, { get: (d, q) => (q === "findFirst" ? async (...args: unknown[]) => { const row = await project.findFirst(...args); reached(); await open; return row; } : Reflect.get(d, q)) }) };
  });
  return { wrapDb, hit, release };
}

// Both parties must be inside the model call before either continues, so both passed the cache read.
function rendezvous(parties: number) {
  let arrived = 0;
  let open!: () => void;
  const all = new Promise<void>((r) => { open = r; });
  const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error("rendezvous timed out")), 10_000).unref());
  return async () => { if (++arrived >= parties) open(); await Promise.race([all, timeout]); };
}

async function scene(base: PrismaClient, fx: Fixtures, run: (s: Awaited<ReturnType<typeof build>>) => Promise<void>, developers = 1) {
  const owner = await fx.user();
  const devs = await Promise.all(Array.from({ length: developers }, () => fx.user()));
  const projectId = await fx.project(owner);
  for (const userId of devs) await base.projectMember.create({ data: { projectId, userId, addedBy: owner } });
  try { await run(await build(base, projectId, devs)); } finally {
    await base.itemSummary.deleteMany({ where: { item: { projectId } } });
    await base.standup.deleteMany({ where: { projectId } });
    await base.activityItem.deleteMany({ where: { projectId } });
    await base.projectMember.deleteMany({ where: { projectId } });
  }
}

async function build(base: PrismaClient, projectId: string, devs: string[]) {
  const filtered = createDbClient(base);
  const lookupArchivedMembership = async (userId: string, id: string) => Boolean(await base.projectMember.findFirst({ where: { userId, projectId: id, project: { status: "ARCHIVED" } }, select: { projectId: true } }));
  const core = createCore({ db: filtered as never, archivedMembership: lookupArchivedMembership });
  const gs = createSessions({ db: base, settings: { tier: "test" } });
  const opened: string[] = [];
  const sessions = { ...gs, open: async (i: Parameters<typeof gs.open>[0]) => { const id = await gs.open(i); opened.push(id); return id; } };
  const callRow = await base.llmCall.create({ data: { userId: devs[0]!, role: "DEVELOPER", env: "test", feature: "DEV_SUMMARY", model: "stub", promptVersion: "v", status: "OK", attempts: 1, estimatedPromptTokens: 0, sectionTokens: {}, prefixHash: "p", inputHash: "i", flagged: false, truncated: false, experiment: {} } });
  const runCalls = { n: 0 };
  const makeRuntime = (stub: Stub = {}) => {
    resetContextRegistries();
    const gateway = {
      run: async (call: unknown) => {
        assert.equal(isInTransaction(), false, "N2 no model call inside a transaction");
        runCalls.n++;
        if (stub.run) await stub.run(call);
        const feature = (call as { feature: string }).feature;
        const value = feature === "DEV_SUMMARY" ? { items: [{ n: 1, oneLiner: "did a thing" }] } : { yesterday: ["did a thing"], today: [], blockers: [] };
        return { ok: true, value, callId: callRow.id, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 };
      },
    };
    const db = stub.wrapDb ? stub.wrapDb(filtered) : filtered;
    return createDevRuntime({
      db, requireMember: core.requireMember, members: async () => [], lookupArchivedMembership, now: () => NOW,
      overrides: { gateway: gateway as never, sessions: sessions as never, ai: { assembleWith: async () => ({ sections: [{ name: "task-events", kind: "DYNAMIC", priority: 1, budgetTokens: 100, text: "did a thing", trusted: true }], provenance: [] }) } as never, recordCacheHit: async () => {} },
    });
  };
  return { base, filtered, projectId, devs, dev: devs[0]!, callId: callRow.id, opened, runCalls, makeRuntime, core, lookupArchivedMembership };
}

type Scene = Awaited<ReturnType<typeof build>>;
const items = (base: PrismaClient, projectId: string) => base.activityItem.findMany({ where: { projectId } });
const archive = (base: PrismaClient, projectId: string) => base.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });

test("F1 upload then re-upload unchanged keeps one row with the real content hash", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  const first = await rt.upload(s.dev, s.projectId, [raw("a")]);
  assert.equal(first.created, 1);
  const second = await rt.upload(s.dev, s.projectId, [raw("a")]);
  assert.equal(second.unchanged, 1);
  const rows = await items(base, s.projectId);
  assert.equal(rows.length, 1);
  const expected = validateItem(raw("a"), NOW);
  assert.ok(expected.ok);
  assert.equal(rows[0]!.contentHash, expected.ok ? expected.item.contentHash : "");
})));

test("F4 generate then generate again with the same sections is cached with one row", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  const first = await rt.standup(caller(s.dev), s.projectId, undefined);
  const second = await rt.standup(caller(s.dev), s.projectId, undefined);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.version, first.version);
  assert.equal(await base.standup.count({ where: { projectId: s.projectId } }), 1);
})));

test("E46 a failed upsert mid-upload leaves no activity items", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const wrapDb = (db: Db) => wrapTx(db, (tx) => {
    let calls = 0;
    const item = (tx as { activityItem: { upsert: Function } }).activityItem;
    return { activityItem: new Proxy(item, { get: (d, q) => (q === "upsert" ? (...args: unknown[]) => { if (++calls === 2) throw new Error("boom"); return item.upsert(...args); } : Reflect.get(d, q)) }) };
  });
  const rt = s.makeRuntime({ wrapDb });
  await assert.rejects(() => rt.upload(s.dev, s.projectId, [raw("a"), raw("b")]), /boom/);
  assert.equal((await items(base, s.projectId)).length, 0);
})));

test("E48 an item re-uploaded during its summary call keeps the old-hash summary, which is no longer current", { ...opts, timeout: 30_000 }, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const inRun = new Promise<void>((r) => { entered = r; });
  const rt = s.makeRuntime({ run: async () => { entered(); await gate; } });
  await rt.upload(s.dev, s.projectId, [raw("a")]);
  const [before] = await items(base, s.projectId);
  const pending = rt.summaries(caller(s.dev), s.projectId, [before!.id]);
  try {
    await Promise.race([inRun, pending.then(() => undefined, () => undefined)]);
    await rt.upload(s.dev, s.projectId, [raw("a", { title: "changed" })]);
  } finally { release(); }
  await pending;
  assert.ok(s.runCalls.n > 0, "the model stub ran");
  const [after] = await items(base, s.projectId);
  const summaries = await base.itemSummary.findMany({ where: { itemId: before!.id } });
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]!.contentHash, before!.contentHash);
  assert.notEqual(after!.contentHash, before!.contentHash);
  assert.equal(summaries.filter((x) => x.contentHash === after!.contentHash).length, 0, "no current summary");
})));

test("E20 two concurrent summary requests for one uncached item write one summary", { ...opts, timeout: 30_000 }, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime({ run: rendezvous(2) });
  await rt.upload(s.dev, s.projectId, [raw("a")]);
  const [item] = await items(base, s.projectId);
  const results = await Promise.all([rt.summaries(caller(s.dev), s.projectId, [item!.id]), rt.summaries(caller(s.dev), s.projectId, [item!.id])]);
  assert.equal(s.runCalls.n, 2, "both requests reached the model");
  for (const r of results) assert.equal(r.summaries.length, 1);
  assert.equal(await base.itemSummary.count({ where: { itemId: item!.id } }), 1);
})));

test("E34 two concurrent first standups for one date leave one row at version 2", { ...opts, timeout: 30_000 }, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime({ run: rendezvous(2) });
  await Promise.all([rt.standup(caller(s.dev), s.projectId, undefined), rt.standup(caller(s.dev), s.projectId, undefined)]);
  assert.equal(s.runCalls.n, 2, "both requests reached the model");
  const rows = await base.standup.findMany({ where: { projectId: s.projectId } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.version, 2);
  assert.equal(s.opened.length, 2);
  assert.ok(s.opened.includes(rows[0]!.sessionId));
})));

test("E61 two concurrent uploads of the same new item leave one row with the item's hash", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  const results = await Promise.all([rt.upload(s.dev, s.projectId, [raw("a")]), rt.upload(s.dev, s.projectId, [raw("a")])]);
  assert.equal(results.reduce((n, r) => n + r.created, 0), 1);
  assert.equal(results.reduce((n, r) => n + r.unchanged, 0), 1);
  const rows = await items(base, s.projectId);
  assert.equal(rows.length, 1);
  const expected = validateItem(raw("a"), NOW);
  assert.equal(rows[0]!.contentHash, expected.ok ? expected.item.contentHash : "");
})));

test("concurrent uploads of three different items to one project all resolve", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  const results = await Promise.all(["a", "b", "c"].map((id) => rt.upload(s.dev, s.projectId, [raw(id)])));
  assert.equal(results.reduce((n, r) => n + r.created, 0), 3);
  assert.equal((await items(base, s.projectId)).length, 3);
})));

test("concurrent uploads of five different items either succeed or fail with a serialization error", opts, (t) => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  const ids = ["a", "b", "c", "d", "e"];
  const settled = await Promise.allSettled(ids.map((id) => rt.upload(s.dev, s.projectId, [raw(id)])));
  const stored = new Set((await items(base, s.projectId)).map((r) => r.externalId));
  const ok = new Set<string>();
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") { assert.equal(r.value.created, 1); ok.add(ids[i]!); } else assert.ok(["P2034", "40001"].includes((r.reason as { code?: string }).code ?? ""), "only serialization failures");
  });
  assert.deepEqual([...stored].sort(), [...ok].sort());
  t.diagnostic(`retry budget: ${settled.length - ok.size} of ${settled.length} uploads failed with a serialization error`);
})));

test("F3 insertSummaries for another developer's item rejects NOT_FOUND and writes nothing", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  const other = s.devs[1]!;
  await rt.upload(other, s.projectId, [raw("a")]);
  const [item] = await items(base, s.projectId);
  const deps = { db: s.filtered as never, requireMember: s.core.requireMember };
  await assert.rejects(() => insertSummaries(deps, s.dev, s.projectId, [{ itemId: item!.id, contentHash: item!.contentHash, oneLiner: "x", flagged: false, callId: s.callId }], { guardVersion: GUARD_VERSION, promptVersion: SUMMARY_PROMPT_VERSION }), /NOT_FOUND/);
  assert.equal(await base.itemSummary.count({ where: { itemId: item!.id } }), 0);
}, 2)));

test("F3 dev.itemSummaries considers only the newest 500 in-window items and excludes window.to", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const { from, to } = standupActivityWindowFor(defaultStandupDate(NOW), NOW);
  const key = { guardVersion: "g", promptVersion: "p" };
  const row = (i: number, at: Date) => ({ projectId: s.projectId, uploadedBy: s.dev, itemType: "COMMIT" as const, externalId: `x${i}`, title: `t${i}`, occurredAt: at, files: [], contentHash: `h${i}`, flagged: false });
  const data = Array.from({ length: 502 }, (_, i) => row(i, new Date(to.getTime() - (i + 1) * 60_000)));
  data.push(row(502, to));
  assert.ok(data[501]!.occurredAt >= from);
  await base.activityItem.createMany({ data });
  const stored = await items(base, s.projectId);
  const idOf = (i: number) => stored.find((r) => r.externalId === `x${i}`)!.id;
  const summary = (i: number) => ({ itemId: idOf(i), contentHash: `h${i}`, guardVersion: key.guardVersion, promptVersion: key.promptVersion, oneLiner: `line ${i}`, flagged: false, callId: s.callId });
  await base.itemSummary.createMany({ data: [0, 500, 501, 502].map(summary) });
  const rows = await createDevContextSources(s.filtered, key).itemSummaries({ caller: caller(s.dev), projectId: s.projectId, options: { window: { from, to } } });
  assert.equal(rows.length, 1);
  const kept = await base.itemSummary.findFirst({ where: { itemId: idOf(0) } });
  assert.equal(rows[0]!.ref.id, kept!.id);
})));

for (const [endpoint, label] of [[49, "upload"], [50, "summaries"], [51, "standup"]] as const) {
  const written = (base: PrismaClient, projectId: string) => endpoint === 49 ? base.activityItem.count({ where: { projectId } }) : endpoint === 50 ? base.itemSummary.count({ where: { item: { projectId } } }) : base.standup.count({ where: { projectId } });
  // Returns the write under test as a function of the runtime that runs it.
  const arrange = async (s: Scene) => {
    let itemId = "";
    if (endpoint === 50) { await s.makeRuntime().upload(s.dev, s.projectId, [raw("a")]); itemId = (await items(s.base, s.projectId))[0]!.id; }
    return (rt: ReturnType<Scene["makeRuntime"]>) => endpoint === 49 ? rt.upload(s.dev, s.projectId, [raw("a")]) : endpoint === 50 ? rt.summaries(caller(s.dev), s.projectId, [itemId]) : rt.standup(caller(s.dev), s.projectId, undefined);
  };

  test(`E47 ${endpoint} ${label}: a project archived first rejects CONFLICT_STATE with nothing written`, opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
    const write = await arrange(s);
    // Filtered reads already hide an archived project, so for 50 the archive lands between the model call and the write.
    if (endpoint !== 50) await archive(base, s.projectId);
    const rt = s.makeRuntime(endpoint === 50 ? { run: async () => { await archive(base, s.projectId); } } : {});
    await assert.rejects(() => write(rt), (e: Error) => e.message === "CONFLICT_STATE");
    assert.equal(await written(base, s.projectId), 0);
  })));

  test(`E47 ${endpoint} ${label}: an archive started during the write waits for the project lock`, { ...opts, timeout: 30_000 }, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
    const write = await arrange(s);
    const gate = lockGate();
    const op = write(s.makeRuntime({ wrapDb: gate.wrapDb }));
    let archiving: Promise<unknown> = Promise.resolve();
    let archived = false;
    let archivedAt = 0;
    try {
      await Promise.race([gate.hit, op.then(() => undefined, () => undefined)]);
      archiving = archive(base, s.projectId).then(() => { archived = true; archivedAt = Date.now(); });
      await sleep(300);
      assert.equal(archived, false, "the archive blocks on the project row lock");
    } finally { gate.release(); }
    const released = Date.now();
    await op;
    assert.equal(await written(base, s.projectId), 1);
    await archiving;
    const project = await base.project.findUniqueOrThrow({ where: { id: s.projectId } });
    assert.equal(project.status, "ARCHIVED");
    assert.ok(archivedAt >= released, "the archive finished only after the write was released");
  })));
}

test("E47 full app: upper-case project id stores under the real project; archived is 409 CONFLICT_STATE", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = {
    db: s.filtered,
    resolvePrincipal: async () => ({ firebaseUid: "dev", tokenClaims: {} }),
    lookupRegisteredUser: async (firebaseUid: string) => ({ firebaseUid, userId: s.dev, role: "DEVELOPER" as const }),
    lookupUserByEmail: async () => null,
    lookupUserRole: async () => null,
    lookupArchivedMembership: s.lookupArchivedMembership,
  };
  assert.equal(process.env.LLM_MODE, "mock", "no live model can be called");
  resetContextRegistries();
  const composition = withDevComposition(createCoreComposition(rt as never), createDevComposition(rt as never));
  const api = createApiApp(createAppDependencies(rt as never, composition), composition.routes);
  const upper = s.projectId.toUpperCase();
  const post = (path: string, body: unknown) => api.request(`http://localhost/api/dev/projects/${upper}/${path}`, { method: "POST", headers: { authorization: "Bearer dev", "content-type": "application/json" }, body: JSON.stringify(body) });
  const calls = await base.llmCall.count({ where: { userId: s.dev } });
  const old = raw("old", { timestamp: "2026-01-01T00:00:00Z" });
  const uploaded = await post("uploads", { items: [old] });
  assert.equal(uploaded.status, 200);
  const rows = await items(base, s.projectId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.projectId, s.projectId);
  assert.equal((await post("summaries", { itemIds: [rows[0]!.id.toUpperCase()] })).status, 200);
  await archive(base, s.projectId);
  for (const [path, body] of [["uploads", { items: [raw("new")] }], ["summaries", { itemIds: [rows[0]!.id] }]] as const) {
    const res = await post(path, body);
    assert.equal(res.status, 409);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "CONFLICT_STATE");
  }
  assert.equal((await items(base, s.projectId)).length, 1);
  assert.equal(await base.itemSummary.count({ where: { item: { projectId: s.projectId } } }), 0, "nothing written by the archived calls");
  assert.equal(await base.llmCall.count({ where: { userId: s.dev } }), calls, "no model call was made");
})));
