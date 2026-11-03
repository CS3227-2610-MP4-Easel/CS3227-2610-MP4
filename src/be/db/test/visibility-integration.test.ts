import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createDbClient } from "../src/client.js";

const url = process.env.W1_INTEGRATION_DATABASE_URL;

test("filtered Prisma reads enforce visibility through selections, omissions, relations and transactions", { skip: !url }, async () => {
  const base = new PrismaClient({ datasourceUrl: url });
  const db = createDbClient(base);
  const id = randomUUID();
  let userId = "";
  let activeId = "";
  let archivedId = "";
  try {
    const user = await base.user.create({ data: { firebaseUid: id, email: `${id}@example.test`, displayName: "Test", role: "PM" } });
    userId = user.id;
    const active = await base.project.create({ data: { name: "Active", createdBy: userId } });
    activeId = active.id;
    const archived = await base.project.create({ data: { name: "Archived", createdBy: userId, status: "ARCHIVED" } });
    archivedId = archived.id;
    await base.projectMember.createMany({ data: [{ projectId: activeId, userId, addedBy: userId }, { projectId: archivedId, userId, addedBy: userId }] });
    const epic = await base.epic.create({ data: { projectId: activeId, title: "Deleted", position: 1, deletedAt: new Date() } });
    await base.task.create({ data: { projectId: activeId, epicId: epic.id, title: "Task", createdBy: userId } });

    assert.deepEqual(await db.project.findMany({ where: { id: activeId }, select: { id: true } }), [{ id: activeId }]);
    const task = await db.task.findFirstOrThrow({ where: { projectId: activeId }, select: { title: true, epic: { select: { title: true } } } });
    assert.deepEqual(task, { title: "Task", epic: null });
    const omitted = await db.task.findFirstOrThrow({ where: { projectId: activeId }, include: { epic: { omit: { deletedAt: true } } } });
    assert.equal(omitted.epic, null);
    const project = await db.project.findUniqueOrThrow({ where: { id: activeId }, include: { creator: { include: { memberships: true } } } });
    assert.deepEqual(project.creator.memberships.map((member) => member.projectId), [activeId]);
    await db.$transaction(async (tx) => {
      assert.equal((tx as any).$queryRaw, undefined);
      assert.deepEqual(await tx.project.findMany({ where: { id: activeId }, select: { id: true } }), [{ id: activeId }]);
    });
  } finally {
    if (activeId) {
      await base.task.deleteMany({ where: { projectId: activeId } });
      await base.epic.deleteMany({ where: { projectId: activeId } });
    }
    if (userId) await base.projectMember.deleteMany({ where: { userId } });
    if (activeId || archivedId) await base.project.deleteMany({ where: { id: { in: [activeId, archivedId].filter(Boolean) } } });
    if (userId) await base.user.delete({ where: { id: userId } });
    await base.$disconnect();
  }
});
