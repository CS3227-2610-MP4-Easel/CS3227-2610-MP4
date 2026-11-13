import assert from "node:assert/strict";
import { test } from "node:test";
import { createDerived } from "../src/index.js";

test("E22 progress uses one task snapshot and reports exact zero totals", async () => {
  let calls = 0;
  const derived = createDerived({ task: { findMany: async () => { calls++; return [{ storyPoints: null, status: "DONE" }, { storyPoints: 3, status: "TODO" }, { storyPoints: 5, status: "DONE" }]; } } });
  assert.deepEqual(await derived.progress("p"), { pointsTotal: 8, pointsDone: 5, percent: 62.5, unestimatedTasks: 1 });
  assert.equal(calls, 1);
  assert.deepEqual(await createDerived({ task: { findMany: async () => [{ storyPoints: null, status: "DONE" }] } }).progress("p"), { pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 1 });
});

test("E22 reports zero progress when every task is unestimated", async () => {
  const derived = createDerived({ task: { findMany: async () => [
    { storyPoints: null, status: "DONE" },
    { storyPoints: null, status: "TODO" },
  ] } });
  assert.deepEqual(await derived.progress("p"), { pointsTotal: 0, pointsDone: 0, percent: 0, unestimatedTasks: 2 });
});

test("velocity accepts only a bounded integer limit", async () => {
  const velocity = createDerived({ sprint: { findMany: async (args) => [args] } }).velocity;
  await assert.rejects(() => velocity("p", 0), { name: "RangeError", message: "INVALID_VELOCITY_LIMIT" });
  await assert.rejects(() => velocity("p", 101), { name: "RangeError", message: "INVALID_VELOCITY_LIMIT" });
  await assert.rejects(() => velocity("p", 1.2), { name: "RangeError", message: "INVALID_VELOCITY_LIMIT" });
  assert.equal((await velocity("p", 1)).length, 1);
});

test("velocity uses ascending sprint ids to break equal end-date ties", async () => {
  let query: any;
  await createDerived({ sprint: { findMany: async (args) => { query = args; return []; } } }).velocity("p", 2);
  assert.deepEqual(query.orderBy, [{ endDate: "desc" }, { id: "asc" }]);
});


test("W7c E5 progress sums the old and new points", async () => {
  const points = [1, 2, 3, 5, 8, 13, 4, 6, 7, 9, 10, 15, 20];
  const rows = points.map((storyPoints, i) => ({ storyPoints, status: i % 2 ? "DONE" : "TODO" })).concat([{ storyPoints: null as any, status: "TODO" }]);
  const progress = await createDerived({ task: { findMany: async () => rows } }).progress("p");
  assert.equal(progress.pointsTotal, points.reduce((a, b) => a + b, 0));
  assert.equal(progress.pointsDone, points.filter((_, i) => i % 2).reduce((a, b) => a + b, 0));
  assert.equal(progress.unestimatedTasks, 1);
});

test("E11 velocity returns the real newest three and excludes deleted sprints", async () => {
  const rows = [
    { id: "newest", name: "Newest", endDate: new Date("2026-04-14"), status: "CLOSED", deletedAt: null, completedPoints: 8 },
    { id: "tie-low", name: "Tie low", endDate: new Date("2026-03-14"), status: "CLOSED", deletedAt: null, completedPoints: 5 },
    { id: "tie-high", name: "Tie high", endDate: new Date("2026-03-14"), status: "CLOSED", deletedAt: null, completedPoints: 3 },
    { id: "deleted-newest", name: "Deleted newest", endDate: new Date("2026-05-14"), status: "CLOSED", deletedAt: new Date("2026-05-15"), completedPoints: 99 },
    { id: "old", name: "Old", endDate: new Date("2026-01-14"), status: "CLOSED", deletedAt: null, completedPoints: 1 },
  ];
  const derived = createDerived({ sprint: { findMany: async ({ where, orderBy, take, select }: any) => rows
    .filter((row) => row.projectId === undefined || where.projectId === undefined || row.projectId === where.projectId)
    .filter((row) => row.status === where.status && row.deletedAt === where.deletedAt && row.completedPoints !== null)
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime() || a.id.localeCompare(b.id))
    .slice(0, take)
    .map((row) => Object.fromEntries(Object.keys(select).map((key) => [key, row[key as keyof typeof row]]))) } });
  assert.deepEqual(await derived.velocity("p", 3), [
    { sprintId: "newest", name: "Newest", completedPoints: 8 },
    { sprintId: "tie-high", name: "Tie high", completedPoints: 3 },
    { sprintId: "tie-low", name: "Tie low", completedPoints: 5 },
  ]);
});
