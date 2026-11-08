import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NotMember } from "@agile/contracts";
import { createEpics, lockProjectForEpicPosition } from "../src/epics.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const checkpointId = "00000000-0000-4000-8000-000000000003";
const now = new Date("2026-11-08T00:00:00.000Z");
const access = (member = true) => ({ requireMember: async () => { if (!member) throw new NotMember(); }, archivedMembership: async () => false });

test("E8 and E37 epic creation uses the supported project lock helper and rejects cross-project checkpoints", async () => {
  const calls: string[] = [];
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
    return work({ project: { update: async (args: any) => { calls.push("lock"); assert.deepEqual(args, { where: { id: projectId }, data: { version: { increment: 0 } } }); return { id: projectId }; } }, checkpoint: { findFirst: async () => null }, epic: { count: async () => 0, create: async () => { throw new Error("must not create"); } } });
  } };
  await assert.rejects(() => createEpics(db as any, access()).create({ userId, role: "PM" }, projectId, { title: "E", checkpointId }), /VALIDATION_FAILED/);
  assert.deepEqual(calls, ["lock"]);
});

test("epic creation serializes the next position and computes points from live task rows", async () => {
  const epic = { aggregate: async () => ({ _max: { position: 4 } }), create: async (args: any) => ({ id: "00000000-0000-4000-8000-000000000004", projectId, checkpointId: null, title: args.data.title, description: null, position: args.data.position, createdAt: now, updatedAt: now, version: 1 }), findMany: async (args: any) => { assert.equal(args.skip, 20); assert.equal(args.take, 20); assert.deepEqual(args.include, { _count: { select: { tasks: true } }, tasks: { select: { storyPoints: true } } }); return [{ id: "00000000-0000-4000-8000-000000000004", projectId, checkpointId: null, title: "E", description: null, position: 5, createdAt: now, updatedAt: now, version: 1, _count: { tasks: 2 }, tasks: [{ storyPoints: 5 }, { storyPoints: null }] }]; } };
  const db = { $transaction: async (work: (tx: any) => Promise<unknown>) => work({ project: { update: async () => ({ id: projectId }) }, epic }), epic: { ...epic, count: async () => 21 } };
  const epics = createEpics(db as any, access());
  assert.equal((await epics.create({ userId, role: "DEV_LEAD" }, projectId, { title: "E" })).position, 5);
  assert.deepEqual(await epics.list({ userId, role: "DEVELOPER" }, projectId, { page: 1, size: 20 }), { items: [{ id: "00000000-0000-4000-8000-000000000004", projectId, checkpointId: null, title: "E", description: null, position: 5, taskCount: 2, pointsTotal: 5, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 1 }], page: 1, size: 20, total: 21 });
});

test("project-position lock helper runs against a real Prisma client", { skip: !process.env.W1_INTEGRATION_DATABASE_URL }, async () => {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.W1_INTEGRATION_DATABASE_URL! }) });
  const token = randomUUID();
  let createdProject = "";
  let createdUser = "";
  try {
    const user = await base.user.create({ data: { firebaseUid: token, email: `${token}@example.test`, displayName: "Lock test", role: "PM" } });
    createdUser = user.id;
    const project = await base.project.create({ data: { name: "Lock test", createdBy: user.id } });
    createdProject = project.id;
    await base.$transaction((tx) => lockProjectForEpicPosition(tx, project.id));
    assert.equal((await base.project.findUniqueOrThrow({ where: { id: project.id } })).version, 1);
  } finally {
    if (createdProject) await base.project.delete({ where: { id: createdProject } });
    if (createdUser) await base.user.delete({ where: { id: createdUser } });
    await base.$disconnect();
  }
});
