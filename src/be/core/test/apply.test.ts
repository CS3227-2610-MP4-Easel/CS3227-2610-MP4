import assert from "node:assert/strict";
import { test } from "node:test";
import { createApply } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const actorId = "00000000-0000-4000-8000-000000000002";
const assigneeId = "00000000-0000-4000-8000-000000000003";
const taskId = "00000000-0000-4000-8000-000000000004";

function transaction() {
  const calls: string[] = [];
  return { calls,
    user: { findFirst: async () => ({ id: actorId, role: "PM" }) }, project: { findFirst: async () => ({ id: projectId, status: "ACTIVE" }) },
    projectMember: { findFirst: async ({ where }: any) => where.userId === assigneeId || where.userId === actorId ? { projectId } : null },
    checkpoint: { create: async () => ({ id: "checkpoint" }), findFirst: async () => ({ id: "checkpoint" }), update: async () => { calls.push("checkpoint"); return {}; } },
    epic: { count: async () => 0, create: async () => ({ id: "epic" }), findFirst: async () => ({ id: "epic" }), update: async () => { calls.push("epic"); return {}; } },
    task: { create: async () => ({ id: taskId }), findFirst: async () => ({ id: taskId, assigneeId: actorId }), update: async () => { calls.push("task"); return {}; } },
    taskEvent: { create: async () => { calls.push("event"); } }, sprint: { findFirst: async () => ({ id: "sprint" }) },
  };
}

test("E20 invalid plan is rejected before any mutation", async () => {
  const tx = transaction();
  await assert.rejects(() => createApply().applyPlan(tx, projectId, { checkpoints: "nope", epics: [] }, actorId), /VALIDATION_FAILED/);
  assert.deepEqual(tx.calls, []);
});

test("E24-E25 applyPlan ignores embedded project id, validates assignees, and writes through supplied transaction", async () => {
  const tx = transaction();
  await createApply().applyPlan(tx, projectId, { projectId: "00000000-0000-4000-8000-000000000099", checkpoints: [{ name: "first", targetDate: "2026-12-01" }], epics: [{ title: "e", checkpointName: "first", tasks: [{ title: "t", storyPoints: 3, assigneeId }] }] }, actorId);
  assert.deepEqual(tx.calls, ["event"]);
  const denied = transaction();
  await assert.rejects(() => createApply().applyPlan(denied, projectId, { checkpoints: [], epics: [{ title: "e", tasks: [{ title: "t", storyPoints: 3, assigneeId: taskId }] }] }, actorId), /VALIDATION_FAILED/);
});

test("E36 stale and out-of-scope replan targets fail before mutation", async () => {
  const tx = transaction();
  tx.task.findFirst = async () => null;
  await assert.rejects(() => createApply().applyReplan(tx, projectId, { suggestions: [{ id: "00000000-0000-4000-8000-000000000005", type: "REASSIGN_TASK", taskId, assigneeId }] }, actorId), /VALIDATION_FAILED/);
  assert.deepEqual(tx.calls, []);
});
