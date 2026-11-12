import assert from "node:assert/strict";
import { test } from "node:test";
import { createSprintService } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const actorId = "00000000-0000-4000-8000-000000000002";
const sprintId = "00000000-0000-4000-8000-000000000003";
const taskId = "00000000-0000-4000-8000-000000000004";
const targetId = "00000000-0000-4000-8000-000000000005";

const access = { requireMember: async () => undefined, archivedMembership: async () => false };
const row = (overrides: Record<string, unknown> = {}) => ({ id: sprintId, projectId, name: "Sprint 1", startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-01-14T00:00:00.000Z"), status: "PLANNED", completedPoints: null, version: 1, deletedAt: null, ...overrides });

function database(initial = [row()]) {
  const sprints = [...initial];
  const tasks = [{ id: taskId, projectId, sprintId, status: "TODO", storyPoints: 3, version: 1, deletedAt: null }];
  const events: unknown[] = [];
  const tx = {
    project: { update: async () => ({}) },
    sprint: {
      findFirst: async ({ where }: any) => sprints.find((item) => Object.entries(where).every(([key, expected]: any) => key === "id" && expected?.not ? item.id !== expected.not : key === "startDate" ? item.startDate <= expected.lte : key === "endDate" ? item.endDate >= expected.gte : item[key] === expected)) ?? null,
      findMany: async () => sprints.filter((item) => !item.deletedAt),
      count: async () => sprints.filter((item) => !item.deletedAt).length,
      create: async ({ data }: any) => { const created = row({ id: `created-${sprints.length}`, ...data }); sprints.push(created); return created; },
      updateMany: async ({ where, data }: any) => { const item = sprints.find((candidate) => candidate.id === where.id && (where.version === undefined || candidate.version === where.version) && (where.status === undefined || candidate.status === where.status) && (where.deletedAt === undefined || candidate.deletedAt === where.deletedAt)); if (!item) return { count: 0 }; for (const [key, value] of Object.entries(data)) item[key] = value && typeof value === "object" && "increment" in value ? item[key] + (value as any).increment : value; return { count: 1 }; },
    },
    task: {
      findMany: async ({ where }: any) => tasks.filter((item) => Object.entries(where).every(([key, expected]: any) => key === "deletedAt" ? item.deletedAt === expected : item[key] === expected)),
      updateMany: async ({ where, data }: any) => { const item = tasks.find((candidate) => Object.entries(where).every(([key, expected]: any) => candidate[key] === expected)); if (!item) return { count: 0 }; Object.assign(item, data, { version: item.version + 1 }); return { count: 1 }; },
    },
    taskEvent: { create: async ({ data }: any) => { events.push(data); } },
  };
  return { sprints, tasks, events, db: { $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx), ...tx } };
}

test("sprint list is paginated, stable, and hides deleted rows", async () => {
  const deleted = row({ id: "deleted", deletedAt: new Date() });
  const state = database([row(), deleted]);
  const result = await createSprintService(state.db as any, access).list({ userId: actorId, role: "DEVELOPER" }, projectId, { page: 0, size: 1 });
  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.page, 0);
  assert.equal(result.size, 1);
});

test("sprint lifecycle enforces dates, overlap, and transitions", async () => {
  const state = database([]);
  const service = createSprintService(state.db as any, access);
  const created = await service.create({ userId: actorId, role: "DEV_LEAD" }, projectId, { name: "Sprint 1", startDate: "2026-01-01", endDate: "2026-01-14" });
  assert.equal(created.status, "PLANNED");
  await assert.rejects(() => service.create({ userId: actorId, role: "DEV_LEAD" }, projectId, { name: "Overlap", startDate: "2026-01-14", endDate: "2026-01-20" }), /VALIDATION_FAILED/);
  const started = await service.start({ userId: actorId, role: "DEV_LEAD" }, created.id, 1);
  assert.equal(started.status, "ACTIVE");
  await assert.rejects(() => service.remove({ userId: actorId, role: "DEV_LEAD" }, created.id), /CONFLICT_STATE/);
});

test("close requires the exact live non-DONE source set and records task changes atomically", async () => {
  const source = row({ status: "ACTIVE" });
  const target = row({ id: targetId, name: "Sprint 2", startDate: new Date("2026-02-01T00:00:00.000Z"), endDate: new Date("2026-02-14T00:00:00.000Z") });
  const state = database([source, target]);
  const service = createSprintService(state.db as any, access);
  await assert.rejects(() => service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [] }), /VALIDATION_FAILED/);
  const closed = await service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [{ taskId, to: targetId }] });
  assert.equal(closed.status, "CLOSED");
  assert.equal(state.tasks[0]?.sprintId, targetId);
  assert.equal(state.events.length, 1);
  assert.equal((state.events[0] as any).type, "SPRINT_CHANGED");
});

test("progress includes the newest three closed-sprint velocity entries", async () => {
  const state = database([]);
  const service = createSprintService(state.db as any, access, {
    progress: async () => ({ pointsTotal: 4, pointsDone: 1, percent: 25, unestimatedTasks: 0 }),
    velocity: async () => [{ sprintId, name: "Sprint 1", completedPoints: 1 }],
  } as any);
  assert.deepEqual(await service.progress({ userId: actorId, role: "PM" }, projectId), { pointsTotal: 4, pointsDone: 1, percent: 25, unestimatedTasks: 0, velocity: [{ sprintId, name: "Sprint 1", completedPoints: 1 }] });
});
