import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { COMPLETION_BLOCK, CONTINUE_PROMPT, FIXED_ASSUMPTION, MAX_QUESTIONS, PROBE_PROMPT, RETRY_PROMPT, runExperiment, runIdFor } from './driver.mjs';
import { approvalHash, approve, loadState, readJson, runPaths, writeJsonAtomic } from './state.mjs';
import { isolationFlags } from './spawn.mjs';
import { fakeCli, git, makeExperimentRepo, pidAlive, put } from './testkit.mjs';
import { addEntry } from './bank.mjs';
import { timeTerms } from './metrics.mjs';
import { answerItem, loadItems, readAuto } from './queue.mjs';

const NOW = () => new Date('2026-11-03T12:00:00Z');
const runId = (rep) => runIdFor(NOW(), 'task-one', 'arm-one', rep);
const PROBE = { text: 'ok' };
const DONE = { text: 'Spec and plan written.\nEXP-DONE' };
const QUESTION = { text: 'Which role may edit a note?' };

async function drive(ctx, cli, opts = {}) {
  if (!opts.unapproved) approve(ctx.configDir, 'arm-one', approvalHash({ expRoot: ctx.expRoot, armId: 'arm-one' }));
  return runExperiment({
    repoRoot: ctx.repoRoot, expRoot: ctx.expRoot, experimentId: 'exp-one', filters: opts.filters ?? {}, dry: opts.dry, yes: opts.yes,
    continueRunId: opts.continueRunId,
    deps: { launcher: cli.launcher, extraEnv: cli.env, configDir: ctx.configDir, home: ctx.home, now: NOW, ...(opts.sheet ? {} : { answer: async () => ({ text: FIXED_ASSUMPTION, source: 'assumption' }) }), ...opts.deps },
  });
}
const stateOf = (ctx, rep = 1) => loadState(runPaths(ctx.expRoot, runId(rep)));
const noRunDirs = (ctx) => !fs.existsSync(path.join(ctx.expRoot, 'local', 'runs'));
const single = { filters: { rep: 1 } };
const withExperiment = (ctx, over) => put(path.join(ctx.expRoot, 'experiments', 'exp-one.json'), { ...readJson(path.join(ctx.expRoot, 'experiments', 'exp-one.json')), ...over });

test('happy path: probe, then the task prompt with the brief and the completion block, then done', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 0, res.lines.join('\n'));
  const s = stateOf(ctx);
  assert.equal(s.status, 'done');
  assert.match(s.session_id, /^[0-9a-f-]{36}$/);
  assert.ok(s.spend.arm > 0 && s.spend.probe > 0);
  const [probe, task] = cli.calls();
  assert.equal(probe.prompt, PROBE_PROMPT);
  assert.ok(task.prompt.includes('Add a note to an epic.') && task.prompt.includes('task-one') && task.prompt.endsWith(COMPLETION_BLOCK));
  assert.ok(!task.argv.includes('--resume'), 'the first task invocation is a fresh session');
  const manifest = readJson(runPaths(ctx.expRoot, runId(1)).manifest);
  assert.equal(manifest.versions.cli, '2.1.316');
  assert.equal(manifest.status, 'done');
  assert.equal(git(task.cwd, 'remote'), '', 'the run clone has no remote');
});

test('a question gets the fixed assumption text, stored with source assumption, and the session is resumed', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, QUESTION, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 0);
  const calls = cli.calls();
  assert.equal(calls[2].prompt, FIXED_ASSUMPTION);
  const sid = stateOf(ctx).session_id;
  assert.equal(calls[2].argv[calls[2].argv.indexOf('--resume') + 1], sid);
  const rows = fs.readFileSync(runPaths(ctx.expRoot, runId(1)).questions, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'assumption');
  assert.equal(rows[0].text, QUESTION.text);
});

test('E58: the probe, the first task launch and the resumed launch share their isolation flags', async () => {
  const ctx = makeExperimentRepo({ plugin: true });
  const cli = fakeCli([{ ...PROBE, hook_events: [{ hook_name: 'SessionStart:startup', hook_event: 'SessionStart' }], init: { skills: [], agents: [] } }, QUESTION, DONE]);
  // the plugin adds skill pl:alpha; supply the full expected skill list for the fake init
  const { BUILTIN_SKILLS, BUILTIN_AGENTS } = await import('./baseline.mjs');
  const full = JSON.parse(fs.readFileSync(cli.scriptFile, 'utf8'));
  full.steps = full.steps.map((st) => ({ ...st, init: { ...(st.init ?? {}), skills: [...BUILTIN_SKILLS, 'pl:alpha'], agents: BUILTIN_AGENTS } }));
  fs.writeFileSync(cli.scriptFile, JSON.stringify(full));
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 0, res.lines.join('\n'));
  const flags = cli.calls().map((c) => isolationFlags(c.argv));
  assert.equal(flags.length, 3);
  assert.deepEqual(flags[1], flags[0]);
  assert.deepEqual(flags[2], flags[0]);
  assert.ok(flags[0].some((f) => f.startsWith('--plugin-dir=')));
});

const expFileRel = 'workflow/experiments/experiments/exp-one.json';
const untrack = ({ repoRoot }) => { git(repoRoot, 'rm', '-q', '--cached', expFileRel); git(repoRoot, 'commit', '-q', '-m', 'untrack'); };

test('E12: an untracked experiment file exits 7 and nothing starts', async () => {
  const ctx = makeExperimentRepo();
  untrack(ctx);
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 7);
  assert.match(res.lines.join('\n'), /untracked/);
  assert.equal(cli.calls().length, 0);
  assert.ok(noRunDirs(ctx));
});

test('E12: an experiment file that is staged but not committed exits 7', async () => {
  const ctx = makeExperimentRepo();
  untrack(ctx);
  git(ctx.repoRoot, 'add', expFileRel);
  const res = await drive(ctx, fakeCli([PROBE, DONE]), single);
  assert.equal(res.exit, 7);
  assert.match(res.lines.join('\n'), /staged/);
});

test('E12: a modified experiment file exits 7', async () => {
  const ctx = makeExperimentRepo();
  withExperiment(ctx, { replicates: 4 });
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 7);
  assert.match(res.lines.join('\n'), /modified/);
  assert.equal(cli.calls().length, 0);
});

test('E11: an arm with stage implementation exits 8 before any clone or run folder exists', async () => {
  const ctx = makeExperimentRepo({
    arm: { stage: 'implementation' },
    tweak: ({ expRoot }) => put(path.join(expRoot, 'tasks', 'task-one', 'task.json'), { ...readJson(path.join(expRoot, 'tasks', 'task-one', 'task.json')), stage: 'implementation' }),
  });
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 8);
  assert.equal(cli.calls().length, 0);
  assert.ok(noRunDirs(ctx));
  assert.deepEqual(fs.readdirSync(ctx.worktreesRoot), []);
});

for (const stage of ['ablation', 'model_tier', 'implementation']) {
  test(`stage: an experiment file with stage ${stage} exits 8 before any call, clone or run folder (until T6 for implementation)`, async () => {
    const ctx = makeExperimentRepo({ experiment: { stage, arm_ids: undefined, task_ids: undefined } });
    const cli = fakeCli([PROBE, DONE]);
    const res = await drive(ctx, cli, single);
    const text = res.lines.join('\n');
    assert.equal(res.exit, 8, text);
    assert.match(text, new RegExp(stage));
    assert.equal(cli.calls().length, 0);
    assert.ok(noRunDirs(ctx));
    assert.deepEqual(fs.readdirSync(ctx.worktreesRoot), []);
  });
}

test('E13: a clone path over 200 characters exits 3 and creates nothing', async () => {
  const ctx = makeExperimentRepo();
  const long = path.join(ctx.worktreesRoot, 'x'.repeat(200));
  put(path.join(ctx.expRoot, 'config.json'), { ...readJson(path.join(ctx.expRoot, 'config.json')), worktrees_root: long });
  const res = await drive(ctx, fakeCli([PROBE, DONE]), single);
  assert.equal(res.exit, 3);
  assert.match(res.lines.join('\n'), /200 characters/);
  assert.ok(noRunDirs(ctx));
  assert.ok(!fs.existsSync(long));
});

test('E4: an unapproved arm exits 2 and shows the hash; --yes with a wrong hash still exits 2; the right one proceeds', async () => {
  const ctx = makeExperimentRepo({ plugin: true });
  const hash = approvalHash({ expRoot: ctx.expRoot, armId: 'arm-one' });
  const cli = fakeCli([PROBE, DONE]);
  let res = await drive(ctx, cli, { unapproved: true, dry: true });
  assert.equal(res.exit, 2);
  assert.ok(res.lines.join('\n').includes(hash));
  assert.match(res.lines.join('\n'), /plugins \[pl\]/);
  res = await drive(ctx, cli, { unapproved: true, dry: true, yes: { 'arm-one': 'deadbeef' } });
  assert.equal(res.exit, 2);
  res = await drive(ctx, cli, { unapproved: true, dry: true, yes: { 'arm-one': hash } });
  assert.equal(res.exit, 0);
  assert.equal(res.lines.filter((l) => l.startsWith('planned run')).length, 3);
  fs.appendFileSync(path.join(ctx.expRoot, 'plugins', 'pl', 'skills', 'alpha', 'SKILL.md'), ' edited');
  res = await drive(ctx, cli, { unapproved: true, dry: true });
  assert.equal(res.exit, 2, 'editing a plugin file invalidates the approval');
  assert.equal(cli.calls().length, 0);
});

test('--dry prints the planned run ids and creates nothing', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, { dry: true });
  assert.equal(res.exit, 0);
  assert.deepEqual(res.lines.filter((l) => l.startsWith('planned run')), [1, 2, 3].map((r) => `planned run ${runId(r)}`));
  assert.equal(cli.calls().length, 0);
  assert.ok(noRunDirs(ctx));
});

test('E24: an extra plugin in the probe aborts isolation_mismatch, exit 4, and no task prompt is sent', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([{ ...PROBE, init: { plugins: [{ name: 'sneaky', path: 'x', source: 'sneaky@inline' }] } }, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 4);
  assert.equal(cli.calls().length, 1);
  const s = stateOf(ctx);
  assert.equal(s.abort_reason, 'isolation_mismatch');
  assert.equal(s.status, 'aborted');
});

test('E71: an undeclared hook in the probe aborts isolation_mismatch', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([{ ...PROBE, hook_events: [{ hook_name: 'SessionStart:startup', hook_event: 'SessionStart' }] }, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 4);
  assert.match(stateOf(ctx).abort_detail, /SessionStart:startup/);
});

test('E16: two empty replies in a row abort turn_cap, exit 6, after one retry prompt', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, { text: '   ' }, { text: '' }]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 6);
  assert.equal(stateOf(ctx).abort_reason, 'turn_cap');
  assert.equal(cli.calls()[2].prompt, RETRY_PROMPT);
  assert.equal(cli.calls().length, 3);
});

test('E17: the question after the cap aborts turn_cap, exit 6 (the cap is 40, so the 41st)', async () => {
  assert.equal(MAX_QUESTIONS, 40);
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, QUESTION]);
  const res = await drive(ctx, cli, { ...single, deps: { maxQuestions: 3 } }); // same mechanics, fewer spawns
  assert.equal(res.exit, 6);
  const s = stateOf(ctx);
  assert.equal(s.abort_reason, 'turn_cap');
  assert.equal(s.question_count, 4);
  const rows = fs.readFileSync(runPaths(ctx.expRoot, runId(1)).questions, 'utf8').split('\n').filter(Boolean);
  assert.equal(rows.length, 3);
});

test('E18: a CLI error stop aborts crash, exit 6', async () => {
  const ctx = makeExperimentRepo();
  const res = await drive(ctx, fakeCli([PROBE, { action: 'crash' }]), single);
  assert.equal(res.exit, 6);
  assert.equal(stateOf(ctx).abort_reason, 'crash');
});

test('E19: a hung turn is killed at turn_timeout_s, the run aborts timeout, exit 6, and no process is left', async () => {
  const ctx = makeExperimentRepo({ experiment: { turn_timeout_s: 2 } });
  const cli = fakeCli([PROBE, { action: 'hang' }]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 6);
  assert.equal(stateOf(ctx).abort_reason, 'timeout');
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(cli.pids().length >= 2);
  for (const pid of cli.pids()) assert.equal(pidAlive(pid), false, `pid ${pid} survived`);
});

test('E19: a run past run_timeout_s aborts timeout', async () => {
  const ctx = makeExperimentRepo({ experiment: { run_timeout_s: 3 } });
  const cli = fakeCli([PROBE, { ...QUESTION, sleep_ms: 1500 }]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 6);
  assert.equal(stateOf(ctx).abort_reason, 'timeout');
});

test('E23: --rep for an existing run exits 2; without --rep the next free reps are created, then exit 0 with a note', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, DONE]);
  assert.equal((await drive(ctx, cli, { filters: { rep: 2 } })).exit, 0);
  const again = await drive(ctx, cli, { filters: { rep: 2 } });
  assert.equal(again.exit, 2);
  assert.match(again.lines.join('\n'), /rep 2 already exists/);
  const rest = await drive(ctx, cli, {});
  assert.equal(rest.exit, 0);
  assert.deepEqual(rest.runs.map((r) => r.run_id).sort(), [runId(1), runId(3)]);
  const none = await drive(ctx, cli, {});
  assert.equal(none.exit, 0);
  assert.match(none.lines.join('\n'), /nothing to run/);
});

test('max_parallel 2 never has three runs active, and all three runs finish', async () => {
  const ctx = makeExperimentRepo({ experiment: { max_parallel: 2 } });
  const steps = [{ sleep_ms: 400 }, { ...DONE, sleep_ms: 400 }];
  const cli = fakeCli({ per_cwd: { '-r1': steps, '-r2': steps, '-r3': steps } });
  const res = await drive(ctx, cli, {});
  assert.equal(res.exit, 0, res.lines.join('\n'));
  assert.deepEqual(res.runs.map((r) => r.status), ['done', 'done', 'done']);
  let active = 0;
  let max = 0;
  for (const e of cli.activity().sort((a, b) => a.t - b.t || (a.event === 'end' ? -1 : 1))) {
    active += e.event === 'start' ? 1 : -1;
    max = Math.max(max, active);
  }
  assert.equal(max, 2);
});

test('E28: the child environment never holds the API key outside api_key mode', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, DONE]);
  process.env.ANTHROPIC_API_KEY = ['sk-ant-', 'test-key-for-env-check-0123456789'].join('');
  try { await drive(ctx, cli, single); } finally { delete process.env.ANTHROPIC_API_KEY; }
  for (const c of cli.calls()) {
    assert.ok(!c.env.includes('ANTHROPIC_API_KEY'));
    assert.ok(c.argv.includes('--disallowedTools'));
  }
});

test('E22: --continue on a terminal run exits 2; an unknown run id exits 2', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, DONE]);
  await drive(ctx, cli, single);
  const done = await drive(ctx, cli, { continueRunId: runId(1) });
  assert.equal(done.exit, 2);
  assert.match(done.lines.join('\n'), /done/);
  assert.equal((await drive(ctx, cli, { continueRunId: 'no-such-run' })).exit, 2);
});

/** Run once to a crash, then rewrite the state as a killed harness would have left it. */
async function killedRun(ctx, patch = {}) {
  const first = fakeCli([PROBE, { ...QUESTION, usage: { output: 500 } }, { action: 'crash' }]);
  await drive(ctx, first, single);
  const paths = runPaths(ctx.expRoot, runId(1));
  const s = loadState(paths);
  const sid = s.session_id;
  writeJsonAtomic(paths.state, { ...s, status: 'running', turn_state: 'in_turn', abort_reason: null, ended_at: null, ...patch });
  return { paths, sid, spend: s.spend.arm };
}

test('E20: --continue after a kill reloads spend and session id and sends the continue prompt', async () => {
  const ctx = makeExperimentRepo();
  const { sid, spend, paths } = await killedRun(ctx);
  assert.ok(spend > 0);
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, { continueRunId: runId(1) });
  assert.equal(res.exit, 0, res.lines.join('\n'));
  const [, resumed] = cli.calls();
  assert.equal(resumed.prompt, CONTINUE_PROMPT);
  assert.equal(resumed.argv[resumed.argv.indexOf('--resume') + 1], sid);
  const s = loadState(paths);
  assert.equal(s.status, 'done');
  assert.equal(s.session_id, sid);
  // the reloaded spend sets the cap: ceiling (5) minus spend so far
  const cap = Number(resumed.argv[resumed.argv.indexOf('--max-budget-usd') + 1]);
  assert.equal(cap, Math.round((5 - spend) * 1e4) / 1e4);
});

test('E59: --continue after the arm file changed exits 7 and spawns nothing', async () => {
  const ctx = makeExperimentRepo();
  await killedRun(ctx);
  const armFile = path.join(ctx.expRoot, 'arms', 'arm-one.json');
  put(armFile, { ...readJson(armFile), permission_mode: 'plan' });
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, { continueRunId: runId(1) });
  assert.equal(res.exit, 7);
  assert.match(res.lines.join('\n'), /arm/);
  assert.equal(cli.calls().length, 0);
});

test('E59: --continue after config.json changed exits 7', async () => {
  const ctx = makeExperimentRepo();
  await killedRun(ctx);
  put(path.join(ctx.expRoot, 'config.json'), { ...readJson(path.join(ctx.expRoot, 'config.json')), isolation_ignore: ['x'] });
  assert.equal((await drive(ctx, fakeCli([PROBE, DONE]), { continueRunId: runId(1) })).exit, 7);
});

test('E59: a stored session id of --dangerously-skip-permissions exits 3 and spawns nothing', async () => {
  const ctx = makeExperimentRepo();
  await killedRun(ctx, { session_id: '--dangerously-skip-permissions' });
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, { continueRunId: runId(1) });
  assert.equal(res.exit, 3);
  assert.equal(cli.calls().length, 0);
});

test('E53: a run reaching its ceiling at a turn end aborts budget, exit 5, with the overshoot recorded', async () => {
  const ctx = makeExperimentRepo({ experiment: { run_ceiling_usd: 0.0006 } });
  const cli = fakeCli([PROBE, QUESTION, QUESTION, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 5, res.lines.join('\n'));
  const s = stateOf(ctx);
  assert.equal(s.abort_reason, 'budget');
  assert.ok(s.overshoot_usd > 0);
  assert.ok(s.spend.arm >= 0.0006);
});

test('E65: the CLI budget stop is classified budget, not crash', async () => {
  const ctx = makeExperimentRepo();
  const res = await drive(ctx, fakeCli([PROBE, { action: 'budget' }]), single);
  assert.equal(res.exit, 5);
  assert.equal(stateOf(ctx).abort_reason, 'budget');
});

test('E54, E66: after the batch ceiling no new run starts, the rest stay queued, and the batch exits 5', async () => {
  const ctx = makeExperimentRepo({ experiment: { batch_ceiling_usd: 0.001, max_parallel: 1 } });
  const cli = fakeCli([PROBE, DONE]);
  const res = await drive(ctx, cli, {});
  assert.equal(res.exit, 5, res.lines.join('\n'));
  assert.deepEqual(res.runs.map((r) => r.status), ['done', 'done', 'queued']);
  assert.ok(res.table[2].includes('not_started: batch_ceiling'));
  assert.equal(stateOf(ctx, 3).status, 'queued');
});

test('E55: a batch with a budget stop and a crash exits 6 and prints the table', async () => {
  const ctx = makeExperimentRepo({ experiment: { max_parallel: 2, replicates: 2 } });
  const cli = fakeCli({ per_cwd: { '-r1': [PROBE, { action: 'budget' }], '-r2': [PROBE, { action: 'crash' }] } });
  const res = await drive(ctx, cli, {});
  assert.equal(res.exit, 6);
  assert.deepEqual(res.runs.map((r) => r.abort_reason).sort(), ['budget', 'crash']);
  assert.equal(res.table.length, 2);
});

test('E26: an agent appending to the main .git/config ends the run containment, exit 10, with the path listed', async () => {
  const ctx = makeExperimentRepo();
  const gitConfig = path.join(ctx.repoRoot, '.git', 'config');
  const cli = fakeCli([PROBE, { effects: [{ op: 'append', path: gitConfig, content: '\n[core]\n\thooksPath = /evil\n' }] }]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 10);
  const s = stateOf(ctx);
  assert.equal(s.abort_reason, 'containment');
  assert.ok(s.abort_detail.includes('config'));
});

test('E27: a write to ~/.claude/settings.json (a temp home) ends the run containment, exit 10', async () => {
  const ctx = makeExperimentRepo();
  const settings = path.join(ctx.home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.writeFileSync(settings, '{}');
  const cli = fakeCli([PROBE, { effects: [{ op: 'write', path: settings, content: '{"hooks":{"x":[]}}' }] }]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 10);
  assert.ok(stateOf(ctx).abort_detail.includes('settings.json'));
});

test('E64: a changed run state.json ends the run containment; every run with a turn in flight aborts', async () => {
  const ctx = makeExperimentRepo({ experiment: { max_parallel: 2, replicates: 2 } });
  const victim = runPaths(ctx.expRoot, runId(1)).state;
  const cli = fakeCli({
    per_cwd: {
      '-r1': [PROBE, { effects: [{ op: 'write', path: victim, content: '{"status":"done"}' }] }],
      '-r2': [PROBE, { sleep_ms: 1500, text: 'still working' }],
    },
  });
  const res = await drive(ctx, cli, {});
  assert.equal(res.exit, 10, res.lines.join('\n'));
  assert.deepEqual(res.runs.map((r) => r.abort_reason), ['containment', 'containment']);
  assert.ok(stateOf(ctx, 1).abort_detail.includes('state.json'));
});

test('afterRun is called once per started run (the seam T5 uses for extraction)', async () => {
  const ctx = makeExperimentRepo();
  const seen = [];
  const res = await drive(ctx, fakeCli([PROBE, DONE]), { filters: { rep: 1 }, deps: { afterRun: async (run) => { seen.push(run.run_id); } } });
  assert.equal(res.exit, 0);
  assert.deepEqual(seen, [runId(1)]);
});

const sheetReply = (covered, answer) => ({ text: JSON.stringify({ covered, answer }), usage: { output: 40 } });

test('T4 step 4: sheet mode asks the answerer; one covered and one silent question both get stored and the run is done', async () => {
  const ctx = makeExperimentRepo();
  const q1 = { text: 'Who counts as the PM?' };
  const q2 = { text: 'What is the maximum note length?' };
  const cli = fakeCli([PROBE, q1, sheetReply(true, 'The user whose role is PM.'), q2, sheetReply(false, ''), DONE]);
  const res = await drive(ctx, cli, { ...single, sheet: true });
  assert.equal(res.exit, 0, res.lines.join('\n'));
  const calls = cli.calls();
  assert.equal(calls.length, 6);
  assert.equal(calls[3].prompt, 'The user whose role is PM.', 'the covered answer is sent back to the agent');
  assert.equal(calls[5].prompt, FIXED_ASSUMPTION, 'the silent question gets the fixed text');
  assert.ok(path.basename(calls[2].cwd).startsWith('exp-neutral-'), 'the answerer ran in a neutral directory');
  const rows = fs.readFileSync(runPaths(ctx.expRoot, runId(1)).questions, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual(rows.map((r) => r.source), ['sheet', 'assumption']);
  const s = stateOf(ctx);
  assert.equal(s.status, 'done');
  assert.ok(s.spend.answerer > 0);
  assert.equal(s.timeline.answerer.length, 2);
  assert.equal(readJson(runPaths(ctx.expRoot, runId(1)).manifest).flags.includes('answerer_error'), false);
});

test('T4: an unusable answerer reply flags answerer_error on the run and still continues with the fixed text', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, QUESTION, { text: 'no json' }, { text: 'still no json' }, DONE]);
  const res = await drive(ctx, cli, { ...single, sheet: true });
  assert.equal(res.exit, 0, res.lines.join('\n'));
  assert.equal(cli.calls()[4].prompt, FIXED_ASSUMPTION);
  assert.ok(readJson(runPaths(ctx.expRoot, runId(1)).manifest).flags.includes('answerer_error'));
});

// ---- T10: bank mode, pause and resume -------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 30000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out waiting for a condition');
    await sleep(25);
  }
}
const bankDrive = (ctx, cli, opts = {}) => drive(ctx, cli, { sheet: true, ...opts, deps: { pollMs: 25, ...opts.deps } });
const readRows = (ctx, rep = 1) => fs.readFileSync(runPaths(ctx.expRoot, runId(rep)).questions, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('T10 step 4: a bank miss pauses the run, exp answer resumes it, and the wait is recorded and excluded', async () => {
  const ctx = makeExperimentRepo({ answerMode: 'bank' });
  const cli = fakeCli([PROBE, QUESTION, DONE]);
  const finished = bankDrive(ctx, cli, single);
  const item = await until(() => loadItems(ctx.expRoot)[0]);
  await until(() => stateOf(ctx).status === 'waiting_operator');
  assert.equal(stateOf(ctx).waiting_qid, item.qid);
  await sleep(400);
  const r = answerItem({ expRoot: ctx.expRoot, qid: item.qid, text: 'Only the PM may edit.' });
  assert.deepEqual(r.resumable, [runId(1)]);
  const res = await finished;
  assert.equal(res.exit, 0, res.lines.join('\n'));
  const s = stateOf(ctx);
  assert.equal(s.status, 'done');
  assert.equal(s.waiting_qid, null);
  assert.equal(cli.calls()[2].prompt, 'Only the PM may edit.');
  assert.equal(s.timeline.waits.length, 1);
  const waited = Date.parse(s.timeline.waits[0].end) - Date.parse(s.timeline.waits[0].start);
  assert.ok(waited >= 350, `wait of ${waited} ms recorded`);
  const rows = readRows(ctx);
  assert.deepEqual([rows[0].source, rows[0].bank_id], ['operator', 'b1']);
  // the wait is subtracted from agent time by the metrics (E63): a 10 s run with this wait
  const t = timeTerms({ start: 0, end: 10_000, waits: [{ start: 2000, end: 2000 + waited }] });
  assert.equal(t.wait_s, Math.round(waited / 1000));
  assert.equal(t.agent_s, 10 - t.wait_s - t.answerer_s);
});

test('E34 (driver): two runs asking the same question share one queue item and one answer resumes both', async () => {
  const ctx = makeExperimentRepo({ answerMode: 'bank', experiment: { max_parallel: 2, replicates: 2 } });
  const steps = [PROBE, { text: 'Who may edit a note?' }, DONE];
  const cli = fakeCli({ per_cwd: { '-r1': steps, '-r2': steps } });
  const finished = bankDrive(ctx, cli);
  const item = await until(() => { const i = loadItems(ctx.expRoot); return i.length === 1 && i[0].run_ids.length === 2 && i[0]; });
  await until(() => stateOf(ctx, 1).status === 'waiting_operator' && stateOf(ctx, 2).status === 'waiting_operator');
  const r = answerItem({ expRoot: ctx.expRoot, qid: item.qid, text: 'Only the PM.' });
  assert.equal(r.resumable.length, 2);
  const res = await finished;
  assert.equal(res.exit, 0, res.lines.join('\n'));
  assert.equal(loadItems(ctx.expRoot).length, 1);
  assert.deepEqual([readRows(ctx, 1)[0].source, readRows(ctx, 2)[0].source], ['operator', 'bank']);
});

test('an exact bank match answers at once, without waiting, and is logged for --audit', async () => {
  const ctx = makeExperimentRepo({ answerMode: 'bank' });
  addEntry(ctx.expRoot, { question: 'Max length of note?', answer: '500 characters.' });
  const cli = fakeCli([PROBE, { text: 'max length of the note' }, DONE]);
  const res = await bankDrive(ctx, cli, single);
  assert.equal(res.exit, 0, res.lines.join('\n'));
  assert.equal(cli.calls()[2].prompt, '500 characters.');
  assert.deepEqual([readRows(ctx)[0].source, readRows(ctx)[0].bank_id], ['bank', 'b1']);
  assert.equal(readAuto(ctx.expRoot).length, 1);
  assert.equal(loadItems(ctx.expRoot).length, 0);
  assert.equal(stateOf(ctx).timeline.waits.length, 0);
});

test('a near-duplicate waits: the model suggestion is stored on the item and not applied', async () => {
  const ctx = makeExperimentRepo({ answerMode: 'bank' });
  addEntry(ctx.expRoot, { question: 'Is a note deleted with its epic?', answer: 'Yes.' });
  const cli = fakeCli([PROBE, { text: 'What happens to notes when an epic is removed?' }, { text: '{"bank_id": "b1"}' }, DONE]);
  const finished = bankDrive(ctx, cli, single);
  const item = await until(() => loadItems(ctx.expRoot)[0]);
  assert.equal(item.suggested_bank_id, 'b1');
  assert.equal(item.bank_id, null);
  await until(() => stateOf(ctx).status === 'waiting_operator');
  assert.ok(stateOf(ctx).spend.matcher > 0);
  answerItem({ expRoot: ctx.expRoot, qid: item.qid, sameAs: 'b1' });
  const res = await finished;
  assert.equal(res.exit, 0, res.lines.join('\n'));
  assert.equal(cli.calls()[3].prompt, 'Yes.');
});

test('wait_timeout_s: a run left waiting too long aborts timeout', async () => {
  const ctx = makeExperimentRepo({ answerMode: 'bank', experiment: { wait_timeout_s: 1 } });
  const res = await bankDrive(ctx, fakeCli([PROBE, QUESTION, DONE]), single);
  assert.equal(res.exit, 6);
  assert.equal(stateOf(ctx).abort_reason, 'timeout');
});

test('--continue on a run killed while waiting resumes the wait and sends the answer', async () => {
  const ctx = makeExperimentRepo({ answerMode: 'bank' });
  const first = fakeCli([PROBE, QUESTION]);
  const run1 = bankDrive(ctx, first, { ...single, deps: { wait: 0, pollMs: 25 } });
  const item = await until(() => loadItems(ctx.expRoot)[0]);
  await until(() => stateOf(ctx).status === 'waiting_operator');
  // simulate the kill: stop the first batch from answering by making its run look aborted, then restore the waiting state
  const paths = runPaths(ctx.expRoot, runId(1));
  const waiting = readJson(paths.state);
  answerItem({ expRoot: ctx.expRoot, qid: item.qid, text: 'Only the PM.' });
  await run1;
  writeJsonAtomic(paths.state, { ...waiting, status: 'waiting_operator', waiting_qid: item.qid, abort_reason: null });
  const second = fakeCli([PROBE, DONE]);
  const res = await bankDrive(ctx, second, { continueRunId: runId(1) });
  assert.equal(res.exit, 0, res.lines.join('\n'));
  assert.equal(second.calls()[1].prompt, 'Only the PM.');
  assert.equal(stateOf(ctx).status, 'done');
});

test('an error stop keeps the CLI message in abort_detail (a usage-limit stop reports subtype success)', async () => {
  const ctx = makeExperimentRepo();
  const res = await drive(ctx, fakeCli([PROBE, { action: 'crash', text: "You've hit your 5-hour limit" }]), single);
  assert.equal(res.exit, 6);
  assert.equal(stateOf(ctx).abort_reason, 'crash');
  assert.match(stateOf(ctx).abort_detail, /5-hour limit/);
});

test('a status update is continued, never counted or logged as a question', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, { text: "The reviewer is running. I'll wait for its findings." }, DONE]);
  const res = await drive(ctx, cli, single);
  assert.equal(res.exit, 0, res.lines.join('\n'));
  assert.equal(cli.calls()[2].prompt, CONTINUE_PROMPT);
  const s = stateOf(ctx);
  assert.equal(s.question_count, 0);
  assert.equal(s.status_turns, 1);
  assert.ok(!fs.existsSync(runPaths(ctx.expRoot, runId(1)).questions), 'no question row is written');
});

test('status updates in a row past the cap abort turn_cap, exit 6', async () => {
  const ctx = makeExperimentRepo();
  const cli = fakeCli([PROBE, { text: 'The spec-writer is still running. I will wait for its completion notice.' }]);
  const res = await drive(ctx, cli, { ...single, deps: { maxStatusTurns: 2 } });
  assert.equal(res.exit, 6);
  const s = stateOf(ctx);
  assert.equal(s.abort_reason, 'turn_cap');
  assert.equal(s.question_count, 0);
});
