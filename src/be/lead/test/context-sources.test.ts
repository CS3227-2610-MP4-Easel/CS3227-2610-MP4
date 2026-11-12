import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadSources } from "../src/context-sources.js";
const P = "00000000-0000-4000-8000-000000000001";
const U = "00000000-0000-4000-8000-000000000002";
const facts = { asOf: "2026-11-09T00:00:00.000Z", pointsTotal: 10, pointsDone: 5, pointsRemaining: 5, unestimatedTasks: 0, velocity: [], avgVelocity: null, projectedCompletionDate: null, checkpoints: [], overload: [{ userId: U, displayName: "Lead", openPoints: 2, avgCompletedPerSprint: null, projects: [{ projectId: P, name: "P", openPoints: 2 }] }] };
test("lead sources render bounded facts in vocabulary order and bound changes", async () => {
  const sources = createLeadSources({ taskEvent: { findMany: async () => [{ id: 1n, at: new Date("2026-11-08T00:00:00.000Z"), type: "STATUS_CHANGED", taskId: "task", fromValue: null, toValue: "DONE\n" }] } }, async () => facts);
  const rows = await sources.facts({ projectId: P, caller: { userId: U, role: "DEV_LEAD" }, options: {} });
  assert.equal(rows[0].text, "points_total=10");
  const changes = await sources.changes({ projectId: P, caller: { userId: U, role: "DEV_LEAD" }, options: {} });
  assert.match(changes[0].text, /STATUS_CHANGED task  -> DONE /);
});

test("lead facts format recurring numeric values to six decimal places", async () => {
  const recurring = { ...facts, pointsTotal: 3, pointsDone: 1 };
  const sources = createLeadSources({}, async () => recurring);
  const rows = await sources.facts({ projectId: P, caller: { userId: U, role: "DEV_LEAD" }, options: {} });
  assert.equal(rows.find((row) => row.text.startsWith("progress_percent="))?.text, "progress_percent=33.333333");
});

test("lead facts uses a captured snapshot instead of recalculating it", async () => {
  const captured = { ...facts, pointsTotal: 3, pointsDone: 1 };
  const sources = createLeadSources({}, async () => { throw new Error("facts changed"); });
  const rows = await sources.facts({ projectId: P, caller: { userId: U, role: "DEV_LEAD" }, options: {}, captured: { facts: captured } } as any);
  assert.equal(rows.find((row) => row.text.startsWith("points_total="))?.text, "points_total=3");
  assert.equal(rows.find((row) => row.text.startsWith("progress_percent="))?.text, "progress_percent=33.333333");
});
test("prior explanations over 4000 characters are omitted", async () => {
  const sources = createLeadSources({ projectDigest: { findMany: async () => [{ id: "d", explanation: "x".repeat(4001) }] } }, async () => facts);
  assert.deepEqual(await sources.previousDigest({ projectId: P, caller: { userId: U, role: "DEV_LEAD" }, options: {} }), []);
});

test("previousDigest is project-scoped and bounded by the indexed factsAsOf order", async () => {
  let query: unknown;
  const sources = createLeadSources({ projectDigest: { findMany: async (args: unknown) => { query = args; return [{ id: "d", explanation: "latest" }]; } } }, async () => facts);
  assert.deepEqual(await sources.previousDigest({ projectId: P, caller: { userId: U, role: "DEV_LEAD" }, options: {} }), [{ projectId: P, ref: { type: "DIGEST", id: "d" }, text: "latest" }]);
  assert.deepEqual(query, { where: { projectId: P }, orderBy: [{ factsAsOf: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, explanation: true } });
});
