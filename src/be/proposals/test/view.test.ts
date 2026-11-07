import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createDbClient } from "@agile/db";
import { createProposal, createProposalResolvers, getProposalView, toPlanEpic } from "../src/index.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";

const epicRow = (over: Partial<Parameters<typeof toPlanEpic>[0]>) => ({
  proposalId: randomUUID(), index: 0, title: "t", description: "d", checkpointName: null, contentHash: "h",
  expansionStatus: "IN_PROGRESS" as const, leaseExpiresAt: null as Date | null, tasks: null, error: null, ...over,
});

test("E20 a lease equal to now stays IN_PROGRESS; one millisecond earlier shows PENDING", () => {
  const now = new Date("2026-11-07T10:00:00.000Z");
  assert.equal(toPlanEpic(epicRow({ leaseExpiresAt: new Date(now.getTime()) }), now).expansion.status, "IN_PROGRESS");
  assert.equal(toPlanEpic(epicRow({ leaseExpiresAt: new Date(now.getTime() - 1) }), now).expansion.status, "PENDING");
  assert.equal(toPlanEpic(epicRow({ leaseExpiresAt: new Date(now.getTime() + 1) }), now).expansion.status, "IN_PROGRESS");
  assert.equal(toPlanEpic(epicRow({ expansionStatus: "DONE" as const, leaseExpiresAt: new Date(now.getTime() - 5) }), now).expansion.status, "DONE");
});

test("E51 a PM who is not a member of the retrieved item's project does not see it", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, f) => {
    const pm1 = await f.user();
    const pm2 = await f.user();
    const a = await f.project(pm1);
    const b = await f.project(pm1);
    await f.member(a, pm1); await f.member(b, pm1); await f.member(a, pm2);
    const itemA = await f.epic(a, "Item in A");
    const itemB = await f.epic(b, "Item in B");
    const pm3 = await f.user();
    const epicInB = await f.epic(b, "Epic holding the task");
    const taskB = (await base.task.create({ data: { projectId: b, epicId: epicInB, title: "Task in B", createdBy: pm1 } })).id;
    const sessionId = await f.aiSession(pm1, a);
    const db = createDbClient(base);
    const id = await createProposal(db, {
      projectId: a, creatorId: pm1, sessionId, flagged: false, approach: "x", checkpoints: [],
      retrieved: [{ source: "EPIC", projectId: a, id: itemA }, { source: "EPIC", projectId: b, id: itemB }, { source: "EPIC", projectId: a, id: randomUUID() }, { source: "TASK", projectId: b, id: taskB }],
      epics: [{ title: "E", description: "d", checkpointName: null }],
    });
    const forPm1 = await getProposalView(db, id, pm1);
    assert.deepEqual(forPm1?.retrieved.map((r) => r.id).sort(), [itemA, itemB, taskB].sort());
    assert.equal(forPm1?.retrieved.find((r) => r.id === taskB)?.title, "Task in B");
    assert.equal(forPm1?.retrieved.find((r) => r.id === itemB)?.title, "Item in B");
    assert.equal(forPm1?.retrieved.find((r) => r.id === itemB)?.projectName.startsWith("Proposals test"), true);
    const forPm2 = await getProposalView(db, id, pm2);
    assert.deepEqual(forPm2?.retrieved.map((r) => r.id), [itemA]);
    assert.equal(forPm2?.retrieved.some((r) => r.id === taskB), false);
    const forPm3 = await getProposalView(db, id, pm3);
    assert.deepEqual(forPm3?.retrieved, []);
    assert.equal(forPm3?.epics.length, 1);
    assert.equal(forPm2?.epics.length, 1);
    assert.equal(forPm2?.version, 1);
    assert.equal(await getProposalView(db, randomUUID(), pm1), null);
  });
});

test("E20 a stored IN_PROGRESS lease in the past is read back as PENDING", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, f) => {
    const pm = await f.user();
    const a = await f.project(pm);
    await f.member(a, pm);
    const sessionId = await f.aiSession(pm, a);
    const db = createDbClient(base);
    const id = await createProposal(db, { projectId: a, creatorId: pm, sessionId, flagged: false, approach: "x", checkpoints: [], retrieved: [], epics: [{ title: "E", description: "d", checkpointName: null }] });
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId: id, index: 0 } }, data: { expansionStatus: "IN_PROGRESS", leaseExpiresAt: new Date(Date.now() - 60_000) } });
    assert.equal((await getProposalView(db, id, pm))?.epics[0].expansion.status, "PENDING");
  });
});

test("resolvers return null for non-uuid and unknown ids and the project for a known proposal", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, f) => {
    const pm = await f.user();
    const a = await f.project(pm);
    const sessionId = await f.aiSession(pm, a);
    const db = createDbClient(base);
    const id = await createProposal(db, { projectId: a, creatorId: pm, sessionId, flagged: false, approach: "x", checkpoints: [], retrieved: [], epics: [{ title: "E", description: "d", checkpointName: null }] });
    const resolve = createProposalResolvers(db);
    assert.equal(await resolve("op", { params: { proposalId: "nope" } }), null);
    assert.equal(await resolve("op", { params: { proposalId: randomUUID() } }), null);
    assert.equal(await resolve("op", {}), null);
    assert.deepEqual(await resolve("op", { params: { proposalId: id } }), { kind: "PROPOSAL", projectId: a, ownerId: pm, state: "ACTIVE" });
  });
});
