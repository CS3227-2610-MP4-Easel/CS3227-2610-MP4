import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { planPathOf, snapshotPathProblem, snapshotRun } from './snapshot.mjs';
import { put, sha256, tmpDir } from './testkit.mjs';

const RUN = '20261103-114628-pilot-pinned-note-lite-r2';
const SPEC = 'workflow/specs/x-design.md';
const PLAN = 'workflow/plans/x.md';

/** A throwaway expRoot holding one source run. `over` edits the manifest; `files` maps `spec/<path>` or `plan/<path>` to text. */
function makeRun({ status = 'complete', flags = [], files, cost = 1.7406, runId = RUN, arm = 'lite', rep = 2 } = {}) {
  const expRoot = tmpDir('exp-snap-');
  const dir = path.join(expRoot, 'local', 'runs', runId);
  put(path.join(dir, 'manifest.json'), { run_id: runId, experiment_id: 'pilot-001', task_id: 'pilot-pinned-note', arm_id: arm, rep, status, flags });
  put(path.join(dir, 'state.json'), { status });
  put(path.join(dir, 'usage.json'), { run_id: runId, arm_cost_usd: cost });
  const list = files ?? { [`spec/${SPEC}`]: '# spec\n', [`plan/${PLAN}`]: '# plan\n' };
  for (const [rel, text] of Object.entries(list)) put(path.join(dir, 'artifacts', rel), text);
  return { expRoot, dir };
}
const plansDir = (expRoot) => path.join(expRoot, 'local', 'plans');
const nothingWritten = (expRoot) => !fs.existsSync(plansDir(expRoot)) || fs.readdirSync(plansDir(expRoot), { recursive: true }).length === 0;
const out = (res) => res.lines.join('\n');
const snap = (expRoot, opts = {}) => snapshotRun({ expRoot, runId: RUN, ...opts });

test('F1: a complete run is copied with kind, sha256, source run, arm, replicate and plan cost', () => {
  const { expRoot } = makeRun();
  const res = snap(expRoot);
  assert.equal(res.code, 0, out(res));
  const dest = path.join(plansDir(expRoot), 'pilot-001', 'lite-r2');
  const s = JSON.parse(fs.readFileSync(path.join(dest, 'snapshot.json'), 'utf8'));
  assert.equal(s.plan_id, 'lite-r2');
  assert.equal(s.source_run_id, RUN);
  assert.equal(s.source_experiment_id, 'pilot-001');
  assert.equal(s.arm_id, 'lite');
  assert.equal(s.rep, 2);
  assert.equal(s.plan_cost_usd, 1.7406);
  assert.deepEqual(s.files, [
    { path: SPEC, kind: 'spec', sha256: sha256('# spec\n') },
    { path: PLAN, kind: 'plan', sha256: sha256('# plan\n') },
  ]);
  assert.equal(fs.readFileSync(path.join(dest, 'files', PLAN), 'utf8'), '# plan\n');
  assert.equal(res.planId, 'lite-r2');
  assert.equal(res.snapshotSha256, sha256(fs.readFileSync(path.join(dest, 'snapshot.json'))));
  assert.match(out(res), new RegExp(`lite-r2 ${res.snapshotSha256}`));
  assert.deepEqual(fs.readdirSync(path.join(plansDir(expRoot), 'pilot-001')), ['lite-r2'], 'no temp folder is left behind');
});

test('E1: a run that is not complete, or unknown, exits 2 naming the run and its status, and writes nothing', () => {
  const extracted = makeRun({ status: 'extracted' });
  const res = snap(extracted.expRoot);
  assert.equal(res.code, 2);
  assert.match(out(res), new RegExp(`${RUN}.*extracted`));
  assert.ok(nothingWritten(extracted.expRoot));
  const unknown = snapshotRun({ expRoot: extracted.expRoot, runId: 'no-such-run' });
  assert.equal(unknown.code, 2);
  assert.match(out(unknown), /no-such-run/);
});

test('E2: a spec without a plan, missing_artifact or cost_mismatch exits 2 and writes nothing', () => {
  const noPlan = makeRun({ files: { [`spec/${SPEC}`]: 'spec' } });
  assert.equal(snap(noPlan.expRoot).code, 2);
  assert.ok(nothingWritten(noPlan.expRoot));
  for (const flag of ['missing_artifact', 'cost_mismatch']) {
    const r = makeRun({ flags: [flag] });
    const res = snap(r.expRoot);
    assert.equal(res.code, 2, flag);
    assert.match(out(res), new RegExp(flag));
    assert.ok(nothingWritten(r.expRoot));
  }
  const graded = makeRun();
  put(path.join(graded.dir, 'grades.json'), { flags: ['cost_mismatch'] });
  assert.equal(snap(graded.expRoot).code, 2, 'a flag recorded only in grades.json counts');
});

test('E3: an existing snapshot with another hash is left untouched (exit 2); an identical one is accepted', () => {
  const { expRoot, dir } = makeRun();
  assert.equal(snap(expRoot).code, 0);
  const file = path.join(plansDir(expRoot), 'pilot-001', 'lite-r2', 'snapshot.json');
  const before = fs.readFileSync(file);
  assert.equal(snap(expRoot).code, 0, 'the same plan again is not a change');
  put(path.join(dir, 'artifacts', 'plan', PLAN), '# plan, edited\n');
  const res = snap(expRoot);
  assert.equal(res.code, 2);
  assert.match(out(res), /lite-r2/);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('E4: a key pattern in a plan file exits 9, names the type and never the value, and writes nothing', () => {
  const key = `sk-ant-${'a1B2c3D4e5'.repeat(3)}`;
  const { expRoot } = makeRun({ files: { [`spec/${SPEC}`]: 'spec', [`plan/${PLAN}`]: `token ${key}\n` } });
  const res = snap(expRoot);
  assert.equal(res.code, 9);
  assert.match(out(res), /anthropic-key/);
  assert.ok(!out(res).includes(key));
  assert.ok(nothingWritten(expRoot));
});

test('E5: absolute, drive-letter, .., colon, device-name and odd paths are refused', () => {
  for (const bad of ['/etc/passwd', 'C:/x/a.md', 'C:x.md', 'a/../b.md', '../b.md', 'a/b:stream.md', 'docs/aux.md', 'docs/CON', 'docs/com1.txt', 'docs/Nul.md', 'a\\b.md', 'a/b.md.', 'a b&c.md', '']) {
    assert.ok(snapshotPathProblem(bad), `should refuse ${JSON.stringify(bad)}`);
  }
  for (const good of ['workflow/plans/2026-11-03-x.md', 'a/b_c-d.1.md', 'docs/console.md']) {
    assert.equal(snapshotPathProblem(good), null, good);
  }
});

test('E5: a symlink in the artifact folder is refused (exit 2, nothing written)', (t) => {
  const { expRoot, dir } = makeRun();
  const target = path.join(dir, 'outside.md');
  fs.writeFileSync(target, 'secret');
  try {
    fs.symlinkSync(target, path.join(dir, 'artifacts', 'plan', 'workflow', 'plans', 'link.md'), 'file');
  } catch (e) {
    t.skip(`this machine cannot create a symlink here (${e.code})`);
    return;
  }
  const res = snap(expRoot);
  assert.equal(res.code, 2);
  assert.match(out(res), /link\.md.*symlink|symlink.*link\.md/);
  assert.ok(nothingWritten(expRoot));
});

test('E6: curl, ~/.ssh and a 300-character base64 line exit 2 with file and line; --accept-findings writes and keeps the hits', () => {
  const plan = ['# plan', 'run curl http://x to fetch', 'copy ~/.ssh/id', 'A'.repeat(300), 'see %USERPROFILE%', 'go ..\\up', 'wget y', 'Invoke-WebRequest z'].join('\n');
  const { expRoot } = makeRun({ files: { [`spec/${SPEC}`]: 'spec', [`plan/${PLAN}`]: plan } });
  const res = snap(expRoot);
  assert.equal(res.code, 2);
  const text = out(res);
  for (const line of [2, 3, 4, 5, 6, 7, 8]) assert.match(text, new RegExp(`${PLAN}:${line}\\b`), `line ${line}`);
  assert.ok(nothingWritten(expRoot));
  const accepted = snap(expRoot, { acceptFindings: true });
  assert.equal(accepted.code, 0, out(accepted));
  assert.match(out(accepted), new RegExp(`${PLAN}:2`), 'the hits stay in the output');
  assert.ok(fs.existsSync(path.join(plansDir(expRoot), 'pilot-001', 'lite-r2', 'snapshot.json')));
});

test('E6: ordinary prose raises no finding', () => {
  const { expRoot } = makeRun({ files: { [`spec/${SPEC}`]: 'The note is pinned. Use a relative path src/a.ts and 12345.', [`plan/${PLAN}`]: '# plan\nStep 1: run the tests.\n' } });
  const res = snap(expRoot);
  assert.equal(res.code, 0, out(res));
  assert.deepEqual(res.hits, []);
});

test('E7: files keep their order and plan_path is the first plan-kind file', () => {
  const { expRoot } = makeRun({ files: {
    [`spec/${SPEC}`]: 'spec',
    'plan/workflow/plans/b-second.md': 'b',
    'plan/workflow/plans/a-first.md': 'a',
  } });
  assert.equal(snap(expRoot).code, 0);
  const s = JSON.parse(fs.readFileSync(path.join(plansDir(expRoot), 'pilot-001', 'lite-r2', 'snapshot.json'), 'utf8'));
  assert.deepEqual(s.files.map((f) => f.path), [SPEC, 'workflow/plans/a-first.md', 'workflow/plans/b-second.md']);
  assert.equal(planPathOf(s), 'workflow/plans/a-first.md');
});
