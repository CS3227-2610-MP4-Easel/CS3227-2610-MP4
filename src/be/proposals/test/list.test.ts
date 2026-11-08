import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createDbClient } from "@agile/db";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createProposal, listProposals } from "../src/index.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";

const opts = { skip: !integrationUrl };

test("W7b E48 E50 E51 filters, orders ties, and excludes REPLAN", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const pm = await f.user(); const projectId = await f.project(pm); await f.member(projectId, pm);
    const db = createDbClient(base);
    const make = async () => createProposal(db, { projectId, creatorId: pm, sessionId: await f.aiSession(pm, projectId), flagged: false, approach: "x", checkpoints: [], retrieved: [], epics: [] });
    const ids = [await make(), await make(), await make()];
    await base.aiProposal.updateMany({ where: { id: { in: ids } }, data: { createdAt: new Date("2026-01-01") } });
    await base.aiProposal.update({ where: { id: ids[2] }, data: { kind: "REPLAN" } });
    const result = await listProposals(db, { projectId, viewerId: pm, status: "PENDING", page: 1, size: 1 });
    assert.equal(result?.total, 2); assert.equal(result?.items[0].id, ids.slice(0, 2).sort().reverse()[1]);
    assert.deepEqual(await listProposals(db, { projectId, viewerId: pm, page: 9, size: 1 }), { items: [], page: 9, size: 1, total: 2 });
    assert.equal(await listProposals(db, { projectId, viewerId: randomUUID(), page: 0, size: 1 }), null);
  });
});

test("W7b E52 retrieved titles are filtered per viewer membership", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const a = await f.user(); const b = await f.user(); const p = await f.project(a); const other = await f.project(a);
    await f.member(p, a); await f.member(p, b); await f.member(other, a);
    const epicA = await f.epic(p); const epicB = await f.epic(other);
    const db = createDbClient(base);
    await createProposal(db, { projectId: p, creatorId: a, sessionId: await f.aiSession(a, p), flagged: false, approach: "x", checkpoints: [], epics: [], retrieved: [{ source: "EPIC", projectId: p, id: epicA }, { source: "EPIC", projectId: other, id: epicB }] });
    const list = (viewerId: string) => listProposals(db, { projectId: p, viewerId, page: 0, size: 20 });
    assert.deepEqual((await list(a))?.items[0].retrieved.map(x => x.id), [epicA, epicB]);
    assert.deepEqual((await list(b))?.items[0].retrieved.map(x => x.id), [epicA]);
  });
});

test("W7b E53 N3 a full page uses at most eight queries", opts, async () => {
  const logged = new PrismaClient({ adapter: new PrismaPg({ connectionString: integrationUrl }), log: [{ emit: "event", level: "query" }] });
  try {
    await withIntegrationDb(async (base, f) => {
      const pm = await f.user(); const projectId = await f.project(pm); await f.member(projectId, pm);
      const epicId = await f.epic(projectId);
      const taskId = (await base.task.create({ data: { projectId, epicId, title: "Task", createdBy: pm } })).id;
      const db = createDbClient(base);
      for (let n = 0; n < 20; n++) {
        await createProposal(db, { projectId, creatorId: pm, sessionId: await f.aiSession(pm, projectId), flagged: false, approach: "x", checkpoints: [], retrieved: [{ source: "EPIC", projectId, id: epicId }, { source: "TASK", projectId, id: taskId }], epics: Array.from({ length: 10 }, (_, i) => ({ title: `Epic ${i}`, description: "d", checkpointName: null })) });
      }
      let count = 0; let capture = false;
      (logged as unknown as { $on(event: "query", cb: () => void): void }).$on("query", () => { if (capture) count++; });
      capture = true;
      const result = await listProposals(createDbClient(logged), { projectId, viewerId: pm, page: 0, size: 20 });
      capture = false;
      assert.equal(result?.items.length, 20); assert.equal(result?.items[0].epics.length, 10);
      assert.ok(count <= 8, `query count: ${count}`);
      console.log(`N3 query count: ${count}`);
    });
  } finally { await logged.$disconnect(); }
});
