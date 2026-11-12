// T6: the implementation driver: preflight, the clone and the turn loop (fake CLI, toy baseline; no test spends money).
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

// ---- preflight: F3, E11, E12, E17, E20, E103 -----------------------------------------------------------------

test('E11: a snapshot file edited after the experiment file was committed exits 7 before any call, naming the plan and the file', async () => {
  const ctx = await setup();
  put(path.join(ctx.expRoot, 'local', 'plans', 'pilot-001', 'toy-plan', 'files', 'docs', 'plan-1.md'), 'edited');
  const cli = fakeCli([PROBE, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 7, text(res));
  assert.match(text(res), /toy-plan/);
  assert.match(text(res), /docs\/plan-1\.md/);
  assert.equal(cli.calls().length, 0);
  assert.ok(noRunDirs(ctx));
});

test('E11: a snapshot.json that no longer matches its recorded hash exits 7', async () => {
  const ctx = await setup();
  const f = ctx.snapshotFile;
  put(f, { ...readJson(f), plan_cost_usd: 9 });
  const res = await drive(ctx, fakeCli([PROBE, GOOD]));
  assert.equal(res.exit, 7);
  assert.match(text(res), /toy-plan.*snapshot\.json/);
});

for (const [what, rel] of [['adapter', 'tasks/impl-task/acceptance/adapters/toy-plan.mjs'], ['checks.json', 'tasks/impl-task/acceptance/checks.json'], ['arm file', 'arms/implementer-one.json']]) {
  test(`E12: a modified ${what} exits 7 and no call is made`, async () => {
    const ctx = await setup();
    const file = path.join(ctx.expRoot, ...rel.split('/'));
    fs.appendFileSync(file, what === 'adapter' ? '\n// edited\n' : '\n ');
    const cli = fakeCli([PROBE, GOOD]);
    const res = await drive(ctx, cli);
    assert.equal(res.exit, 7, text(res));
    assert.match(text(res), /modified/);
    assert.equal(cli.calls().length, 0);
    assert.ok(noRunDirs(ctx));
  });
}

test('E17: no baseline and a stale baseline exit 3 naming exp baseline', async () => {
  const missing = await setup({ baseline: false });
  const res = await drive(missing, fakeCli([PROBE, GOOD]));
  assert.equal(res.exit, 3);
  assert.match(text(res), /exp baseline impl-task/);
  const stale = await setup();
  const bf = path.join(stale.expRoot, 'local', 'baselines', 'impl-task.json');
  writeJsonAtomic(bf, { ...readJson(bf), checks_sha256: '0'.repeat(64) });
  const cli = fakeCli([PROBE, GOOD]);
  const res2 = await drive(stale, cli);
  assert.equal(res2.exit, 3);
  assert.match(text(res2), /stale.*exp baseline/);
  assert.equal(cli.calls().length, 0);
});

test('E103: a changed pristine node_modules exits 7 before any call', async () => {
  const ctx = await setup();
  fs.appendFileSync(path.join(ctx.expRoot, 'local', 'baselines', 'impl-task', 'tree', 'node_modules', 'pkg', 'index.js'), 'patched');
  const cli = fakeCli([PROBE, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 7, text(res));
  assert.match(text(res), /node_modules/);
  assert.equal(cli.calls().length, 0);
});

test('E20: a plan path that collides with a tracked base file exits 3 naming the path', async () => {
  const ctx = await setup({
    tweak: (c) => {
      const f = path.join(c.expRoot, 'local', 'plans', 'pilot-001', 'toy-plan');
      put(path.join(f, 'files', 'src', 'app.txt'), 'overwrite');
      put(c.snapshotFile, { ...readJson(c.snapshotFile), files: [{ path: 'src/app.txt', kind: 'plan', sha256: fsHash('overwrite') }, { path: 'docs/spec-1.md', kind: 'spec', sha256: fsHash('spec') }] });
      const exp = path.join(c.expRoot, 'experiments', 'impl-one.json');
      const e = readJson(exp);
      put(exp, { ...e, plans: [{ ...e.plans[0], snapshot_sha256: fsHash(fs.readFileSync(c.snapshotFile)) }] });
    },
  });
  const cli = fakeCli([PROBE, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 3, text(res));
  assert.match(text(res), /src\/app\.txt/);
  assert.equal(cli.calls().length, 0);
  assert.ok(noRunDirs(ctx));
});


test('--task, --arm and --rep exit 2 for an implementation experiment, and --dry lists plans x samples', async () => {
  const ctx = await setup({ experiment: { samples: 2 } });
  for (const filters of [{ task: 'impl-task' }, { arm: 'implementer-one' }, { rep: 1 }]) {
    const res = await drive(ctx, fakeCli([PROBE, GOOD]), { filters });
    assert.equal(res.exit, 2, text(res));
  }
  const dry = await drive(ctx, fakeCli([PROBE, GOOD]), { dry: true });
  assert.equal(dry.exit, 0);
  assert.deepEqual(dry.lines.filter((l) => l.startsWith('planned run')), [`planned run ${rid(1)}`, `planned run ${rid(2)}`]);
  assert.ok(noRunDirs(ctx));
});

// ---- the clone and the happy path: F5, E19, E21, E83, E92 --------------------------------------------------------------

test('E19, E21, E83, E92: each sample has its own history-free clone with base and plan, the plan files and the toolchain', async () => {
  const ctx = await setup();
  const cli = fakeCli({ per_cwd: { 'toy-plan-s1': [PROBE, GOOD], 'toy-plan-s2': [PROBE, GOOD] } });
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 0, text(res));
  assert.deepEqual(fs.readdirSync(ctx.worktreesRoot).sort(), [rid(1), rid(2)]);
  for (const s of [1, 2]) {
    const clone = cloneOf(ctx, s);
    assert.deepEqual(git(clone, 'log', '--all', '--format=%s').split('\n'), ['plan', 'base']);
    assert.equal(git(clone, 'tag'), '');
    assert.equal(git(clone, 'branch', '-a').split('\n').length, 1);
    assert.equal(fs.readFileSync(path.join(clone, 'docs', 'plan-1.md'), 'utf8'), 'plan');
    assert.ok(fs.existsSync(path.join(clone, 'node_modules', 'pkg', 'index.js')), 'the pristine toolchain is copied in');
    assert.equal(manifestOf(ctx, s).plan_id, 'toy-plan');
    assert.equal(manifestOf(ctx, s).sample, s);
    assert.equal(manifestOf(ctx, s).plan_files['docs/plan-1.md'], fsHash('plan'));
  }
  assert.equal(manifestOf(ctx, 1).flags.includes('outside_clone_access'), false, 'sample 1 and 2 never named each other');
});

test('F5, F7, F11, E49: a green first attempt stops there; the prompt names the plan and the specs; checks are recorded and the verify tree is gone', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 0, text(res));
  const s = stateOf(ctx);
  assert.equal(s.status, 'done');
  assert.equal(s.attempt, 1);
  assert.equal(s.attempt_state, 'done');
  assert.equal(s.attempt2_started, null);
  const [probe, task] = cli.calls();
  assert.equal(probe.prompt, PROBE_PROMPT);
  assert.match(task.prompt, /docs\/plan-1\.md using docs\/spec-1\.md \(impl-task\)/);
  assert.ok(task.prompt.endsWith(COMPLETION_BLOCK));
  assert.ok(task.argv.includes('--effort'), 'the implementer arm runs at low effort');
  assert.equal(cli.calls().length, 2, 'no second attempt after a pass (E49)');
  const c = checkOf(ctx, 1, 1);
  assert.equal(c.green, true, JSON.stringify(c.flags));
  assert.equal(c.shared.CHK1.status, 'pass');
  assert.deepEqual(c.changed_files.sort(), ['src/feature.mjs', 'src/feature.test.mjs']);
  assert.ok(!fs.existsSync(path.join(ctx.expRoot, 'local', 'scratch', `${rid(1)}-a1`)), 'the scratch and the verify tree are deleted');
  assert.ok(!fs.existsSync(checkFile(ctx, 1, 2)));
  assert.equal(manifestOf(ctx).flags.includes('cost_mismatch'), false);
});

test('E24: an unexpected tool in the probe exits 4 before the task prompt', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([{ ...PROBE, init: { tools: ['Bash', 'Mystery'] } }, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 4, text(res));
  assert.equal(cli.calls().length, 1);
  assert.equal(stateOf(ctx).abort_reason, 'isolation_mismatch');
});

// ---- the turn loop: E25 to E30 -------------------------------------------------------------------------------------


test('E25: six questions with max_questions 5 abort turn_cap with 5 counted and answered with the fixed text', async () => {
  const ctx = await setup({ experiment: { ...one, max_questions: 5 } });
  const cli = fakeCli([PROBE, QUESTION, QUESTION, QUESTION, QUESTION, QUESTION, QUESTION, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 6, text(res));
  const s = stateOf(ctx);
  assert.equal(s.abort_reason, 'turn_cap');
  assert.equal(s.plan_gap_questions, 5);
  const prompts = cli.calls().map((c) => c.prompt);
  assert.equal(prompts.filter((p) => p === IMPL_ANSWER).length, 5);
  assert.ok(!fs.existsSync(checkFile(ctx, 1, 1)), 'after turn_cap the checks do not run');
});

test('E26: one question in attempt 1 and four in attempt 2 total five and pass; the next one would abort', async () => {
  const ctx = await setup({ experiment: { ...one, max_questions: 5 } });
  const cli = fakeCli([PROBE, QUESTION, RED, QUESTION, QUESTION, QUESTION, QUESTION, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 0, text(res));
  const s = stateOf(ctx);
  assert.equal(s.plan_gap_questions, 5);
  assert.equal(s.attempt, 2);
  assert.equal(checkOf(ctx, 1, 2).green, true);
  const ctx2 = await setup({ experiment: { ...one, max_questions: 5 } });
  const cli2 = fakeCli([PROBE, QUESTION, RED, QUESTION, QUESTION, QUESTION, QUESTION, QUESTION, GOOD]);
  const res2 = await drive(ctx2, cli2);
  assert.equal(res2.exit, 6);
  assert.equal(stateOf(ctx2).plan_gap_questions, 5);
  assert.equal(stateOf(ctx2).abort_reason, 'turn_cap');
});

test('E27: two empty replies in a row abort turn_cap', async () => {
  const ctx = await setup({ experiment: one });
  const res = await drive(ctx, fakeCli([PROBE, { text: '   ' }, { text: '' }, GOOD]));
  assert.equal(res.exit, 6);
  assert.equal(stateOf(ctx).abort_reason, 'turn_cap');
});

test('E28: a status line is decided by the framework classifier and is not counted as a question', async () => {
  const ctx = await setup({ experiment: one });
  const cli = fakeCli([PROBE, { text: "The reviewer is running. I'll wait for its findings." }, GOOD]);
  const res = await drive(ctx, cli);
  assert.equal(res.exit, 0, text(res));
  assert.equal(stateOf(ctx).plan_gap_questions, 0);
  assert.equal(cli.calls()[2].prompt, 'Continue from where you stopped.');
});

test('E29: the notes give 2 skipped bullets, then the first heading only, then 0 for a missing file', async () => {
  const layouts = [
    [NOTES('## Skipped\n- one\n- two\n\n## Assumptions\n- a\n'), 2],
    [NOTES('## Skipped\n- one\n- two\n\n## Skipped\n- late\n'), 2],
    [GOOD, 0],
  ];
  for (const [step, want] of layouts) {
    const ctx = await setup({ experiment: one });
    const res = await drive(ctx, fakeCli([PROBE, step]));
    assert.equal(res.exit, 0, text(res));
    assert.equal(checkOf(ctx, 1, 1).gates_skipped, want);
  }
});

test('E30: a notes file above 20000 characters is cut for parsing and flags output_truncated on the run without reddening the attempt', async () => {
  const ctx = await setup({ experiment: one });
  const res = await drive(ctx, fakeCli([PROBE, NOTES(`## Skipped\n${'- x\n'.repeat(7000)}`)]));
  assert.equal(res.exit, 0, text(res));
  const c = checkOf(ctx, 1, 1);
  assert.equal(c.notes_truncated, true);
  assert.equal(c.gates_skipped, 50, 'capped at 50');
  assert.ok(manifestOf(ctx).flags.includes('output_truncated'));
  assert.equal(c.green, true);
});

