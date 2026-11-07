// T6: ceilings and cost accounting of the implementation driver.
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

// ---- cost: E71 to E73 ---------------------------------------------------------------------------------------------------

test('E71: a run over its ceiling mid-attempt aborts budget with no check result for the cut attempt', async () => {
  const ctx = await setup({ experiment: { ...one, run_ceiling_usd: 0.0003 } });
  const res = await drive(ctx, fakeCli([PROBE, GOOD]));
  assert.equal(res.exit, 5, text(res));
  assert.equal(stateOf(ctx).abort_reason, 'budget');
  assert.ok(stateOf(ctx).spend.arm > 0);
  assert.ok(!fs.existsSync(checkFile(ctx, 1, 1)));
});

test('E72: the batch ceiling leaves the remaining runs queued with exit 5, and review spend counts', async () => {
  const ctx = await setup({ experiment: { samples: 2, batch_ceiling_usd: 0.0005 } });
  const res = await drive(ctx, fakeCli({ per_cwd: { 'toy-plan-s1': [PROBE, GOOD], 'toy-plan-s2': [PROBE, GOOD] } }));
  assert.equal(res.exit, 5, text(res));
  assert.equal(stateOf(ctx, 1).status, 'done');
  assert.equal(stateOf(ctx, 2).status, 'queued');
  assert.match(text(res), /not_started: batch_ceiling/);
  const seeded = await setup({ experiment: { samples: 1, batch_ceiling_usd: 1 } });
  put(path.join(seeded.expRoot, 'local', 'experiments', 'impl-one', 'state.json'), { arm_codes: { 'implementer-one': 'A' }, batch_spend_usd: { arm: 0, answerer: 0, matcher: 0, judge: 1, probe: 0 } });
  const cli = fakeCli([PROBE, GOOD]);
  const res2 = await drive(seeded, cli);
  assert.equal(res2.exit, 5);
  assert.equal(cli.calls().length, 0, 'review spend already used the batch ceiling');
});

test('E73: a gap above 2% between the sum of the session totals and the CLI total sets cost_mismatch', async () => {
  const ctx = await setup({ experiment: one });
  const res = await drive(ctx, fakeCli([PROBE, { ...GOOD, cli_total: 0.5 }]));
  assert.equal(res.exit, 0, text(res));
  assert.ok(manifestOf(ctx).flags.includes('cost_mismatch'));
  const ok = await setup({ experiment: one });
  await drive(ok, fakeCli([PROBE, GOOD]));
  assert.ok(!manifestOf(ok).flags.includes('cost_mismatch'));
});

test('E73: totals are summed per session and cumulative across the two attempts', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, RED, { ...GOOD, text: 'Fixed.\nEXP-DONE' }]);
  await drive(ctx, cli);
  const s = stateOf(ctx);
  assert.equal(Object.keys(s.sessions).length, 1, 'the same session was resumed');
  const [sess] = Object.values(s.sessions);
  assert.ok(Math.abs(sess.computed - s.spend.arm) < 1e-9);
  assert.ok(Math.abs(sess.cli - sess.computed) < 1e-9);
});

