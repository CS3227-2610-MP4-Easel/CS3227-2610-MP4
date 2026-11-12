import assert from "node:assert/strict";
import { test } from "node:test";
import { createDerived, createSprintService } from "../src/index.js";

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
      findMany: async ({ skip = 0, take = Number.MAX_SAFE_INTEGER }: any = {}) => sprints.filter((item) => !item.deletedAt).slice(skip, skip + take),
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

const matches = (item: Record<string, any>, where: Record<string, any>) => Object.entries(where).every(([key, expected]) => {
  if (expected && typeof expected === "object") {
    if ("not" in expected) return item[key] !== expected.not;
    if ("lte" in expected) return item[key] <= expected.lte;
    if ("gte" in expected) return item[key] >= expected.gte;
  }
  return item[key] === expected;
});

function transactionalDatabase(initialSprints: Record<string, any>[], initialTasks: Record<string, any>[], options: { failEvents?: boolean } = {}) {
  const state = { sprints: initialSprints.map((item) => ({ ...item })), tasks: initialTasks.map((item) => ({ ...item })), events: [] as Record<string, any>[] };
  let tail = Promise.resolve();
  const clone = () => ({ sprints: state.sprints.map((item) => ({ ...item })), tasks: state.tasks.map((item) => ({ ...item })), events: state.events.map((item) => ({ ...item })) });
  const makeTx = (local: ReturnType<typeof clone>) => ({
    project: { update: async () => ({}) },
    sprint: {
      findFirst: async ({ where }: any) => local.sprints.find((item) => matches(item, where)) ?? null,
      findMany: async ({ where, skip = 0, take = Number.MAX_SAFE_INTEGER }: any = {}) => local.sprints.filter((item) => matches(item, where ?? {}) && !item.deletedAt).slice(skip, skip + take),
      count: async ({ where }: any = {}) => local.sprints.filter((item) => matches(item, where ?? {}) && !item.deletedAt).length,
      create: async ({ data }: any) => { const created = { id: `created-${local.sprints.length}`, version: 1, status: "PLANNED", completedPoints: null, deletedAt: null, ...data }; local.sprints.push(created); return created; },
      updateMany: async ({ where, data }: any) => { const item = local.sprints.find((candidate) => matches(candidate, where)); if (!item) return { count: 0 }; for (const [key, value] of Object.entries(data)) item[key] = value && typeof value === "object" && "increment" in value ? item[key] + (value as any).increment : value; return { count: 1 }; },
    },
    task: {
      findMany: async ({ where }: any) => local.tasks.filter((item) => matches(item, where)),
      updateMany: async ({ where, data }: any) => { const item = local.tasks.find((candidate) => matches(candidate, where)); if (!item) return { count: 0 }; for (const [key, value] of Object.entries(data)) item[key] = value && typeof value === "object" && "increment" in value ? item[key] + (value as any).increment : value; return { count: 1 }; },
    },
    taskEvent: { create: async ({ data }: any) => { if (options.failEvents) throw new Error("event failed"); local.events.push(data); } },
  });
  const db = {
    $transaction: async (work: (tx: any) => Promise<unknown>) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const local = clone();
      try {
        const result = await work(makeTx(local));
        state.sprints = local.sprints;
        state.tasks = local.tasks;
        state.events = local.events;
        return result;
      } finally {
        release();
      }
    },
  };
  return { state, db };
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

test("E1 rejects reversed dates before creating a sprint", async () => {
  const state = database([]);
  await assert.rejects(() => createSprintService(state.db as any, access).create({ userId: actorId, role: "DEV_LEAD" }, projectId, { name: "Invalid", startDate: "2026-02-02", endDate: "2026-02-01" }), /VALIDATION_FAILED/);
  assert.equal(state.sprints.length, 0);
});

test("E3 rejects mutations of active, closed, and deleted sprints without changing them", async () => {
  const activeId = "active-sprint";
  const closedId = "closed-sprint";
  const deletedId = "deleted-sprint";
  const state = database([row({ id: activeId, status: "ACTIVE" }), row({ id: closedId, status: "CLOSED" }), row({ id: deletedId, deletedAt: new Date() })]);
  const service = createSprintService(state.db as any, access);
  await assert.rejects(() => service.patch({ userId: actorId, role: "DEV_LEAD" }, activeId, { name: "Nope", version: 1 }), /CONFLICT_STATE/);
  await assert.rejects(() => service.remove({ userId: actorId, role: "DEV_LEAD" }, closedId), /CONFLICT_STATE/);
  await assert.rejects(() => service.remove({ userId: actorId, role: "DEV_LEAD" }, deletedId), /CONFLICT_STATE/);
  assert.equal(state.sprints.find((item) => item.id === activeId)?.status, "ACTIVE");
  assert.equal(state.sprints.find((item) => item.id === closedId)?.status, "CLOSED");
  assert.ok(state.sprints.find((item) => item.id === deletedId)?.deletedAt);
});

test("E4 serializes two starts so one wins and the loser sees CONFLICT_STATE", async () => {
  const firstId = "first-sprint";
  const secondId = "second-sprint";
  const state = transactionalDatabase([row({ id: firstId }), row({ id: secondId, startDate: new Date("2026-02-01T00:00:00.000Z"), endDate: new Date("2026-02-14T00:00:00.000Z") })], []);
  const service = createSprintService(state.db as any, access);
  const results = await Promise.allSettled([
    service.start({ userId: actorId, role: "DEV_LEAD" }, firstId, { version: 1 }),
    service.start({ userId: actorId, role: "DEV_LEAD" }, secondId, { version: 1 }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && (result.reason as Error).message === "CONFLICT_STATE").length, 1);
  assert.equal(state.state.sprints.filter((item) => item.status === "ACTIVE").length, 1);
});

test("E5-E7 reject incomplete, invalid-target, and DONE-task carry-over without mutation", async () => {
  const source = row({ status: "ACTIVE" });
  const planned = row({ id: targetId, name: "Target", startDate: new Date("2026-02-01T00:00:00.000Z"), endDate: new Date("2026-02-14T00:00:00.000Z") });
  const doneId = "done-task";
  const tasks = [{ id: taskId, projectId, sprintId, status: "TODO", storyPoints: 3, version: 1, deletedAt: null }, { id: doneId, projectId, sprintId, status: "DONE", storyPoints: 1, version: 1, deletedAt: null }];
  const state = transactionalDatabase([source, planned], tasks);
  const service = createSprintService(state.db as any, access);
  const before = JSON.stringify(state.state);
  await assert.rejects(() => service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [] }), /VALIDATION_FAILED/);
  assert.equal(JSON.stringify(state.state), before);
  await assert.rejects(() => service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [{ taskId, to: "foreign-target" }] }), /VALIDATION_FAILED/);
  assert.equal(JSON.stringify(state.state), before);
  await assert.rejects(() => service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [{ taskId, to: targetId }, { taskId: doneId, to: targetId }] }), /VALIDATION_FAILED/);
  assert.equal(JSON.stringify(state.state), before);
});

test("E6 rejects deleted, active, and closed carry-over targets with the exact state error", async () => {
  const source = row({ status: "ACTIVE" });
  const deleted = row({ id: "deleted-target", deletedAt: new Date() });
  const active = row({ id: "active-target", status: "ACTIVE", startDate: new Date("2026-02-01T00:00:00.000Z"), endDate: new Date("2026-02-14T00:00:00.000Z") });
  const closed = row({ id: "closed-target", status: "CLOSED", startDate: new Date("2026-03-01T00:00:00.000Z"), endDate: new Date("2026-03-14T00:00:00.000Z") });
  const state = transactionalDatabase([source, deleted, active, closed], [{ id: taskId, projectId, sprintId, status: "TODO", storyPoints: 3, version: 1, deletedAt: null }]);
  const service = createSprintService(state.db as any, access);
  for (const target of [deleted.id, active.id, closed.id]) {
    const before = JSON.stringify(state.state);
    await assert.rejects(() => service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [{ taskId, to: target }] }), /CONFLICT_STATE/);
    assert.equal(JSON.stringify(state.state), before);
  }
});

test("E8 rejects a close retry and does not duplicate task events", async () => {
  const source = row({ status: "ACTIVE" });
  const target = row({ id: targetId, startDate: new Date("2026-02-01T00:00:00.000Z"), endDate: new Date("2026-02-14T00:00:00.000Z") });
  const state = transactionalDatabase([source, target], [{ id: taskId, projectId, sprintId, status: "TODO", storyPoints: 3, version: 1, deletedAt: null }]);
  const service = createSprintService(state.db as any, access);
  await service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [{ taskId, to: targetId }] });
  const events = state.state.events.length;
  await assert.rejects(() => service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 2, carryOver: [{ taskId, to: targetId }] }), /CONFLICT_STATE/);
  assert.equal(state.state.events.length, events);
  assert.equal(state.state.sprints.find((item) => item.id === sprintId)?.status, "CLOSED");
});

test("E9 removes a planned sprint and clears assigned tasks in the same transaction", async () => {
  const state = transactionalDatabase([row()], [{ id: taskId, projectId, sprintId, status: "TODO", storyPoints: 3, version: 1, deletedAt: null }]);
  const service = createSprintService(state.db as any, access);
  await service.remove({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1 });
  assert.ok(state.state.sprints[0]?.deletedAt);
  assert.equal(state.state.tasks[0]?.sprintId, null);
  assert.equal(state.state.events.length, 1);
});

test("E18 rolls back sprint status, task movement, and events when event insertion fails", async () => {
  const source = row({ status: "ACTIVE" });
  const target = row({ id: targetId, startDate: new Date("2026-02-01T00:00:00.000Z"), endDate: new Date("2026-02-14T00:00:00.000Z") });
  const state = transactionalDatabase([source, target], [{ id: taskId, projectId, sprintId, status: "TODO", storyPoints: 3, version: 1, deletedAt: null }], { failEvents: true });
  const service = createSprintService(state.db as any, access);
  const before = JSON.stringify(state.state);
  await assert.rejects(() => service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [{ taskId, to: targetId }] }), /event failed/);
  assert.equal(JSON.stringify(state.state), before);
});

test("E21 returns live sprint pages with bounded metadata and rejects out-of-range pages", async () => {
  const liveTwo = row({ id: "live-two", startDate: new Date("2026-02-01T00:00:00.000Z"), endDate: new Date("2026-02-14T00:00:00.000Z") });
  const deleted = row({ id: "deleted-page", deletedAt: new Date(), startDate: new Date("2026-03-01T00:00:00.000Z") });
  const state = database([row(), liveTwo, deleted]);
  const service = createSprintService(state.db as any, access);
  const first = await service.list({ userId: actorId, role: "PM" }, projectId, { page: 0, size: 1 });
  const second = await service.list({ userId: actorId, role: "PM" }, projectId, { page: 1, size: 1 });
  assert.equal(first.total, 2);
  assert.equal(second.total, 2);
  assert.equal(first.items.length, 1);
  assert.equal(second.items.length, 1);
  await assert.rejects(() => service.list({ userId: actorId, role: "PM" }, projectId, { page: -1, size: 1 }), /VALIDATION_FAILED/);
  await assert.rejects(() => service.list({ userId: actorId, role: "PM" }, projectId, { page: 10_001, size: 1 }), /VALIDATION_FAILED/);
});

test("E10 and E22 keep zero totals safe and report 25 percent for one of four points", async () => {
  const derived = createDerived({
    task: { findMany: async () => [{ storyPoints: 1, status: "DONE" }, { storyPoints: 1, status: "TODO" }, { storyPoints: 1, status: "TODO" }, { storyPoints: 1, status: "TODO" }] },
    sprint: { findMany: async () => [] },
  });
  assert.deepEqual(await derived.progress(projectId), { pointsTotal: 4, pointsDone: 1, percent: 25, unestimatedTasks: 0 });
  assert.deepEqual(await derived.velocity(projectId, 3), []);
});

test("E26 rejects a carry-over task outside the source sprint or project without changes", async () => {
  const source = row({ status: "ACTIVE" });
  const target = row({ id: targetId, startDate: new Date("2026-02-01T00:00:00.000Z"), endDate: new Date("2026-02-14T00:00:00.000Z") });
  const outsideTask = "outside-task";
  const state = transactionalDatabase([source, target], [{ id: taskId, projectId, sprintId, status: "TODO", storyPoints: 3, version: 1, deletedAt: null }, { id: outsideTask, projectId: "other-project", sprintId: "other-sprint", status: "TODO", storyPoints: 2, version: 1, deletedAt: null }]);
  const service = createSprintService(state.db as any, access);
  const before = JSON.stringify(state.state);
  await assert.rejects(() => service.close({ userId: actorId, role: "DEV_LEAD" }, sprintId, { version: 1, carryOver: [{ taskId: outsideTask, to: targetId }] }), /VALIDATION_FAILED/);
  assert.equal(JSON.stringify(state.state), before);
});
