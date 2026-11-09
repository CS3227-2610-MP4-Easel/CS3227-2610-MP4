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

type Stub = { run?: (call: unknown) => Promise<unknown>; value?: unknown; wrapDb?: (db: ReturnType<typeof createDbClient>) => ReturnType<typeof createDbClient> };

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
  const makeRuntime = (stub: Stub = {}) => {
    resetContextRegistries();
    const gateway = {
      run: async (call: unknown) => {
        assert.equal(isInTransaction(), false, "N2 no model call inside a transaction");
        if (stub.run) await stub.run(call);
        const feature = (call as { feature: string }).feature;
        const value = stub.value ?? (feature === "DEV_SUMMARY" ? { items: [{ n: 1, oneLiner: "did a thing" }] } : { yesterday: ["did a thing"], today: [], blockers: [] });
        return { ok: true, value, callId: callRow.id, flagged: false, truncated: false, cacheHit: false, promptTokens: 0, completionTokens: 0, costMicroUsd: 0 };
      },
    };
    const db = stub.wrapDb ? stub.wrapDb(filtered) : filtered;
    return createDevRuntime({
      db, requireMember: core.requireMember, members: async () => [], lookupArchivedMembership, now: () => NOW,
      overrides: { gateway: gateway as never, sessions: sessions as never, ai: { assembleWith: async () => ({ sections: [{ name: "task-events", kind: "DYNAMIC", priority: 1, budgetTokens: 100, text: "did a thing", trusted: true }], provenance: [] }) } as never, recordCacheHit: async () => {} },
    });
  };
  return { base, filtered, projectId, devs, dev: devs[0]!, callId: callRow.id, opened, makeRuntime, core, lookupArchivedMembership };
}

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
  const wrapDb = (db: ReturnType<typeof createDbClient>) => new Proxy(db, {
    get(target, prop) {
      if (prop !== "$transaction") return Reflect.get(target, prop);
      return (cb: (tx: unknown) => Promise<unknown>, o: unknown) => (target as never as { $transaction: Function }).$transaction((tx: object) => {
        let calls = 0;
        const wrapped = new Proxy(tx, { get(t, p) {
          const value = Reflect.get(t, p);
          if (p !== "activityItem") return value;
          return new Proxy(value as object, { get(d, q) {
            if (q !== "upsert") return Reflect.get(d, q);
            return (...args: unknown[]) => { if (++calls === 2) throw new Error("boom"); return (Reflect.get(d, q) as Function).apply(d, args); };
          } });
        } });
        return cb(wrapped);
      }, o);
    },
  });
  const rt = s.makeRuntime({ wrapDb });
  await assert.rejects(() => rt.upload(s.dev, s.projectId, [raw("a"), raw("b")]), /boom/);
  assert.equal((await items(base, s.projectId)).length, 0);
})));

test("E48 an item re-uploaded during its summary call keeps the old-hash summary, which is no longer current", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const inRun = new Promise<void>((r) => { entered = r; });
  const rt = s.makeRuntime({ run: async () => { entered(); await gate; } });
  await rt.upload(s.dev, s.projectId, [raw("a")]);
  const [before] = await items(base, s.projectId);
  const pending = rt.summaries(caller(s.dev), s.projectId, [before!.id]);
  await inRun;
  await rt.upload(s.dev, s.projectId, [raw("a", { title: "changed" })]);
  release();
  await pending;
  const [after] = await items(base, s.projectId);
  const summaries = await base.itemSummary.findMany({ where: { itemId: before!.id } });
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]!.contentHash, before!.contentHash);
  assert.notEqual(after!.contentHash, before!.contentHash);
  assert.equal(summaries.filter((x) => x.contentHash === after!.contentHash).length, 0, "no current summary");
})));

test("E20 two concurrent summary requests for one uncached item write one summary", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  await rt.upload(s.dev, s.projectId, [raw("a")]);
  const [item] = await items(base, s.projectId);
  const results = await Promise.all([rt.summaries(caller(s.dev), s.projectId, [item!.id]), rt.summaries(caller(s.dev), s.projectId, [item!.id])]);
  for (const r of results) assert.equal(r.summaries.length, 1);
  assert.equal(await base.itemSummary.count({ where: { itemId: item!.id } }), 1);
})));

test("E34 two concurrent first standups for one date leave one row at version 2", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  await Promise.all([rt.standup(caller(s.dev), s.projectId, undefined), rt.standup(caller(s.dev), s.projectId, undefined)]);
  const rows = await base.standup.findMany({ where: { projectId: s.projectId } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.version, 2);
  assert.equal(s.opened.length, 2);
  assert.ok(s.opened.includes(rows[0]!.sessionId));
})));

test("E61 two concurrent uploads of the same new item leave one row with the item's hash", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  const results = await Promise.all([rt.upload(s.dev, s.projectId, [raw("a")]), rt.upload(s.dev, s.projectId, [raw("a")])]);
  assert.ok(results.reduce((n, r) => n + r.created, 0) <= 2);
  const rows = await items(base, s.projectId);
  assert.equal(rows.length, 1);
  const expected = validateItem(raw("a"), NOW);
  assert.equal(rows[0]!.contentHash, expected.ok ? expected.item.contentHash : "");
})));

test("N2 three concurrent uploads of different items all resolve", opts, () => withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
  const rt = s.makeRuntime();
  const results = await Promise.all(["a", "b", "c"].map((id) => rt.upload(s.dev, s.projectId, [raw(id)])));
  assert.equal(results.reduce((n, r) => n + r.created, 0), 3);
  assert.equal((await items(base, s.projectId)).length, 3);
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
  test(`E47 archive racing a ${endpoint} ${label} write either follows it or rejects it with nothing written`, opts, async () => {
    for (const delay of [0, 2, 8]) {
      await withIntegrationDb((base, fx) => scene(base, fx, async (s) => {
        let entered!: () => void;
        const inRun = new Promise<void>((r) => { entered = r; });
        const rt = s.makeRuntime({ run: async () => { entered(); } });
        let itemId = "";
        if (endpoint === 50) { await rt.upload(s.dev, s.projectId, [raw("a")]); itemId = (await items(base, s.projectId))[0]!.id; }
        const op = endpoint === 49 ? () => rt.upload(s.dev, s.projectId, [raw("a")]) : endpoint === 50 ? () => rt.summaries(caller(s.dev), s.projectId, [itemId]) : () => rt.standup(caller(s.dev), s.projectId, undefined);
        const racer = async () => { if (endpoint !== 49) await inRun; await sleep(delay); return archive(base, s.projectId); };
        const [write, archived] = await Promise.allSettled([op(), racer()]);
        assert.equal(archived.status, "fulfilled");
        assert.equal((await base.project.findUniqueOrThrow({ where: { id: s.projectId } })).status, "ARCHIVED");
        const written = endpoint === 49 ? (await items(base, s.projectId)).length :endpoint === 50 ? await base.itemSummary.count({ where: { item: { projectId: s.projectId } } }) : await base.standup.count({ where: { projectId: s.projectId } });
        if (write.status === "fulfilled") assert.equal(written, 1);
        else { assert.equal((write.reason as Error).message, "CONFLICT_STATE"); assert.equal(written, 0); }
      }));
    }
  });
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
  resetContextRegistries();
  const composition = withDevComposition(createCoreComposition(rt as never), createDevComposition(rt as never));
  const api = createApiApp(createAppDependencies(rt as never, composition), composition.routes);
  const upper = s.projectId.toUpperCase();
  const post = (path: string, body: unknown) => api.request(`http://localhost/api/dev/projects/${upper}/${path}`, { method: "POST", headers: { authorization: "Bearer dev", "content-type": "application/json" }, body: JSON.stringify(body) });
  const old = raw("old", { timestamp: "2026-01-01T00:00:00Z" });
  const uploaded = await post("uploads", { items: [old] });
  assert.equal(uploaded.status, 200);
  const rows = await items(base, s.projectId);
  assert.equal(rows.length, 1);
  assert.equal((await post("summaries", { itemIds: [rows[0]!.id.toUpperCase()] })).status, 200);
  await archive(base, s.projectId);
  for (const [path, body] of [["uploads", { items: [raw("new")] }], ["summaries", { itemIds: [rows[0]!.id] }]] as const) {
    const res = await post(path, body);
    assert.equal(res.status, 409);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "CONFLICT_STATE");
  }
  assert.equal((await items(base, s.projectId)).length, 1);
})));
