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

test("applyPlan accepts unestimated backlog tasks but rejects them in a sprint", async () => {
  const unestimated = transaction();
  await createApply().applyPlan(unestimated, projectId, { checkpoints: [], epics: [{ title: "e", tasks: [{ title: "t", storyPoints: null }] }] }, actorId);
  assert.deepEqual(unestimated.calls, ["event"]);
  const inSprint = transaction();
  await assert.rejects(() => createApply().applyPlan(inSprint, projectId, { checkpoints: [], epics: [{ title: "e", tasks: [{ title: "t", storyPoints: null, sprintId: "00000000-0000-4000-8000-000000000005" }] }] }, actorId), /VALIDATION_FAILED/);
});

test("applyPlan rejects tasks assigned to closed sprints", async () => {
  const closed = transaction();
  closed.sprint.findFirst = async () => ({ id: "sprint", status: "CLOSED" });
  await assert.rejects(() => createApply().applyPlan(closed, projectId, { checkpoints: [], epics: [{ title: "e", tasks: [{ title: "t", storyPoints: 3, sprintId: "00000000-0000-4000-8000-000000000005" }] }] }, actorId), /CONFLICT_STATE/);
  assert.deepEqual(closed.calls, []);
});

test("applyReplan locks the project before checking whether it is active", async () => {
  const tx: any = transaction();
  let locked = false;
  tx.user.findFirst = async () => ({ id: actorId, role: "DEV_LEAD" });
  tx.project.update = async () => { locked = true; return {}; };
  tx.project.findFirst = async () => ({ id: projectId, status: locked ? "ARCHIVED" : "ACTIVE" });
  await assert.rejects(() => createApply().applyReplan(tx, projectId, { suggestions: [] }, actorId), /CONFLICT_STATE/);
  assert.equal(locked, true);
});

test("applyPlan allocates epic positions from max position, not row count", async () => {
  const tx = transaction();
  tx.epic.count = async () => { throw new Error("count must not allocate positions"); };
  tx.epic.aggregate = async () => ({ _max: { position: 7 } });
  tx.epic.create = async ({ data }: any) => { assert.equal(data.position, 8); return { id: "epic" }; };
  await createApply().applyPlan(tx, projectId, { checkpoints: [], epics: [{ title: "e" }] }, actorId);
});

test("E36 stale and out-of-scope replan targets fail before mutation", async () => {
  const tx = transaction();
  tx.user.findFirst = async () => ({ id: actorId, role: "DEV_LEAD" });
  tx.task.findFirst = async () => null;
  await assert.rejects(() => createApply().applyReplan(tx, projectId, { suggestions: [{ id: "00000000-0000-4000-8000-000000000005", type: "REASSIGN_TASK", taskId, assigneeId, rationale: "needed" }] }, actorId), /VALIDATION_FAILED/);
  assert.deepEqual(tx.calls, []);
});

test("apply rejects impossible calendar dates before any write", async () => {
  const tx = transaction();
  await assert.rejects(() => createApply().applyPlan(tx, projectId, { checkpoints: [{ name: "bad", targetDate: "2026-02-30" }], epics: [] }, actorId), /VALIDATION_FAILED/);
  tx.user.findFirst = async () => ({ id: actorId, role: "DEV_LEAD" });
  await assert.rejects(() => createApply().applyReplan(tx, projectId, { suggestions: [{ id: "00000000-0000-4000-8000-000000000005", type: "MOVE_CHECKPOINT_DATE", checkpointId: taskId, newTargetDate: "2026-02-30", rationale: "needed" }] }, actorId), /VALIDATION_FAILED/);
  assert.deepEqual(tx.calls, []);
});

test("applyPlan leaves rollback to its supplied transaction after an event insert failure", async () => {
  const state = { checkpoints: 0, epics: 0, tasks: 0, events: 0 };
  const tx: any = transaction();
  tx.checkpoint.create = async () => { state.checkpoints++; return { id: "checkpoint" }; };
  tx.epic.create = async () => { state.epics++; return { id: "epic" }; };
  tx.task.create = async () => { state.tasks++; return { id: taskId }; };
  tx.taskEvent.create = async () => { state.events++; throw new Error("event insert failed"); };
  const suppliedTransaction = async (work: () => Promise<void>) => {
    const before = { ...state };
    try { await work(); } catch (error) { Object.assign(state, before); throw error; }
  };
  await assert.rejects(() => suppliedTransaction(() => createApply().applyPlan(tx, projectId, { checkpoints: [{ name: "first", targetDate: "2026-12-01" }], epics: [{ title: "e", tasks: [{ title: "t", storyPoints: 3 }] }] }, actorId)), /event insert failed/);
  assert.deepEqual(state, { checkpoints: 0, epics: 0, tasks: 0, events: 0 });
});

test("applyPlan is PM-only and applyReplan is Dev Lead-only", async () => {
  const planTx = transaction();
  planTx.user.findFirst = async () => ({ id: actorId, role: "DEV_LEAD" });
  await assert.rejects(() => createApply().applyPlan(planTx, projectId, { checkpoints: [], epics: [] }, actorId), /FORBIDDEN_ROLE/);
  const replanTx = transaction();
  await assert.rejects(() => createApply().applyReplan(replanTx, projectId, { suggestions: [] }, actorId), /FORBIDDEN_ROLE/);
});

test("apply schemas reject unknown fields and require capped rationales", async () => {
  const tx = transaction();
  await assert.rejects(() => createApply().applyPlan(tx, projectId, { checkpoints: [], epics: [], unexpected: true }, actorId), /VALIDATION_FAILED/);
  tx.user.findFirst = async () => ({ id: actorId, role: "DEV_LEAD" });
  await assert.rejects(() => createApply().applyReplan(tx, projectId, { suggestions: [{ id: "00000000-0000-4000-8000-000000000005", type: "REASSIGN_TASK", taskId, assigneeId }] }, actorId), /VALIDATION_FAILED/);
  await assert.rejects(() => createApply().applyReplan(tx, projectId, { suggestions: [{ id: "00000000-0000-4000-8000-000000000005", type: "REASSIGN_TASK", taskId, assigneeId, rationale: "x".repeat(301) }] }, actorId), /VALIDATION_FAILED/);
});
