import assert from "node:assert/strict";
import { test } from "node:test";
import { NotMember } from "@agile/contracts";
import { createEpics } from "../src/epics.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const checkpointId = "00000000-0000-4000-8000-000000000003";
const now = new Date("2026-11-08T00:00:00.000Z");
const access = (member = true) => ({ requireMember: async () => { if (!member) throw new NotMember(); }, archivedMembership: async () => false });

test("E8 and E37 epic creation locks the project and rejects cross-project checkpoints", async () => {
  const calls: string[] = [];
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
    return work({ project: { findFirst: async (args: any) => { calls.push("lock"); assert.equal(args.lock.mode, "ForUpdate"); return { id: projectId }; } }, checkpoint: { findFirst: async () => null }, epic: { count: async () => 0, create: async () => { throw new Error("must not create"); } } });
  } };
  await assert.rejects(() => createEpics(db as any, access()).create({ userId, role: "PM" }, projectId, { title: "E", checkpointId }), /VALIDATION_FAILED/);
  assert.deepEqual(calls, ["lock"]);
});

test("epic creation serializes the next position and lists live aggregates", async () => {
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ project: { findFirst: async () => ({ id: projectId }) }, epic: { count: async () => 4, create: async (args: any) => ({ id: "00000000-0000-4000-8000-000000000004", projectId, checkpointId: null, title: args.data.title, description: null, position: args.data.position, createdAt: now, updatedAt: now, version: 1 }) } }), epic: { findMany: async () => [{ id: "00000000-0000-4000-8000-000000000004", projectId, checkpointId: null, title: "E", description: null, position: 5, createdAt: now, updatedAt: now, version: 1, _count: { tasks: 2 }, _sum: { tasks: { storyPoints: 8 } } }] } };
  const epics = createEpics(db as any, access());
  assert.equal((await epics.create({ userId, role: "DEV_LEAD" }, projectId, { title: "E" })).position, 5);
  assert.deepEqual(await epics.list({ userId, role: "DEVELOPER" }, projectId), [{ id: "00000000-0000-4000-8000-000000000004", projectId, checkpointId: null, title: "E", description: null, position: 5, taskCount: 2, pointsTotal: 8, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 1 }]);
});
