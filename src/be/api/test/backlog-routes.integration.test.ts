import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createDbClient } from "@agile/db";
import { resetContextRegistries } from "@agile/ai-context/testing";
import { createApiApp } from "../src/app.js";
import { createCoreComposition } from "../src/core-composition.js";
import { createAppDependencies } from "../src/deps.js";

test("backlog routes enforce role and membership and reject foreign checkpoints without writing", async () => {
  if (!process.env.W1_INTEGRATION_DATABASE_URL) throw new Error("integration database required");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.W1_INTEGRATION_DATABASE_URL }) });
  const token = randomUUID();
  const users = await Promise.all(["PM", "DEVELOPER", "PM"].map((role, i) => db.user.create({ data: { firebaseUid: `${token}-${i}`, email: `${token}-${i}@example.test`, displayName: `Backlog ${i}`, role: role as "PM" | "DEVELOPER" } })));
  const projects: string[] = [];
  try {
    const project = await db.project.create({ data: { name: "test", createdBy: users[0]!.id } });
    const other = await db.project.create({ data: { name: "other", createdBy: users[2]!.id } });
    projects.push(project.id, other.id);
    await db.projectMember.createMany({ data: [{ projectId: project.id, userId: users[0]!.id, addedBy: users[0]!.id }, { projectId: project.id, userId: users[1]!.id, addedBy: users[0]!.id }, { projectId: other.id, userId: users[2]!.id, addedBy: users[2]!.id }] });
    const cp = await db.checkpoint.create({ data: { projectId: project.id, name: "Check", targetDate: new Date("2026-12-01") } });
    const foreign = await db.checkpoint.create({ data: { projectId: other.id, name: "Other", targetDate: new Date("2026-12-01") } });
    const epic = await db.epic.create({ data: { projectId: project.id, title: "Epic", checkpointId: cp.id, position: 0 } });
    await db.sprint.createMany({ data: [{ projectId: project.id, name: "late", startDate: new Date("2026-12-01"), endDate: new Date("2026-12-15") }, { projectId: project.id, name: "early", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-15") }, { projectId: other.id, name: "foreign", startDate: new Date("2026-10-01"), endDate: new Date("2026-10-15") }] });
    const runtime = { db: createDbClient(db), resolvePrincipal: async (header?: string) => ({ firebaseUid: header?.slice(7) ?? "", tokenClaims: {} }), lookupRegisteredUser: async (uid: string) => { const user = users.find(u => u.firebaseUid === uid); return user ? { firebaseUid: uid, userId: user.id, role: user.role } : null; }, lookupUserByEmail: async () => null, lookupUserRole: async () => null, lookupArchivedMembership: async () => false };
    resetContextRegistries();
    const composition = createCoreComposition(runtime as never);
    const app = createApiApp(createAppDependencies(runtime as never, composition), composition.routes);
    const request = (path: string, index: number, method = "GET", body?: object) => app.request(`http://localhost/api${path}`, { method, headers: { authorization: `Bearer ${users[index]!.firebaseUid}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const listed = await request(`/projects/${project.id}/sprints`, 0);
    assert.equal(listed.status, 200); assert.deepEqual((await listed.json() as any[]).map(s => s.name), ["early", "late"]);
    assert.equal((await request(`/projects/${project.id}/sprints`, 2)).status, 404);
    assert.equal((await request(`/checkpoints/${cp.id}`, 1, "PATCH", { name: "bad", version: 1 })).status, 403);
    assert.equal((await request(`/checkpoints/${cp.id}`, 2, "PATCH", { name: "bad", version: 1 })).status, 404);
    assert.equal((await request(`/epics/${epic.id}`, 0, "PATCH", { checkpointId: foreign.id, version: 1 })).status, 422);
    assert.equal((await db.checkpoint.findUniqueOrThrow({ where: { id: cp.id } })).name, "Check");
    assert.equal((await db.epic.findUniqueOrThrow({ where: { id: epic.id } })).checkpointId, cp.id);
    assert.equal((await request(`/checkpoints/${cp.id}`, 0, "PATCH", { name: "new", version: 1 })).status, 200);
    assert.equal((await request(`/checkpoints/${cp.id}`, 0, "PATCH", { name: "stale", version: 1 })).status, 409);
  } finally {
    await db.epic.deleteMany({ where: { projectId: { in: projects } } });
    await db.checkpoint.deleteMany({ where: { projectId: { in: projects } } });
    await db.sprint.deleteMany({ where: { projectId: { in: projects } } });
    await db.projectMember.deleteMany({ where: { projectId: { in: projects } } });
    await db.project.deleteMany({ where: { id: { in: projects } } });
    await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    await db.$disconnect();
    resetContextRegistries();
  }
});
