import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE_VERSION, BUILTIN_AGENTS, BUILTIN_SKILLS } from './baseline.mjs';
import { checkProbe, describePlugin, describeProblems, probeParts } from './isolation.mjs';
import { claudeArgs, isolationFlags } from './spawn.mjs';
import { tmpDir } from './testkit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const recorded = () => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'init-record.json'), 'utf8'));
// The recorded probe ran in a clone holding 17 project skills and 10 project agents.
const arm = () => {
  const r = recorded();
  return {
    skills: r.skills.filter((s) => !BUILTIN_SKILLS.includes(s)),
    agents: r.agents.filter((a) => !BUILTIN_AGENTS.includes(a)),
    mcp: [], disallowed_tools: ['WebFetch', 'WebSearch'],
  };
};

function makePlugin({ name = 'pl', skills = ['alpha'], agents = [], hooks = true } = {}) {
  const dir = path.join(tmpDir('exp-plugin-'), name);
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name }));
  for (const s of skills) { fs.mkdirSync(path.join(dir, 'skills', s), { recursive: true }); fs.writeFileSync(path.join(dir, 'skills', s, 'SKILL.md'), s); }
  for (const a of agents) { fs.mkdirSync(path.join(dir, 'agents'), { recursive: true }); fs.writeFileSync(path.join(dir, 'agents', `${a}.md`), a); }
  if (hooks) { fs.mkdirSync(path.join(dir, 'hooks')); fs.writeFileSync(path.join(dir, 'hooks', 'hooks.json'), JSON.stringify({ hooks: { SessionStart: [{ hooks: [] }] } })); }
  return dir;
}

test('the recorded plain probe passes for an arm holding the clone\'s skills and agents', () => {
  const res = checkProbe({ record: recorded(), arm: arm() });
  assert.deepEqual(describeProblems(res.problems), []);
  assert.equal(res.ok, true);
});

test('the fixture was recorded with the CLI version the baseline constants belong to', () => {
  assert.equal(recorded().claude_code_version, BASELINE_VERSION);
});

test('E24: one extra plugin gives a mismatch naming it', () => {
  const r = recorded();
  r.plugins.push({ name: 'sneaky', path: 'x', source: 'sneaky@inline' });
  const res = checkProbe({ record: r, arm: arm() });
  assert.equal(res.ok, false);
  const p = res.problems.find((x) => x.set === 'plugins');
  assert.deepEqual(p.extra, ['sneaky']);
});

test('an extra skill, a missing skill and an extra agent are mismatches', () => {
  const r = recorded();
  r.skills.push('stowaway');
  r.skills = r.skills.filter((s) => s !== 'branch-state');
  r.agents.push('rogue');
  const sets = checkProbe({ record: r, arm: arm() }).problems.map((p) => p.set).sort();
  assert.deepEqual(sets, ['agents', 'skills']);
});

test('E25: a record lacking one of the sets it should carry names the gap', () => {
  for (const key of ['skills', 'agents', 'plugins', 'mcp_servers', 'tools']) {
    const r = recorded();
    delete r[key];
    const res = checkProbe({ record: r, arm: arm() });
    assert.equal(res.ok, false, key);
    assert.deepEqual(res.problems, [{ kind: 'gap', set: key }]);
  }
});

test('E25: a different claude_code_version is reported', () => {
  const r = recorded();
  r.claude_code_version = '9.9.9';
  const res = checkProbe({ record: r, arm: arm() });
  assert.equal(res.problems[0].kind, 'version');
});

test('isolation_ignore skips a named entry on both sides', () => {
  const r = recorded();
  r.skills.push('stowaway');
  assert.equal(checkProbe({ record: r, arm: arm(), ignore: ['stowaway'] }).ok, true);
});

test('plugin skills are expected namespaced, and a plugin shows up by name', () => {
  const dir = makePlugin({ name: 'pl', skills: ['alpha', 'beta'] });
  const info = describePlugin(dir);
  assert.equal(info.name, 'pl');
  assert.deepEqual(info.skills, ['alpha', 'beta']);
  assert.equal(info.sessionStartHooks, 1);
  const r = recorded();
  r.plugins.push({ name: 'pl', path: dir, source: 'pl@inline' });
  r.skills.push('pl:alpha', 'pl:beta');
  assert.equal(checkProbe({ record: r, arm: arm(), plugins: [info] }).ok, true);
  r.skills.pop();
  assert.equal(checkProbe({ record: r, arm: arm(), plugins: [info] }).problems[0].missing[0], 'pl:beta');
});

test('E71: a hook event is accepted only as a SessionStart hook declared by an arm plugin', () => {
  const info = describePlugin(makePlugin());
  const r = recorded();
  r.plugins.push({ name: 'pl', path: 'x', source: 'pl@inline' });
  r.skills.push('pl:alpha');
  const sessionStart = { type: 'system', subtype: 'hook_started', hook_name: 'SessionStart:startup', hook_event: 'SessionStart' };
  assert.equal(checkProbe({ record: r, arm: arm(), plugins: [info], hookEvents: [sessionStart] }).ok, true);
  // same hook, but no arm plugin declares one: a foreign hook
  const bare = recorded();
  const foreign = checkProbe({ record: bare, arm: arm(), hookEvents: [sessionStart] });
  assert.deepEqual(foreign.problems.map((p) => p.kind), ['hook']);
  assert.match(describeProblems(foreign.problems)[0], /SessionStart:startup/);
  // a PreToolUse hook is never accepted from the probe
  const pre = { ...sessionStart, hook_name: 'PreToolUse:Bash', hook_event: 'PreToolUse' };
  assert.equal(checkProbe({ record: r, arm: arm(), plugins: [info], hookEvents: [pre] }).ok, false);
});

test('probeParts splits the stream at the init record', () => {
  const hook = { type: 'system', subtype: 'hook_started', hook_name: 'h', hook_event: 'SessionStart' };
  const init = { type: 'system', subtype: 'init' };
  const parts = probeParts([hook, init, { type: 'assistant' }, { type: 'system', subtype: 'hook_started' }]);
  assert.equal(parts.record, init);
  assert.deepEqual(parts.hookEvents, [hook]);
  assert.deepEqual(probeParts([{ type: 'assistant' }]), { record: null, hookEvents: [] });
});

test('E58: probe, first launch and resumed launch share their isolation flags', () => {
  const base = { model: 'm', pluginDirs: ['/p/a'], maxBudgetUsd: 1 };
  const probe = isolationFlags(claudeArgs(base));
  const resumed = isolationFlags(claudeArgs({ ...base, resume: '0e1234a8-eaf3-4e5f-a919-bea3da9e2715', maxBudgetUsd: 0.4 }));
  assert.deepEqual(resumed, probe);
});

test('built-ins are optional: a session without the feature-gated ones still passes (found by the first pilot batch)', () => {
  const r = recorded();
  r.skills = r.skills.filter((s) => !['slides', 'artifact-capabilities', 'artifact-diagramming'].includes(s));
  r.agents = r.agents.filter((a) => a !== 'claude-code-guide');
  r.tools = r.tools.filter((t) => !['Artifact', 'ArtifactComments', 'ArtifactData'].includes(t));
  assert.equal(checkProbe({ record: r, arm: arm() }).ok, true);
});

test('built-ins being absent never excuses an extra entry or a missing arm entry', () => {
  const r = recorded();
  r.skills = r.skills.filter((s) => s !== 'slides' && s !== 'writing-specs-lite');
  r.skills.push('stowaway');
  const p = checkProbe({ record: r, arm: arm() }).problems.find((x) => x.set === 'skills');
  assert.deepEqual([p.extra, p.missing], [['stowaway'], ['writing-specs-lite']]);
});
