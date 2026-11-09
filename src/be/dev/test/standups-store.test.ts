import assert from "node:assert/strict";
import test from "node:test";
import { developerIds, findStandup, listLeadStandups, toStandup, upsertStandup } from "../src/store/standups.js";

const P = "p";
const row = (id: string, developerId: string, date: string, over: Record<string, unknown> = {}) => ({
  id, projectId: P, developerId, standupDate: new Date(`${date}T00:00:00Z`), content: { yesterday: [], today: [], blockers: [] }, degraded: false, flagged: false,
  outcome: null, feedback: null, createdAt: new Date("2026-11-09T01:00:00Z"), updatedAt: new Date("2026-11-09T02:00:00Z"), version: 1, ...over,
});
const rows = [row("1", "d1", "2026-11-09"), row("2", "d2", "2026-11-09"), row("3", "d1", "2026-11-08"), row("4", "lead", "2026-11-09"), row("5", "gone", "2026-11-09"), row("6", "d2", "2026-11-09", { projectId: "other" })];
const match = (r: any, where: any) => Object.entries(where).every(([k, c]: [string, any]) => c instanceof Date ? r[k].getTime() === c.getTime() : c && typeof c === "object" && "in" in c ? c.in.includes(r[k]) : r[k] === c);
let lastFind: any;
let lastCount: any;
const db = {
  standup: {
    findFirst: async ({ where }: any) => rows.find((r) => match(r, where)) ?? null,
    findMany: async (a: any) => {
      lastFind = a;
      const sorted = rows.filter((r) => match(r, a.where)).sort((x, y) => y.standupDate.getTime() - x.standupDate.getTime() || (x.developerId < y.developerId ? -1 : x.developerId > y.developerId ? 1 : x.id < y.id ? -1 : 1));
      return sorted.slice(a.skip, a.skip + a.take);
    },
    count: async ({ where }: any) => { lastCount = where; return rows.filter((r) => match(r, where)).length; },
  },
};

test("E37 findStandup returns only the caller's row or null", async () => {
  assert.equal((await findStandup(db, P, "d1", "2026-11-09"))?.id, "1");
  assert.equal(await findStandup(db, P, "d3", "2026-11-09"), null);
  assert.equal(await findStandup(db, P, "d2", "2026-11-08"), null);
});

test("E74 developerIds keeps only DEVELOPER members", () => {
  assert.deepEqual(developerIds([{ userId: "d1", role: "DEVELOPER" }, { userId: "lead", role: "DEV_LEAD" }, { userId: "d2", role: "DEVELOPER" }]), ["d1", "d2"]);
});

test("E38 and E74 removed developer and lead rows are not listed or counted", async () => {
  const r = await listLeadStandups(db, P, ["d1", "d2"], { page: 0, size: 10 });
  assert.equal(r.total, 3);
  assert.deepEqual(r.items.map((s) => s.id), ["1", "2", "3"]);
  assert.ok(r.items.every((s) => s.cached === false));
});

test("listLeadStandups filters by date and developerId, orders and pages", async () => {
  assert.deepEqual((await listLeadStandups(db, P, ["d1", "d2"], { date: "2026-11-08", page: 0, size: 10 })).items.map((s) => s.id), ["3"]);
  assert.deepEqual((await listLeadStandups(db, P, ["d1", "d2"], { developerId: "d2", page: 0, size: 10 })).items.map((s) => s.id), ["2"]);
  assert.equal((await listLeadStandups(db, P, ["d1"], { developerId: "d2", page: 0, size: 10 })).total, 0);
  const p = await listLeadStandups(db, P, ["d1", "d2"], { page: 1, size: 2 });
  assert.deepEqual([p.items.map((s) => s.id), p.page, p.size, p.total], [["3"], 1, 2, 3]);
  assert.deepEqual(lastFind.orderBy, [{ standupDate: "desc" }, { developerId: "asc" }, { id: "asc" }]);
});

test("toStandup formats date and instants", () => {
  const s = toStandup(row("1", "d1", "2026-11-09") as never, true);
  assert.equal(s.date, "2026-11-09");
  assert.equal(s.createdAt, "2026-11-09T01:00:00.000Z");
  assert.equal(s.cached, true);
  assert.equal(s.version, 1);
});

test("upsertStandup twice keeps one row and increments version to 2", async () => {
  const store = new Map<string, any>();
  const payloads: any[] = [];
  const tx = {
    project: { update: async () => ({}), findFirst: async () => ({ status: "ACTIVE" }) },
    standup: {
      upsert: async ({ where, create, update }: any) => {
        payloads.push({ create, update });
        const w = where.projectId_developerId_standupDate;
        const k = `${w.projectId}|${w.developerId}|${w.standupDate.toISOString()}`;
        const cur = store.get(k);
        const next = cur ? { ...cur, ...update, version: cur.version + update.version.increment } : { id: "x", ...create };
        store.set(k, next);
        return next;
      },
    },
  };
  const deps = { db: { $transaction: async (fn: any) => fn(tx) } as never, requireMember: async () => {} };
  const v = { content: { a: 1 }, inputHash: "h", degraded: false, flagged: false, sessionId: "s" };
  assert.equal((await upsertStandup(deps, "d1", P, "2026-11-09", v)).version, 1);
  const v2 = { content: { a: 2 }, inputHash: "h2", degraded: true, flagged: true, sessionId: "s2" };
  const second = await upsertStandup(deps, "d1", P, "2026-11-09", v2);
  assert.equal(second.version, 2);
  assert.equal(store.size, 1);
  assert.equal("outcome" in second, false);
  assert.deepEqual([second.content, second.inputHash, second.degraded, second.flagged, second.sessionId], [{ a: 2 }, "h2", true, true, "s2"]);
  assert.equal(payloads[0].create.version, 1);
  assert.deepEqual(Object.keys(payloads[1].update).sort(), ["content", "degraded", "flagged", "inputHash", "sessionId", "version"]);
  assert.deepEqual(payloads[1].update.version, { increment: 1 });
});

test("total under a date filter and findMany and count share the same where", async () => {
  const r = await listLeadStandups(db, P, ["d1", "d2"], { date: "2026-11-09", page: 0, size: 1 });
  assert.equal(r.total, 2);
  assert.equal(r.items.length, 1);
  assert.deepEqual(lastFind.where, lastCount);
});

test("E37 a row in another project is never returned", async () => {
  assert.equal(await findStandup(db, P, "d2", "2026-11-09").then((x) => x?.id), "2");
  assert.equal(await findStandup(db, "other", "d1", "2026-11-09"), null);
  const r = await listLeadStandups(db, "other", ["d2"], { page: 0, size: 10 });
  assert.deepEqual(r.items.map((s) => s.id), ["6"]);
  assert.ok((await listLeadStandups(db, P, ["d2"], { page: 0, size: 10 })).items.every((s) => s.id !== "6"));
});

test("E38 a developerId outside the member list yields empty items and zero total", async () => {
  const r = await listLeadStandups(db, P, ["d1", "d2"], { developerId: "gone", page: 0, size: 10 });
  assert.deepEqual([r.items, r.total], [[], 0]);
});

test("toStandup maps every field", () => {
  const s = toStandup(row("9", "d1", "2026-11-09", { degraded: true, flagged: true, outcome: "EDITED", feedback: "UP", version: 3 }) as never, false);
  assert.deepEqual(s, { id: "9", projectId: P, developerId: "d1", date: "2026-11-09", content: { yesterday: [], today: [], blockers: [] }, degraded: true, flagged: true, cached: false, outcome: "EDITED", feedback: "UP", createdAt: "2026-11-09T01:00:00.000Z", updatedAt: "2026-11-09T02:00:00.000Z", version: 3 });
});
