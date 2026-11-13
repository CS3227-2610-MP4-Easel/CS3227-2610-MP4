import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PlanEpicEditBodySchema, PlanCheckpointsBodySchema, PlanEpicAddBodySchema, ProposalVersionQuerySchema, PlanListQuerySchema, ProposalVersionBodySchema } from '../src/schemas.js';
import { getPolicyMap } from '../src/policy.js';
const task = { title: 'Task', description: '', acceptanceCriteria: ['ok'], storyPoints: 1 };
test('W7b E7 versions and unknown keys are rejected', () => {
  for (const version of [undefined, 0, 1.5]) { assert.equal(ProposalVersionBodySchema.safeParse({ version }).success, false); assert.equal(ProposalVersionQuerySchema.safeParse({ version }).success, false); }
  assert.equal(PlanEpicEditBodySchema.safeParse({ version: 1, assignee: 'x' }).success, false);
  assert.equal(PlanEpicAddBodySchema.safeParse({ version: 1, title: 'x', description: '', checkpointName: null, id: 'x' }).success, false);
  assert.equal(PlanCheckpointsBodySchema.safeParse({ version: 1, checkpoints: [], model: 'x' }).success, false);
});
test('W7b E14 checkpoint count', () => assert.equal(PlanCheckpointsBodySchema.safeParse({ version: 1, checkpoints: Array(9).fill({ name: 'x', targetDate: '2026-01-01' }) }).success, false));
test('W7b E24 task constraints', () => {
  for (const tasks of [[], Array(9).fill(task), [{ ...task, storyPoints: 21 }], [{ ...task, storyPoints: null }], [{ ...task, acceptanceCriteria: Array(13).fill('x') }], [{ ...task, acceptanceCriteria: [''] }], [{ ...task, id: 'x' }]]) assert.equal(PlanEpicEditBodySchema.safeParse({ version: 1, tasks }).success, false);
});
test('W7b E25 at least one valid edit', () => {
  for (const body of [{ version: 1 }, { version: 1, tasks: null }, { version: 1, title: '' }]) assert.equal(PlanEpicEditBodySchema.safeParse(body).success, false);
  assert.equal(PlanEpicEditBodySchema.safeParse({ version: 1, checkpointName: null }).success, true);
});
test('W7b E49 list query constraints', () => {
  for (const query of [{ status: 'APPROVEDX' }, { extra: 'x' }, { size: '21' }]) assert.equal(PlanListQuerySchema.safeParse(query).success, false);
  assert.deepEqual(PlanListQuerySchema.parse({}), { page: 0, size: 20 });
});
test('W7b policy entries', () => {
  const entries = getPolicyMap(); assert.equal(entries.length, 59);
  for (const entry of entries.filter((item) => Number(item.policyKey.slice(9)) >= 58)) { assert.deepEqual(entry.roles, ['PM']); assert.equal(entry.predicate, 'MEMBER'); }
  assert.equal(entries.find((item) => item.policyKey === 'endpoint-59')?.successStatus, 201);
});
