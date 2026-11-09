import assert from "node:assert/strict";
import { test } from "node:test";
import { createFacts, hashFacts, type FactsDb } from "../src/index.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = id(1);
const caller = id(2);
const other = id(3);
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function db(overrides: Partial<FactsDb> = {}): FactsDb {
  return {
    task: { findMany: async () => [] },
    sprint: { findMany: async () => [] },
    checkpoint: { findMany: async () => [] },
    projectMember: { findMany: async () => [] },
    ...overrides,
  };
}

test("E1 produces zero facts from empty live data and captures one clock instant", async () => {
  let clocks = 0;
  const facts = await createFacts(db(), { now: () => { clocks++; return new Date("2026-11-09T10:00:00.000Z"); } }).target(target);
  assert.deepEqual(facts, {
    asOf: "2026-11-09T10:00:00.000Z", pointsTotal: 0, pointsDone: 0, pointsRemaining: 0, unestimatedTasks: 0,
    velocity: [], avgVelocity: null, projectedCompletionDate: null, checkpoints: [], overload: [],
  });
  assert.equal(clocks, 1);
});

test("E2 counts unestimated live tasks but excludes them from points", async () => {
  const facts = await createFacts(db({ task: { findMany: async () => [
    { projectId: target, storyPoints: null, status: "TODO" },
    { projectId: target, storyPoints: 3, status: "DONE" },
    { projectId: target, storyPoints: 5, status: "TODO" },
  ] } }), { now: () => new Date("2026-11-09T10:00:00.000Z") }).target(target);
  assert.deepEqual([facts.pointsTotal, facts.pointsDone, facts.pointsRemaining, facts.unestimatedTasks], [8, 3, 5, 1]);
});

test("E3-E5 uses the newest three closed sprints, half-days upward, and reports checkpoint risk", async () => {
  let sprintQuery: unknown;
  const facts = await createFacts(db({
    sprint: { findMany: async (query) => { sprintQuery = query; return [
      { id: id(12), projectId: target, name: "S3", completedPoints: 8, startDate: day("2026-11-01"), endDate: day("2026-11-04") },
      { id: id(11), projectId: target, name: "S2", completedPoints: 4, startDate: day("2026-10-27"), endDate: day("2026-10-28") },
      { id: id(10), projectId: target, name: "S1", completedPoints: 3, startDate: day("2026-10-20"), endDate: day("2026-10-21") },
    ] } },
    task: { findMany: async () => [{ projectId: target, storyPoints: 15, status: "TODO" }] },
    checkpoint: { findMany: async () => [
      { id: id(20), projectId: target, name: "Empty", targetDate: day("2026-11-10"), epics: [] },
      { id: id(21), projectId: target, name: "Late", targetDate: day("2026-11-12"), epics: [{ projectId: target, tasks: [{ projectId: target, storyPoints: 15, status: "TODO" }] }] },
    ] },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") }).target(target);
  assert.deepEqual((sprintQuery as { orderBy: unknown }).orderBy, [{ endDate: "desc" }, { id: "asc" }]);
  assert.equal((sprintQuery as { skip?: number }).skip, undefined);
  assert.equal((sprintQuery as { take?: number }).take, 3);
  assert.equal(facts.avgVelocity, 5);
  assert.equal(facts.projectedCompletionDate, "2026-11-18");
  assert.deepEqual(facts.checkpoints, [
    { id: id(20), name: "Empty", targetDate: "2026-11-10", remainingPoints: 0, projectedDate: "2026-11-09", risk: "ON_TRACK" },
    { id: id(21), name: "Late", targetDate: "2026-11-12", remainingPoints: 15, projectedDate: "2026-11-18", risk: "AT_RISK" },
  ]);
});

test("queries each caller project for only its newest three closed sprints", async () => {
  const beforeTarget = id(0);
  const member = id(100);
  const targetSprints = [
    { id: id(101), projectId: target, name: "Newest", completedPoints: 9, startDate: day("2026-11-07"), endDate: day("2026-11-08") },
    { id: id(102), projectId: target, name: "Middle", completedPoints: 6, startDate: day("2026-11-04"), endDate: day("2026-11-05") },
    { id: id(103), projectId: target, name: "Oldest", completedPoints: 3, startDate: day("2026-11-01"), endDate: day("2026-11-02") },
  ];
  const queries: any[] = [];
  const facts = await createFacts(db({
    task: { findMany: async () => [{ projectId: target, storyPoints: 12, status: "TODO" }] },
    projectMember: { findMany: async (query: any) => query.where.userId ? [
      { projectId: beforeTarget, userId: caller },
      { projectId: target, userId: caller },
    ] : [{ projectId: target, userId: member, project: { id: target, name: "Target", status: "ACTIVE" }, user: { id: member, displayName: "Member" }, assignedTasks: [] }] },
    sprint: { findMany: async (query: any) => {
      queries.push(query);
      return query.where.projectId === beforeTarget
        ? Array.from({ length: 100 }, (_, index) => ({ id: id(200 + index), projectId: beforeTarget, name: `Other ${index}`, completedPoints: 1, startDate: day("2026-01-01"), endDate: day("2026-01-02") }))
        : targetSprints;
    } },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") }).caller(caller, target);
  assert.deepEqual(queries.map((query) => ({ projectId: query.where.projectId, orderBy: query.orderBy, take: query.take, skip: query.skip })), [
    { projectId: beforeTarget, orderBy: [{ endDate: "desc" }, { id: "asc" }], take: 3, skip: undefined },
    { projectId: target, orderBy: [{ endDate: "desc" }, { id: "asc" }], take: 3, skip: undefined },
  ]);
  assert.deepEqual(facts.velocity, targetSprints.map(({ id: sprintId, name, completedPoints }) => ({ sprintId, name, completedPoints })));
  assert.equal(facts.avgVelocity, 6);
  assert.equal(facts.projectedCompletionDate, "2026-11-13");
});

test("excludes a fourth target sprint from velocity and averages", async () => {
  const sprints = [
    { id: id(104), projectId: target, name: "Newest", completedPoints: 9, startDate: day("2026-11-07"), endDate: day("2026-11-08") },
    { id: id(105), projectId: target, name: "Middle", completedPoints: 6, startDate: day("2026-11-04"), endDate: day("2026-11-05") },
    { id: id(106), projectId: target, name: "Old", completedPoints: 3, startDate: day("2026-11-01"), endDate: day("2026-11-02") },
    { id: id(107), projectId: target, name: "Too old", completedPoints: 100, startDate: day("2026-10-28"), endDate: day("2026-10-29") },
  ];
  const facts = await createFacts(db({
    task: { findMany: async () => [{ projectId: target, storyPoints: 12, status: "TODO" }] },
    sprint: { findMany: async () => sprints },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") }).target(target);
  assert.deepEqual(facts.velocity, sprints.slice(0, 3).map(({ id: sprintId, name, completedPoints }) => ({ sprintId, name, completedPoints })));
  assert.equal(facts.avgVelocity, 6);
});

test("uses two closed nonzero sprints newest-first for velocity and projection", async () => {
  const facts = await createFacts(db({
    task: { findMany: async () => [{ projectId: target, storyPoints: 12, status: "TODO" }] },
    sprint: { findMany: async () => [
      { id: id(111), projectId: target, name: "Older", completedPoints: 4, startDate: day("2026-11-01"), endDate: day("2026-11-02") },
      { id: id(112), projectId: target, name: "Newest", completedPoints: 8, startDate: day("2026-11-05"), endDate: day("2026-11-06") },
    ] },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") }).target(target);
  assert.deepEqual(facts.velocity, [
    { sprintId: id(112), name: "Newest", completedPoints: 8 },
    { sprintId: id(111), name: "Older", completedPoints: 4 },
  ]);
  assert.equal(facts.avgVelocity, 6);
  assert.equal(facts.projectedCompletionDate, "2026-11-13");
});

test("uses one nonzero closed sprint for newest-first velocity, average, and projection", async () => {
  const sprint = { id: id(113), projectId: target, name: "Only", completedPoints: 4, startDate: day("2026-11-01"), endDate: day("2026-11-02") };
  const facts = await createFacts(db({
    task: { findMany: async () => [{ projectId: target, storyPoints: 5, status: "TODO" }] },
    sprint: { findMany: async () => [sprint] },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") }).target(target);
  assert.deepEqual(facts.velocity, [{ sprintId: sprint.id, name: "Only", completedPoints: 4 }]);
  assert.equal(facts.avgVelocity, 4);
  assert.equal(facts.projectedCompletionDate, "2026-11-13");
});

test("short, absent, and zero sprint history leaves projections null and risks UNKNOWN", async () => {
  const service = createFacts(db({
    task: { findMany: async () => [{ projectId: target, storyPoints: 3, status: "TODO" }] },
    checkpoint: { findMany: async () => [{ id: id(22), projectId: target, name: "Blocked", targetDate: day("2026-11-10"), epics: [{ projectId: target, tasks: [{ projectId: target, storyPoints: 3, status: "TODO" }] }] }] },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") });
  const absent = await service.target(target);
  assert.equal(absent.avgVelocity, null);
  assert.equal(absent.projectedCompletionDate, null);
  assert.equal(absent.checkpoints[0].risk, "UNKNOWN");
  const zero = await createFacts(db({
    sprint: { findMany: async () => [{ id: id(23), name: "Zero", completedPoints: 0, startDate: day("2026-11-01"), endDate: day("2026-11-02"), projectId: target }] },
    checkpoint: { findMany: async () => [{ id: id(24), projectId: target, name: "Blocked", targetDate: day("2026-11-10"), epics: [{ projectId: target, tasks: [{ projectId: target, storyPoints: 3, status: "TODO" }] }] }] },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") }).target(target);
  assert.equal(zero.avgVelocity, 0);
  assert.equal(zero.projectedCompletionDate, null);
  assert.equal(zero.checkpoints[0].risk, "UNKNOWN");
});

test("E6 and E25 separate caller-member overloads from target-only digest overloads", async () => {
  const memberships = [
    { projectId: target, project: { id: target, name: "Target", status: "ACTIVE" }, userId: id(30), user: { id: id(30), displayName: "Alex" }, assignedTasks: [{ projectId: target, assigneeId: id(30), storyPoints: 3, status: "TODO" }] },
    { projectId: other, project: { id: other, name: "Other", status: "ACTIVE" }, userId: id(30), user: { id: id(30), displayName: "Alex" }, assignedTasks: [{ projectId: other, assigneeId: id(30), storyPoints: 2, status: "TODO" }] },
    { projectId: target, project: { id: target, name: "Target", status: "ACTIVE" }, userId: id(31), user: { id: id(31), displayName: "Solo" }, assignedTasks: [{ projectId: target, assigneeId: id(31), storyPoints: 4, status: "TODO" }] },
  ];
  const service = createFacts(db({ projectMember: { findMany: async () => memberships } }), { now: () => new Date("2026-11-09T10:00:00.000Z") });
  const callerFacts = await service.caller(caller, target);
  const targetFacts = await service.target(target);
  assert.deepEqual(callerFacts.overload, [{ userId: id(30), displayName: "Alex", openPoints: 5, avgCompletedPerSprint: null, projects: [{ projectId: target, name: "Target", openPoints: 3 }, { projectId: other, name: "Other", openPoints: 2 }] }]);
  assert.deepEqual(targetFacts.overload, [
    { userId: id(30), displayName: "Alex", openPoints: 3, avgCompletedPerSprint: null, projects: [{ projectId: target, name: "Target", openPoints: 3 }] },
    { userId: id(31), displayName: "Solo", openPoints: 4, avgCompletedPerSprint: null, projects: [{ projectId: target, name: "Target", openPoints: 4 }] },
  ]);
});

test("caller requires active target membership and averages completed work across each member project history", async () => {
  const alex = id(32);
  const targetSprint = id(33);
  const otherSprint = id(34);
  const queries: any[] = [];
  const memberships = [
    { projectId: target, userId: caller, project: { id: target, name: "Target", status: "ACTIVE" } },
    { projectId: other, userId: caller, project: { id: other, name: "Other", status: "ACTIVE" } },
    { projectId: target, userId: alex, user: { id: alex, displayName: "Alex" }, project: { id: target, name: "Target", status: "ACTIVE" }, assignedTasks: [{ projectId: target, assigneeId: alex, storyPoints: 3, status: "TODO" }, { projectId: target, assigneeId: alex, storyPoints: 6, status: "DONE", sprintId: targetSprint }] },
    { projectId: other, userId: alex, user: { id: alex, displayName: "Alex" }, project: { id: other, name: "Other", status: "ACTIVE" }, assignedTasks: [{ projectId: other, assigneeId: alex, storyPoints: 2, status: "TODO" }, { projectId: other, assigneeId: alex, storyPoints: 4, status: "DONE", sprintId: otherSprint }] },
  ];
  const service = createFacts(db({
    sprint: { findMany: async () => [{ id: targetSprint, projectId: target, name: "Target sprint", completedPoints: 6, startDate: day("2026-11-01"), endDate: day("2026-11-02") }, { id: otherSprint, projectId: other, name: "Other sprint", completedPoints: 4, startDate: day("2026-11-01"), endDate: day("2026-11-02") }] },
    projectMember: { findMany: async (query: any) => { queries.push(query); return query.where.userId ? memberships.filter((member) => member.userId === query.where.userId) : memberships; } },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") });
  const facts = await service.caller(caller, target);
  assert.equal(facts.overload[0].avgCompletedPerSprint, 5);
  assert.equal(queries[0].where.userId, caller);
  assert.deepEqual(queries[0].where.project, { status: "ACTIVE" });
  assert.deepEqual(queries[1].select.assignedTasks.where.projectId, { in: [target, other] });
  assert.ok(queries.every((query) => query.take === undefined));
  await assert.rejects(() => service.caller(caller, id(99)), { message: "NOT_MEMBER" });
});

test("hash is canonical and excludes asOf", () => {
  const first = { asOf: "2026-11-09T10:00:00.000Z", pointsTotal: 1, nested: { b: 2, a: 1 } };
  const second = { nested: { a: 1, b: 2 }, pointsTotal: 1, asOf: "2026-11-09T11:00:00.000Z" };
  assert.equal(hashFacts(first), hashFacts(second));
  assert.equal(hashFacts(first), "1d7c8aa184d267086891bcebefdef4ad231d0b570b6199ea96551e825d0b9725");
});
