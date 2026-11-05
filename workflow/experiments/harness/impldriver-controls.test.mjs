// T6: end-of-turn controls, disk polling and git protection of the implementation driver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COMPLETION_BLOCK, PROBE_PROMPT } from './driver.mjs';
import { buildFeedback } from './implfeedback.mjs';
import { IMPL_ANSWER, implRunIdFor, outsideCloneAccess, toolActivity } from './impldriver.mjs';
import { plantCanary } from './canary.mjs';
import { readJson, writeJsonAtomic } from './state.mjs';
import { fakeCli, git, pidAlive, put } from './testkit.mjs';
import * as kit from './impldrivekit.mjs';
const {
  BUILD, GOOD, RED, PROBE, TASK, TEST_SRC, NOTES, QUESTION, crashAt, Crash, withCalls, fsHash, setup, drive, stateOf, manifestOf, checkFile, checkOf, cloneOf,
  text, noRunDirs, one, rid, cmd, NOW,
} = kit;

// ---- end-of-turn controls: E22, E23, E87, E99, E100 ----------------------------------------------------------------------

test('E23, E87: a detached child is swept at the end of the turn', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, { ...GOOD, effects: [...BUILD, { op: 'spawn' }] }]);
  const res = await drive(ctx, cli, { deps: { sweep: undefined } });
  assert.equal(res.exit, 0, text(res));
  const [pid] = cli.pids();
  assert.ok(pid, 'the fake CLI started a child');
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(pidAlive(pid), false, 'the sweep killed the child');
});

test('E23: a process that survives the sweep aborts the run with containment (exit 10)', async () => {
  const ctx = await setup({ experiment: one });
  const res = await drive(ctx, fakeCli([PROBE, GOOD]), { deps: { sweep: async () => ({ killed: [4242], survivors: [4242] }) } });
  assert.equal(res.exit, 10, text(res));
  assert.equal(stateOf(ctx).abort_reason, 'containment');
  assert.ok(!fs.existsSync(checkFile(ctx, 1, 1)));
});


test('E22: a tool call that names another sample\'s clone sets outside_clone_access and the attempt is red', async () => {
  const ctx = await setup();
  const s2 = withCalls([{ name: 'Bash', input: { command: `type ..\\${rid(1)}\\x` } }]);
  const cli = fakeCli({ per_cwd: { 'toy-plan-s1': [PROBE, GOOD], 'toy-plan-s2': [PROBE, { ...s2, text: 'Built it.\nEXP-DONE' }, { ...GOOD, text: 'Fixed.\nEXP-DONE' }] } });
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 0, text(res));
  assert.ok(!manifestOf(ctx, 1).flags.includes('outside_clone_access'));
  assert.ok(manifestOf(ctx, 2).flags.includes('outside_clone_access'));
  assert.equal(checkOf(ctx, 2, 1).green, false);
  assert.equal(checkOf(ctx, 2, 2).green, false, 'the flag makes every attempt red');
});

for (const [name, call] of [
  ['EXP_ROOT', { name: 'Read', input: { file_path: '$EXP_ROOT/local/runs/x' } }],
  ['the experiments local folder', { name: 'Glob', input: { pattern: 'workflow/experiments/local/**' } }],
  ['the user .claude folder', { name: 'Read', input: { file_path: '~/.claude/settings.json' } }],
  ['claude -p', { name: 'Bash', input: { command: 'claude -p "do it"' } }],
  ['curl', { name: 'Bash', input: { command: 'curl https://example.com/x' } }],
  ['Invoke-WebRequest', { name: 'PowerShell', input: { command: 'Invoke-WebRequest https://example.com' } }],
]) {
  test(`E22, E100: a tool call using ${name} sets outside_clone_access`, async () => {
    const ctx = await setup({ experiment: { ...one, attempts: 1 } });
    const res = await drive(ctx, fakeCli([PROBE, withCalls([call])]));
    assert.equal(res.exit, 0, text(res));
    assert.ok(manifestOf(ctx).flags.includes('outside_clone_access'));
    assert.equal(checkOf(ctx, 1, 1).green, false);
  });
}

test('outsideCloneAccess: work inside the own clone and a file that merely mentions curl are not flagged', () => {
  const clone = path.join(os.tmpdir(), 'wt-x', 'run-123456789');
  const base = { clone, worktreesRoot: path.dirname(clone), repoRoot: path.join(os.tmpdir(), 'repo-q'), expRoot: path.join(os.tmpdir(), 'repo-q', 'workflow', 'experiments'), home: path.join(os.tmpdir(), 'home-q'), canary: null };
  const ev = (calls) => [{ type: 'assistant', message: { content: calls.map((c) => ({ type: 'tool_use', ...c })) } }];
  assert.equal(outsideCloneAccess({ ...base, events: ev([{ name: 'Edit', input: { file_path: path.join(clone, 'src', 'a.ts') } }]) }), null);
  assert.equal(outsideCloneAccess({ ...base, events: ev([{ name: 'Write', input: { file_path: 'notes.md', content: 'use curl and claude -p later' } }]) }), null);
  assert.equal(toolActivity(ev([{ name: 'Bash', input: { command: 'ls' } }])).calls.length, 1);
});

test('E99: the canary token in a tool result or in a file of the clone sets outside_clone_access', async () => {
  let token;
  const tweak = (c) => { token = plantCanary([path.join(c.implTaskDir, 'acceptance', 'checks.json'), path.join(c.implTaskDir, 'acceptance', 'runner.mjs')]); };
  const ctx = await setup({ experiment: { ...one, attempts: 1 }, tweak });
  const res = await drive(ctx, fakeCli([PROBE, withCalls([{ name: 'Read', input: { file_path: 'x' } }], [`... canary:${token} ...`])]));
  assert.equal(res.exit, 0, text(res));
  assert.ok(manifestOf(ctx).flags.includes('outside_clone_access'));
  const ctx2 = await setup({ experiment: { ...one, attempts: 1 }, tweak });
  const res2 = await drive(ctx2, fakeCli([PROBE, { ...GOOD, effects: [...BUILD, { op: 'write', path: 'src/answers.mjs', content: `// ${token}\n` }] }]));
  assert.equal(res2.exit, 0, text(res2));
  assert.ok(manifestOf(ctx2).flags.includes('outside_clone_access'));
  assert.equal(checkOf(ctx2, 1, 1).green, false);
});

// ---- disk: E38, E101 ---------------------------------------------------------------------------------------------------

test('E38: a clone above max_clone_mb after a turn aborts disk and no checks run', async () => {
  const ctx = await setup({ experiment: { ...one, max_clone_mb: 10 } });
  const res = await drive(ctx, fakeCli([PROBE, GOOD]), { deps: { cloneSizeMb: () => 500 } });
  assert.equal(res.exit, 6, text(res));
  assert.equal(stateOf(ctx).abort_reason, 'disk');
  assert.ok(!fs.existsSync(checkFile(ctx, 1, 1)));
});

test('E101: the poll aborts a turn that fills the disk before the turn ends', async () => {
  const ctx = await setup({ experiment: { ...one, max_clone_mb: 10 } });
  const cli = fakeCli([PROBE, { ...GOOD, sleep_ms: 8000 }]);
  const res = await drive(ctx, cli, { deps: { diskPollMs: 50, cloneSizeMb: () => 500 } });
  assert.equal(res.exit, 6, text(res));
  assert.equal(stateOf(ctx).abort_reason, 'disk');
  assert.match(stateOf(ctx).abort_detail, /500 MB/);
  const ends = cli.activity().filter((a) => a.event === 'end');
  assert.ok(ends.length < 2 || ends.at(-1).t - cli.activity().filter((a) => a.event === 'start').at(-1).t < 6000, 'the turn was killed, not waited for');
  const low = await setup({ experiment: one });
  const res2 = await drive(low, fakeCli([PROBE, GOOD]), { deps: { freeDiskGb: () => 0.5 } });
  assert.equal(stateOf(low).abort_reason, 'disk');
  assert.equal(res2.exit, 6);
});

// ---- E84 to E88: git and the verify tree --------------------------------------------------------------------------------

test('E84: a changed .git/config is protected_modified, and the harness never runs git in the clone', async () => {
  const ctx = await setup({ experiment: { ...one, attempts: 1 } });
  const trap = '\n[core]\n\tfsmonitor = node -e "require(\'fs\').writeFileSync(\'PWNED\', \'1\')"\n';
  const res = await drive(ctx, fakeCli([PROBE, { ...GOOD, effects: [...BUILD, { op: 'append', path: '.git/config', content: trap }] }]));
  assert.equal(res.exit, 0, text(res));
  const c = checkOf(ctx, 1, 1);
  assert.ok(c.protected_changed.includes('.git/config'));
  assert.ok(c.flags.includes('protected_modified'));
  assert.equal(c.green, false);
  assert.ok(!fs.existsSync(path.join(cloneOf(ctx), 'PWNED')), 'no git command ran in the clone');
});

test('E85: a patched node_modules in the clone has no effect on the checks', async () => {
  const ctx = await setup({ experiment: { ...one, attempts: 1 } });
  const res = await drive(ctx, fakeCli([PROBE, { ...GOOD, effects: [...BUILD, { op: 'write', path: 'node_modules/pkg/index.js', content: 'patched' }] }]));
  assert.equal(res.exit, 0, text(res));
  assert.equal(checkOf(ctx, 1, 1).green, true);
  assert.ok(!checkOf(ctx, 1, 1).changed_files.some((f) => f.startsWith('node_modules')));
});

test('E39: a credential in check output keeps the result file, empties the lines, and the batch ends with exit 9', async () => {
  const ctx = await setup({ experiment: { ...one, attempts: 1 }, task: { checks: { ...TASK.checks, typecheck: [cmd(['node', '-e', "if (require('fs').existsSync('src/feature.mjs')) { console.error('error TS1: sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCD'); process.exit(1); }"])] } } });
  const res = await drive(ctx, fakeCli([PROBE, GOOD]));
  assert.equal(res.exit, 9, text(res));
  const c = checkOf(ctx, 1, 1);
  assert.equal(c.green, false);
  assert.equal(c.secret_in_check_output, true);
  assert.deepEqual(c.typecheck.lines, []);
  assert.ok(manifestOf(ctx).flags.includes('secret_in_check_output'));
  assert.equal(stateOf(ctx).status, 'done');
});
