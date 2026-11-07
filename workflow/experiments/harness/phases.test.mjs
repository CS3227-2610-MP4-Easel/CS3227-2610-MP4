import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignPhases } from './phases.mjs';

const map = { 'writing-specs-lite': 'spec', 'writing-plans-lite': 'plan', reviewer: 'review', 'spec-writer': 'spec', 'never-fires': 'plan' };
const main = (id, extra = {}) => ({ message_id: id, agent_id: 'main', parent_agent_id: null, agent_type: null, skills: [], tool_use_ids: [], ...extra });
const sub = (id, agent, type, launchedBy, extra = {}) => ({ message_id: id, agent_id: agent, parent_agent_id: 'main', agent_type: type, launched_by: launchedBy, skills: [], tool_use_ids: [], ...extra });
const phases = (messages) => Object.fromEntries(assignPhases(messages, map));

test('a skill sets the phase from the next message until the next skill', () => {
  const p = phases([
    main('m1'), main('m2', { skills: ['writing-specs-lite'] }), main('m3'), main('m4', { skills: ['writing-plans-lite'] }), main('m5'),
  ]);
  assert.deepEqual(p, { m1: 'other', m2: 'other', m3: 'spec', m4: 'spec', m5: 'plan' });
});

test('E43: inside a subagent its type mapping wins over the parent\'s skill phase', () => {
  const p = phases([
    main('m1', { skills: ['writing-specs-lite'] }),
    main('m2', { tool_use_ids: ['tu1'] }), // spec phase, launches a reviewer
    sub('s1', 'a1', 'reviewer', 'tu1'),
    sub('s2', 'a1', 'reviewer', 'tu1'),
  ]);
  assert.equal(p.m2, 'spec');
  assert.equal(p.s1, 'review');
  assert.equal(p.s2, 'review');
});

test('E43: a nested subagent of an unmapped type inherits the phase of the message that launched it', () => {
  const nested = { message_id: 'n1', agent_id: 'a2', parent_agent_id: 'a1', agent_type: 'general-purpose', launched_by: 'tu2', skills: [], tool_use_ids: [] };
  const p = phases([
    main('m1', { tool_use_ids: ['tu1'] }),
    sub('s1', 'a1', 'reviewer', 'tu1', { tool_use_ids: ['tu2'] }),
    nested,
  ]);
  assert.equal(p.s1, 'review');
  assert.equal(p.n1, 'review');
});

test('E43: a subagent type with no mapping inherits the launcher\'s phase, and its own skills then apply', () => {
  const p = phases([
    main('m1', { skills: ['writing-plans-lite'] }),
    main('m2', { tool_use_ids: ['tu1'] }),
    sub('s1', 'a1', 'general-purpose', 'tu1', { skills: ['writing-specs-lite'] }),
    sub('s2', 'a1', 'general-purpose', 'tu1'),
  ]);
  assert.equal(p.m2, 'plan');
  assert.equal(p.s1, 'plan');
  assert.equal(p.s2, 'spec');
});

test('E43: a skill that is not mapped gives other; a mapped skill that never fires is no error', () => {
  const p = phases([main('m1', { skills: ['mystery-skill'] }), main('m2')]);
  assert.equal(p.m2, 'other');
});

test('subagents listed before their launcher still resolve', () => {
  const p = phases([sub('s1', 'a1', 'unmapped-type', 'tu1'), main('m1', { skills: ['writing-specs-lite'] }), main('m2', { tool_use_ids: ['tu1'] })]);
  assert.equal(p.s1, 'spec');
});
