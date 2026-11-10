import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { TaskSchema, PlanTaskInputSchema, PlanEpicEditBodySchema, PlanEpicSchema, PlanProposalSchema, ProposalVersionBodySchema } from '../src/schemas.js';
import { getPolicyMap } from '../src/policy.js';

const id = '00000000-0000-4000-8000-000000000001';
const time = '2026-01-01T00:00:00Z';
const task = { id, projectId: id, epicId: id, sprintId: null, assigneeId: null, title: 'Task', acceptanceCriteria: [], status: 'TODO', blocked: false, storyPoints: 1, doneAt: null, createdAt: time, updatedAt: time, version: 1 };
const planTask = { title: 'Task', description: '', acceptanceCriteria: [], storyPoints: 1 };
const epic = { index: 0, title: 'Epic', description: '', checkpointName: null, contentHash: 'hash', expansion: { status: 'DONE', tasks: [planTask], error: null } };
const proposal = { id, projectId: id, kind: 'PLAN', status: 'PENDING', approach: '', checkpoints: [], epics: [epic], retrieved: [], flagged: false, createdBy: id, createdAt: time, updatedAt: time, version: 1 };

test('W7c E1 invalid points have the shared message on all input shapes', () => {
  for (const points of [0, -1, -0, 21, 1.5, '5', '20', true, 2147483648]) {
    for (const result of [TaskSchema.safeParse({ ...task, storyPoints: points }), PlanTaskInputSchema.safeParse({ ...planTask, storyPoints: points }), PlanEpicEditBodySchema.safeParse({ version: 1, tasks: [{ ...planTask, storyPoints: points }] })]) {
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error.issues[0].message, 'Must be a whole number from 1 to 20.');
    }
  }
});
test('W7c E2 valid points are accepted', () => {
  for (const points of [1, 20, 20.0, 1e1]) {
    assert.equal(TaskSchema.safeParse({ ...task, storyPoints: points }).success, true);
    assert.equal(PlanTaskInputSchema.safeParse({ ...planTask, storyPoints: points }).success, true);
  }
});
test('W7c E3 nullable view points remain required and edits require a number', () => {
  const { storyPoints: _, ...missingTask } = task;
  const { storyPoints: __, ...missingPlanTask } = planTask;
  assert.equal(TaskSchema.safeParse({ ...task, storyPoints: null }).success, true);
  assert.equal(TaskSchema.safeParse(missingTask).success, false);
  for (const value of [{ ...planTask, storyPoints: null }, missingPlanTask]) {
    assert.equal(PlanTaskInputSchema.safeParse(value).success, false);
    assert.equal(PlanEpicEditBodySchema.safeParse({ version: 1, tasks: [value] }).success, false);
  }
});
test('W7c E6 task and proposal views accept expanded points', () => {
  for (const points of [17, 20]) {
    const e = { ...epic, expansion: { ...epic.expansion, tasks: [{ ...planTask, storyPoints: points }] } };
    assert.equal(TaskSchema.safeParse({ ...task, storyPoints: points }).success, true);
    assert.equal(PlanEpicSchema.safeParse(e).success, true);
    assert.equal(PlanProposalSchema.safeParse({ ...proposal, epics: [e] }).success, true);
  }
});
test('W7c E29 bulk expand version and policy are strict', () => {
  for (const body of [undefined, {}, { version: '1' }, { version: 1.5 }, { version: 0 }, { version: 1, extra: true }]) assert.equal(ProposalVersionBodySchema.safeParse(body).success, false);
  const policy = getPolicyMap().find((entry) => entry.policyKey === 'endpoint-61');
  assert.ok(policy);
  assert.deepEqual({ operationId: policy.operationId, method: policy.method, path: policy.path, authState: policy.authState, roles: policy.roles, predicate: policy.predicate, successStatus: policy.successStatus }, { operationId: 'PM_PROPOSAL_EXPAND_ALL', method: 'POST', path: '/api/pm/proposals/{proposalId}/expand', authState: 'REGISTERED', roles: ['PM'], predicate: 'MEMBER', successStatus: 200 });
});
