// T6: attempts, the restore, --continue and kills between steps of the implementation driver.
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

// ---- attempts: E50 to E53, E33, E102 -------------------------------------------------------------------------------------

test('E50: a red first attempt with attempts 1 stops after one', async () => {
  const ctx = await setup({ experiment: { ...one, attempts: 1 } });
  const cli = fakeCli([PROBE, RED, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 0, text(res));
  assert.equal(cli.calls().length, 2);
  assert.equal(stateOf(ctx).status, 'done');
  assert.equal(checkOf(ctx, 1, 1).green, false);
  assert.ok(!fs.existsSync(checkFile(ctx, 1, 2)));
});

test('E51: two red attempts stop at two; the run is done with no attempt 3', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, RED, RED, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 0, text(res));
  assert.equal(cli.calls().length, 3);
  assert.equal(stateOf(ctx).attempt, 2);
  assert.equal(stateOf(ctx).status, 'done');
  assert.equal(checkOf(ctx, 1, 2).green, false);
});

test('E47, E52, E53: attempt 2 restores harness bytes, resumes the same session with the exact template and sets the boundary once', async () => {
  const ctx = await setup({ experiment: one });
  const bad = { text: 'Done.\nEXP-DONE', effects: [{ op: 'write', path: 'src/app.txt', content: 'tampered' }, { op: 'write', path: 'docs/plan-1.md', content: 'edited' }] };
  const fix = { ...GOOD, text: 'Fixed.\nEXP-DONE' };
  const cli = fakeCli([PROBE, bad, fix]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 0, text(res));
  const first = checkOf(ctx, 1, 1);
  assert.equal(first.green, false);
  assert.deepEqual(first.protected_changed, ['src/app.txt']);
  assert.deepEqual(first.plan_changed, ['docs/plan-1.md']);
  assert.ok(first.flags.includes('protected_modified') && first.flags.includes('plan_modified'));
  const calls = cli.calls();
  const expected = buildFeedback({ result: first, restored: ['src/app.txt', 'docs/plan-1.md'], checks: readJson(path.join(ctx.implTaskDir, 'acceptance', 'checks.json')) });
  assert.equal(calls[2].prompt, expected);
  assert.match(calls[2].prompt, /Required checks that failed:\n- A note can be created\./);
  assert.match(calls[2].prompt, /Restored files:\n- src\/app\.txt\n- docs\/plan-1\.md/);
  const s = stateOf(ctx);
  assert.equal(calls[2].argv[calls[2].argv.indexOf('--resume') + 1], s.session_id);
  assert.equal(fs.readFileSync(path.join(cloneOf(ctx), 'src', 'app.txt'), 'utf8'), 'app');
  assert.equal(fs.readFileSync(path.join(cloneOf(ctx), 'docs', 'plan-1.md'), 'utf8'), 'plan');
  assert.equal(s.attempt, 2);
  assert.ok(s.attempt2_started);
  assert.equal(s.cli_total_at_boundary > 0, true);
  assert.ok(s.cli_total_at_boundary < s.cli_total_usd);
  assert.equal(checkOf(ctx, 1, 2).green, true, JSON.stringify(checkOf(ctx, 1, 2)));
});


test('E33: a kill in checking re-runs the checks only: no new turn, no second charge, stale scratch removed', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, GOOD, GOOD]);
  await assert.rejects(drive(ctx, cli, { deps: crashAt('checking_start') }), Crash);
  assert.equal(stateOf(ctx).attempt_state, 'checking');
  assert.equal(stateOf(ctx).status, 'running');
  const spent = stateOf(ctx).spend.arm;
  const junk = path.join(ctx.expRoot, 'local', 'scratch', `${rid(1)}-a1`, 'verify', 'leaked.txt');
  put(junk, 'x');
  const res = await drive(ctx, cli, { continueRunId: rid(1) });
  assert.equal(res.exit, 0, text(res));
  assert.equal(cli.calls().length, 2, 'only the probe and the one turn of the first run');
  assert.equal(stateOf(ctx).spend.arm, spent);
  assert.equal(stateOf(ctx).status, 'done');
  assert.equal(checkOf(ctx, 1, 1).green, true);
  assert.ok(!fs.existsSync(junk));
});

test('E53: a kill between attempt 1 and the attempt 2 turn resumes at attempt 2 from checks/attempt-1.json', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, RED, { ...GOOD, text: 'Fixed.\nEXP-DONE' }]);
  await assert.rejects(drive(ctx, cli, { deps: crashAt('before_attempt2_prompt') }), Crash);
  const killed = stateOf(ctx);
  assert.equal(killed.attempt, 2);
  assert.equal(killed.attempt_state, 'agent');
  const firstBytes = fs.readFileSync(checkFile(ctx, 1, 1), 'utf8');
  const res = await drive(ctx, cli, { continueRunId: rid(1) });
  assert.equal(res.exit, 0, text(res));
  assert.equal(fs.readFileSync(checkFile(ctx, 1, 1), 'utf8'), firstBytes, 'attempt 1 was not run again');
  assert.equal(stateOf(ctx).attempt2_started, killed.attempt2_started, 'set once');
  const calls = cli.calls();
  assert.equal(calls.length, 4, 'probe, attempt 1, then the resume probe and the attempt 2 turn');
  assert.equal(calls[3].prompt, killed.next_prompt);
  assert.equal(checkOf(ctx, 1, 2).green, true);
});

test('E39, E53: a kill after the attempt-1 result was written does not repeat the checks', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, RED, { ...GOOD, text: 'Fixed.\nEXP-DONE' }]);
  await assert.rejects(drive(ctx, cli, { deps: crashAt('after_checks_file') }), Crash);
  const firstBytes = fs.readFileSync(checkFile(ctx, 1, 1), 'utf8');
  const res = await drive(ctx, cli, { continueRunId: rid(1) });
  assert.equal(res.exit, 0, text(res));
  assert.equal(fs.readFileSync(checkFile(ctx, 1, 1), 'utf8'), firstBytes);
  assert.equal(checkOf(ctx, 1, 2).green, true);
});

test('E12: an adapter changed before attempt 2 and on --continue exits 7', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, RED, GOOD]);
  await assert.rejects(drive(ctx, cli, { deps: crashAt('after_checks_file') }), Crash);
  fs.appendFileSync(path.join(ctx.implTaskDir, 'acceptance', 'adapters', 'toy-plan.mjs'), '\n// edited\n');
  const res = await drive(ctx, cli, { continueRunId: rid(1) });
  assert.equal(res.exit, 7, text(res));
  assert.match(text(res), /adapter_sha256|task/);
});

test('E12: a hash that changes between the checks of attempt 1 and attempt 2 exits 7', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, RED, GOOD]);
  const res = await drive(ctx, cli, {
    deps: { hook: (name) => { if (name === 'after_checks_file') fs.appendFileSync(path.join(ctx.implTaskDir, 'acceptance', 'adapters', 'toy-plan.mjs'), '\n// edited\n'); } },
  });
  assert.equal(res.exit, 7, text(res));
  assert.equal(cli.calls().length, 2, 'attempt 2 was not started');
});

test('E102: a junction in the way of the restore aborts containment and the attempt-2 turn is not started', async () => {
  const ctx = await setup({ experiment: one });
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-out-'));
  const evil = { text: 'Done.\nEXP-DONE', effects: [{ op: 'rm', path: 'docs' }, { op: 'link', path: 'docs', target: out }] };
  const cli = fakeCli([PROBE, evil, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 10, text(res));
  assert.equal(stateOf(ctx).abort_reason, 'containment');
  assert.equal(cli.calls().length, 2);
  assert.equal(checkOf(ctx, 1, 1).flags.includes('unsafe_path'), true);
  assert.deepEqual(fs.readdirSync(out), [], 'nothing was written through the link');
});

