import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError, encodeProjectDir, extractRun } from './extract.mjs';
import { newRunState, readJson, runPaths, writeJsonAtomic } from './state.mjs';
import { makeExperimentRepo, put, tmpDir } from './testkit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SID = '0e1234a8-eaf3-4e5f-a919-bea3da9e2715';
const MODEL = 'claude-sonnet-5-5';
const T = (s) => new Date(Date.parse('2026-11-03T12:00:00Z') + s * 1000).toISOString();

const line = (o) => JSON.stringify(o);
const asst = (id, ts, usage, content = [{ type: 'text', text: 'x' }], model = MODEL) =>
  line({ type: 'assistant', timestamp: T(ts), message: { id, model, role: 'assistant', content, usage } });
const use = (input, output, cache_read = 0, cw5 = 0, cw1 = 0) => ({
  input_tokens: input, output_tokens: output, cache_read_input_tokens: cache_read, cache_creation_input_tokens: cw5 + cw1,
  cache_creation: { ephemeral_5m_input_tokens: cw5, ephemeral_1h_input_tokens: cw1 },
});
const toolUse = (id, name, input) => ({ type: 'tool_use', id, name, input });

/** A finished run with transcripts in a fake CLI projects folder. */
function setup({ main, subs = [], state = {}, arm = {}, status = 'done' } = {}) {
  const ctx = makeExperimentRepo({ arm });
  const runId = 'run-1';
  const paths = runPaths(ctx.expRoot, runId);
  const clone = path.join(ctx.worktreesRoot, runId);
  const projectsDir = tmpDir('exp-projects-');
  const dir = path.join(projectsDir, encodeProjectDir(clone));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${SID}.jsonl`), main.join('\n') + '\n');
  for (const s of subs) {
    const sd = path.join(dir, SID, 'subagents');
    fs.mkdirSync(sd, { recursive: true });
    fs.writeFileSync(path.join(sd, `agent-${s.id}.jsonl`), s.lines.join('\n') + '\n');
    fs.writeFileSync(path.join(sd, `agent-${s.id}.meta.json`), JSON.stringify({ agentType: s.type, toolUseId: s.toolUseId }));
  }
  fs.mkdirSync(paths.dir, { recursive: true });
  writeJsonAtomic(paths.manifest, { run_id: runId, experiment_id: 'exp-one', task_id: 'task-one', arm_id: 'arm-one', rep: 1, status, abort_reason: null, flags: [], clone_path: clone });
  writeJsonAtomic(paths.state, { ...newRunState(), status, session_id: SID, ...state });
  return { ...ctx, runId, paths, projectsDir, pricing: readJson(path.join(ctx.expRoot, 'pricing.json')) };
}
const extract = (s) => extractRun({ expRoot: s.expRoot, runId: s.runId, pricing: s.pricing, projectsDir: s.projectsDir });
const csv = (s) => fs.readFileSync(path.join(s.paths.dir, 'events.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));

test('E39: a message id repeated over several lines gives one row, last usage kept', () => {
  const s = setup({ main: [asst('m1', 1, use(5, 1), [{ type: 'thinking', thinking: '' }]), asst('m1', 2, use(10, 2), [toolUse('t1', 'Read', {})]), asst('m2', 3, use(20, 3))] });
  const { events } = extract(s);
  assert.equal(events.length, 2);
  assert.deepEqual([events[0].in_tok, events[0].out_tok], [10, 2]);
  assert.equal(events[0].tools, 'Read');
  assert.equal(events[0].started, T(1));
  assert.equal(events[0].ended, T(2));
});

test('E39: the real fixture transcript has 8 assistant lines and yields 7 rows (independent count)', () => {
  const fixtureLines = fs.readFileSync(path.join(here, 'fixtures', 'transcript-main.jsonl'), 'utf8').split('\n').filter(Boolean);
  const distinct = new Map();
  for (const l of fixtureLines) { const e = JSON.parse(l); if (e.type === 'assistant') distinct.set(e.message.id, e.message.usage); }
  const s = setup({ main: fixtureLines });
  const { events, usage } = extract(s);
  assert.equal(events.length, distinct.size);
  assert.equal(distinct.size, 7);
  const sum = (f) => [...distinct.values()].reduce((a, u) => a + f(u), 0);
  assert.equal(usage.in_tok, sum((u) => u.input_tokens));
  assert.equal(usage.out_tok, sum((u) => u.output_tokens));
  assert.equal(usage.cache_read_tok, sum((u) => u.cache_read_input_tokens));
  assert.equal(usage.cache_write_tok, sum((u) => u.cache_creation_input_tokens));
});

test('E40: two parallel subagents carry agent and parent ids, and totals equal the independent count', () => {
  const s = setup({
    main: [asst('m1', 1, use(100, 10, 0, 50), [toolUse('tuA', 'Agent', { subagent_type: 'reviewer' }), toolUse('tuB', 'Agent', { subagent_type: 'reviewer' })]), asst('m2', 9, use(30, 5, 200))],
    subs: [
      { id: 'aaa', type: 'reviewer', toolUseId: 'tuA', lines: [asst('a1', 2, use(7, 3, 0, 40)), asst('a2', 4, use(8, 4, 40))] },
      { id: 'bbb', type: 'reviewer', toolUseId: 'tuB', lines: [asst('b1', 3, use(9, 6, 0, 60))] },
    ],
  });
  const { events, usage } = extract(s);
  assert.equal(events.length, 5);
  const byAgent = (id) => events.filter((e) => e.agent_id === id);
  assert.equal(byAgent('main').length, 2);
  assert.ok(byAgent('aaa').every((e) => e.parent_id === 'main'));
  assert.ok(byAgent('bbb').every((e) => e.parent_id === 'main'));
  assert.equal(events.find((e) => e.agent_id === 'main').parent_id, '');
  assert.equal(usage.in_tok, 100 + 30 + 7 + 8 + 9);
  assert.equal(usage.out_tok, 10 + 5 + 3 + 4 + 6);
  assert.equal(usage.cache_read_tok, 200 + 40);
  assert.equal(usage.cache_write_tok, 50 + 40 + 60);
  assert.deepEqual(events.map((e) => e.seq), [1, 2, 3, 4, 5]);
});

test('a nested subagent\'s parent is the subagent that launched it', () => {
  const s = setup({
    main: [asst('m1', 1, use(1, 1), [toolUse('tuA', 'Agent', {})])],
    subs: [
      { id: 'aaa', type: 'planner', toolUseId: 'tuA', lines: [asst('a1', 2, use(1, 1), [toolUse('tuN', 'Agent', {})])] },
      { id: 'nnn', type: 'general-purpose', toolUseId: 'tuN', lines: [asst('n1', 3, use(1, 1))] },
    ],
  });
  const { events } = extract(s);
  assert.equal(events.find((e) => e.agent_id === 'nnn').parent_id, 'aaa');
});

test('E41: a truncated last line sets the truncated flag and keeps the complete messages', () => {
  const s = setup({ main: [asst('m1', 1, use(5, 1)), '{"type":"assistant","message":{"id":"m2","usage":{"input_tok'] });
  const { events, usage } = extract(s);
  assert.equal(events.length, 1);
  assert.equal(usage.truncated, true);
  assert.deepEqual(readJson(s.paths.manifest).flags, ['truncated']);
});

test('E69, F9: three-plus events under the stub prices give hand-computed costs; the run total is rounded once', () => {
  const s = setup({
    main: [
      asst('m1', 1, use(1000, 500)), // (2000 + 5000) / 1e6 = 0.007
      asst('m2', 2, use(200000, 4000, 150000, 20000)), // (400000 + 40000 + 15000 + 50000) / 1e6 = 0.505
      asst('m3', 3, use(10, 20, 1000, 0, 500)), // (20 + 200 + 100 + 2000) / 1e6 = 0.00232
      asst('m4', 4, use(16, 0)), // 32 / 1e6 = 0.000032
    ],
  });
  const { usage } = extract(s);
  assert.deepEqual(csv(s).map((r) => r[14]), ['0.007000', '0.505000', '0.002320', '0.000032']);
  assert.equal(usage.arm_cost_usd, 0.5144); // 0.514352 rounded once; rounding each event first gives 0.5143
});

test('an unpriced model leaves the cost empty and the run total null', () => {
  const s = setup({ main: [asst('m1', 1, use(10, 1), undefined, 'claude-unknown-9')] });
  const { usage } = extract(s);
  assert.equal(usage.arm_cost_usd, null);
  assert.deepEqual(usage.unpriced_models, ['claude-unknown-9']);
  assert.equal(csv(s)[0][14], '');
});

test('E42: an extracted cost more than 2 percent from the CLI total is reported', () => {
  const main = [asst('m1', 1, use(1000, 500))]; // 0.007
  const off = extract(setup({ main, state: { cli_total_usd: 0.007 * 1.05 } }));
  assert.equal(off.warnings.length, 1);
  assert.match(off.warnings[0], /differs from the CLI total/);
  const ok = extract(setup({ main, state: { cli_total_usd: 0.00705 } }));
  assert.deepEqual(ok.warnings, []);
  assert.ok(ok.usage.reference.diff_pct < 2);
  const none = extract(setup({ main }));
  assert.equal(none.usage.reference, null);
});

test('N8: extracting twice gives byte-identical files', () => {
  const s = setup({
    main: [asst('m1', 1, use(100, 10, 0, 50), [toolUse('tuA', 'Agent', {})]), asst('m2', 5, use(30, 5, 200))],
    subs: [{ id: 'aaa', type: 'reviewer', toolUseId: 'tuA', lines: [asst('a1', 2, use(7, 3))] }],
    state: { cli_total_usd: 0.01 },
  });
  const files = () => ['events.csv', 'usage.json', 'transcript/main.jsonl', 'transcript/subagents/agent-aaa.jsonl'].map((f) => fs.readFileSync(path.join(s.paths.dir, f), 'utf8'));
  extract(s);
  const first = files();
  const again = extract(s);
  assert.equal(readJson(s.paths.state).status, 'extracted');
  assert.deepEqual(files(), first);
  assert.ok(again.usage.events > 0);
});

test('F9: transcripts are copied and hashed into usage.json', () => {
  const s = setup({ main: [asst('m1', 1, use(1, 1))] });
  const { usage } = extract(s);
  assert.equal(usage.transcripts[0].path, 'main.jsonl');
  assert.match(usage.transcripts[0].sha256, /^[0-9a-f]{64}$/);
});

test('an aborted run is extracted too, and keeps its abort reason', () => {
  const s = setup({ main: [asst('m1', 1, use(1, 1))], status: 'aborted', state: { abort_reason: 'budget' } });
  extract(s);
  const st = readJson(s.paths.state);
  assert.equal(st.status, 'extracted');
  assert.equal(st.abort_reason, 'budget');
});

test('a run still running, queued or waiting cannot be extracted (exit 2)', () => {
  for (const status of ['running', 'queued', 'waiting_operator']) {
    const s = setup({ main: [asst('m1', 1, use(1, 1))], status });
    assert.throws(() => extract(s), (e) => e instanceof UsageError && e.exit === 2, status);
  }
  assert.throws(() => extractRun({ expRoot: tmpDir(), runId: 'nope', pricing: {} }), UsageError);
});

test('F10: phases come from the arm phase_map through skills and subagent types', () => {
  const s = setup({
    arm: { phase_map: { 'writing-specs-lite': 'spec', reviewer: 'review' } },
    main: [
      asst('m1', 1, use(1, 1), [toolUse('s1', 'Skill', { skill: 'writing-specs-lite' })]),
      asst('m2', 2, use(1, 1), [toolUse('tuA', 'Agent', {})]),
      asst('m3', 6, use(1, 1)),
    ],
    subs: [{ id: 'aaa', type: 'reviewer', toolUseId: 'tuA', lines: [asst('a1', 3, use(1, 1))] }],
  });
  const { events, usage } = extract(s);
  assert.deepEqual(Object.fromEntries(events.map((e) => [e.message_id, e.phase])), { m1: 'other', m2: 'spec', a1: 'review', m3: 'spec' });
  assert.equal(usage.by_phase.spec.events, 2);
});

test('review_rounds and fix_iterations come from the transcript', () => {
  const s = setup({
    arm: { review: { lenses: ['Implementer'], agent_types: ['reviewer'], max_rounds: 1 } },
    main: [
      asst('m1', 1, use(1, 1), [toolUse('tuA', 'Agent', {}), toolUse('tuB', 'Agent', {})]),
      asst('m2', 4, use(1, 1), [toolUse('b1', 'Bash', { command: 'node .claude/skills/x/scripts/lint.mjs spec a.md' })]),
      line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b1', content: 'ERROR x', is_error: true }] } }),
      asst('m3', 5, use(1, 1), [toolUse('tuC', 'Agent', {})]),
    ],
    subs: [
      { id: 'aaa', type: 'reviewer', toolUseId: 'tuA', lines: [asst('a1', 2, use(1, 1))] },
      { id: 'bbb', type: 'reviewer', toolUseId: 'tuB', lines: [asst('b1x', 3, use(1, 1))] },
      { id: 'ccc', type: 'reviewer', toolUseId: 'tuC', lines: [asst('c1', 6, use(1, 1))] },
    ],
  });
  const { usage } = extract(s);
  assert.equal(usage.review_rounds, 2);
  assert.equal(usage.review_cap_exceeded, true);
  assert.equal(usage.fix_iterations, 1);
  assert.ok(readJson(s.paths.manifest).flags.includes('review_cap_exceeded'));
});

test('time terms and cost classes are written when the state has them', () => {
  const s = setup({
    main: [asst('m1', 1, use(1000, 500))],
    state: { first_prompt_at: T(0), ended_at: T(100), timeline: { waits: [{ start: T(40), end: T(70) }], answerer: [{ start: T(36), end: T(40) }] }, spend: { arm: 9, answerer: 0.0123, matcher: 0, judge: 0, probe: 0.05 } },
  });
  const { usage } = extract(s);
  assert.deepEqual(usage.time, { wall_s: 100, wait_s: 30, answerer_s: 4, agent_s: 66 });
  assert.equal(usage.arm_cost_usd, 0.007);
  assert.equal(usage.answerer_cost_usd, 0.0123);
  assert.equal(usage.probe_cost_usd, 0.05);
});

test('the extract command exits 2 for a running run and for an unknown run (T5 step 5)', async () => {
  const { spawnSync } = await import('node:child_process');
  const { EXP_ROOT } = await import('./paths.mjs');
  const id = `test-running-${process.pid}`;
  const paths = runPaths(EXP_ROOT, id);
  fs.mkdirSync(paths.dir, { recursive: true });
  try {
    writeJsonAtomic(paths.manifest, { run_id: id, experiment_id: 'x', task_id: 'task-one', arm_id: 'arm-one', rep: 1, flags: [] });
    writeJsonAtomic(paths.state, { ...newRunState(), status: 'running' });
    const run = (runId) => spawnSync(process.execPath, [path.join(here, 'exp.mjs'), 'extract', runId], { encoding: 'utf8' });
    const running = run(id);
    assert.equal(running.status, 2);
    assert.match(running.stderr, /is running/);
    assert.equal(run('no-such-run-at-all').status, 2);
    assert.equal(spawnSync(process.execPath, [path.join(here, 'exp.mjs'), 'extract'], { encoding: 'utf8' }).status, 2);
  } finally {
    fs.rmSync(paths.dir, { recursive: true, force: true });
  }
});
