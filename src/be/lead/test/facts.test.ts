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
      { id: id(12), name: "S3", completedPoints: 8, startDate: day("2026-11-01"), endDate: day("2026-11-04") },
      { id: id(11), name: "S2", completedPoints: 4, startDate: day("2026-10-27"), endDate: day("2026-10-28") },
      { id: id(10), name: "S1", completedPoints: 3, startDate: day("2026-10-20"), endDate: day("2026-10-21") },
    ] } },
    task: { findMany: async () => [{ projectId: target, storyPoints: 15, status: "TODO" }] },
    checkpoint: { findMany: async () => [
      { id: id(20), projectId: target, name: "Empty", targetDate: day("2026-11-10"), epics: [] },
      { id: id(21), projectId: target, name: "Late", targetDate: day("2026-11-12"), epics: [{ projectId: target, tasks: [{ projectId: target, storyPoints: 15, status: "TODO" }] }] },
    ] },
  }), { now: () => new Date("2026-11-09T10:00:00.000Z") }).target(target);
  assert.deepEqual((sprintQuery as { orderBy: unknown }).orderBy, [{ endDate: "desc" }, { id: "asc" }]);
  assert.equal((sprintQuery as { take: number }).take, 3);
  assert.equal(facts.avgVelocity, 5);
  assert.equal(facts.projectedCompletionDate, "2026-11-18");
  assert.deepEqual(facts.checkpoints, [
    { id: id(20), name: "Empty", targetDate: "2026-11-10", remainingPoints: 0, projectedDate: "2026-11-09", risk: "ON_TRACK" },
    { id: id(21), name: "Late", targetDate: "2026-11-12", remainingPoints: 15, projectedDate: "2026-11-18", risk: "AT_RISK" },
  ]);
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

test("hash is canonical and excludes asOf", () => {
  const first = { asOf: "2026-11-09T10:00:00.000Z", pointsTotal: 1, nested: { b: 2, a: 1 } };
  const second = { nested: { a: 1, b: 2 }, pointsTotal: 1, asOf: "2026-11-09T11:00:00.000Z" };
  assert.equal(hashFacts(first), hashFacts(second));
  assert.match(hashFacts(first), /^[a-f0-9]{64}$/);
});
