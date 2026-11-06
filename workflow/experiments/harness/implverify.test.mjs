import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runShared } from './implverify.mjs';
import { adherence } from './implchecks.mjs';

const task = { checks: { shared: { argv: ['node', 'workflow/x/runner.mjs'], timeout_s: 5 } } };
const ids = ['CHK1', 'CHK2'];
const call = (run) => runShared({ task, repoRoot: '/repo', dir: '/tree', adapterPath: '/tree/a.mjs', checksPath: '/c.json', ids, env: {}, run });
const out = (stdout, extra = {}) => async () => ({ code: 0, stdout, stderr: '', timedOut: false, truncated: false, killed: false, error: null, ...extra });

test('runShared resolves the runner against the repo root, passes --adapter --checks --root, and parses the last stdout line', async () => {
  let seen;
  const res = await call(async (o) => { seen = o; return { code: 0, stdout: 'noise\n{"CHK1":{"status":"pass","message":"ok"},"CHK2":{"status":"fail","message":"x"}}\n', stderr: '' }; });
  assert.equal(seen.argv[0], 'node');
  assert.match(seen.argv[1].replace(/\\/g, '/'), /\/repo\/workflow\/x\/runner\.mjs$/);
  assert.deepEqual(seen.argv.slice(2), ['--adapter', '/tree/a.mjs', '--checks', '/c.json', '--root', '/tree']);
  assert.equal(seen.cwd, '/tree');
  assert.deepEqual(res.shared, { CHK1: { status: 'pass', message: 'ok' }, CHK2: { status: 'fail', message: 'x' } });
  assert.deepEqual(res.flags, []);
});

test('E55: unparseable output, an early exit, a timeout and a missing id make the ids error and set adapter_error', async () => {
  for (const run of [out('not json'), out('', { error: 'ENOENT' }), out('', { timedOut: true }), out('{"CHK1":{"status":"pass","message":""}}')]) {
    const res = await call(run);
    assert.ok(res.flags.includes('adapter_error'));
    assert.ok(Object.values(res.shared).some((v) => v.status === 'error'));
  }
  assert.equal((await call(out('', { timedOut: true }))).flags.includes('check_timeout'), true);
  assert.equal((await call(out('{"CHK1":{"status":"pass","message":""}}'))).shared.CHK1.status, 'pass');
});

test('E54: module missing is an error for the check but not an adapter_error; messages are cut at 300 characters', async () => {
  const res = await call(out(JSON.stringify({ CHK1: { status: 'error', message: 'module missing' }, CHK2: { status: 'fail', message: 'y'.repeat(900) } })));
  assert.equal(res.shared.CHK1.status, 'error');
  assert.equal(res.shared.CHK2.message.length, 300);
  assert.deepEqual(res.flags, []);
});

test('E29: only bullets under the first ## Skipped heading count', () => {
  const m = (notesText) => adherence({ changed: [], cloneFiles: [], planFiles: [], notesText, planTexts: [] }).gates_skipped;
  assert.equal(m('## Skipped\n- a\n- b\n## Assumptions\n- c\n'), 2);
  assert.equal(m('## Skipped\n- a\n- b\n## Skipped\n- late\n'), 2);
  assert.equal(m(null), 0);
});
