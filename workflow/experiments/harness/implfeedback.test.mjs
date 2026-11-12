import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildFeedback, restoreFiles } from './implfeedback.mjs';
import { put, tmpDir } from './testkit.mjs';

const CHECKS = [{ id: 'CHK1', required: true, requirement: 'A note can be created.' }, { id: 'CHK2', required: false, requirement: 'Listed newest first.' }, { id: 'CHK4', required: true, requirement: 'At most one note is pinned.' }];
const red = (over = {}) => ({
  typecheck: { errors: 2, status: 'fail', lines: ['src/a.ts(1,1): error TS2322: bad', 'src/b.ts(2,2): error TS2304: worse'] },
  lint: { errors: 0, status: 'ok', lines: [] },
  own_tests: { files: ['tests/n.test.ts'], passed: 1, failed: 1, skipped: 0, failing: [{ id: 'tests/n.test.ts::pins one', lines: ['not ok 2 - pins one', "  error: 'expected 1'"] }] },
  baseline_tests: { newly_failing: ['tests/old.test.ts::a'], missing: ['tests/old.test.ts::b'] },
  shared: { CHK1: { status: 'pass', message: '' }, CHK2: { status: 'fail', message: '' }, CHK4: { status: 'fail', message: 'x' } },
  secret_in_check_output: false, ...over,
});

test('SD4: the exact template, with sections in the fixed order and only the ones that apply', () => {
  const text = buildFeedback({ result: red(), restored: ['tsconfig.json'], checks: CHECKS });
  assert.equal(text, [
    'Your build is not green. Fix these and end with EXP-DONE. Do not ask questions.',
    '',
    'Typecheck errors:',
    'src/a.ts(1,1): error TS2322: bad',
    'src/b.ts(2,2): error TS2304: worse',
    '',
    'Failing tests:',
    '- tests/n.test.ts::pins one',
    '  not ok 2 - pins one',
    "    error: 'expected 1'",
    '',
    'Existing tests that no longer pass:',
    '- tests/old.test.ts::a',
    '- tests/old.test.ts::b',
    '',
    'Required checks that failed:',
    '- At most one note is pinned.',
    '',
    'Restored files:',
    '- tsconfig.json',
  ].join('\n'));
});

test('SD4: a failed informational check, a passed required check and a clean lint add nothing; the check code and message are never shown', () => {
  const text = buildFeedback({ result: red({ typecheck: { errors: 0, status: 'ok', lines: [] }, own_tests: { files: ['t'], passed: 2, failed: 0, skipped: 0, failing: [] }, baseline_tests: { newly_failing: [], missing: [] } }), restored: [], checks: CHECKS });
  assert.ok(!text.includes('Listed newest first'));
  assert.ok(!text.includes('Lint errors'));
  assert.ok(!text.includes('CHK'));
  assert.ok(!text.includes('Restored files'));
  assert.match(text, /Required checks that failed:\n- At most one note is pinned\.$/);
});

test('E52: a credential pattern in the check output replaces every section except Restored files with the fixed line', () => {
  const text = buildFeedback({ result: red({ secret_in_check_output: true, typecheck: { errors: 2, status: 'fail', lines: [] } }), restored: ['tests/old.test.ts'], checks: CHECKS });
  assert.equal(text, [
    'Your build is not green. Fix these and end with EXP-DONE. Do not ask questions.',
    '',
    'The check output could not be shown. Re-read the plan and fix any step that fails.',
    '',
    'Restored files:',
    '- tests/old.test.ts',
  ].join('\n'));
});

test('SD4: the text is cut at 8000 characters with a final [cut] line', () => {
  const lines = Array.from({ length: 400 }, (_, i) => `src/f${i}.ts(1,1): error TS2322: ${'x'.repeat(100)}`);
  const text = buildFeedback({ result: red({ typecheck: { errors: 400, status: 'fail', lines } }), restored: [], checks: CHECKS });
  assert.ok(text.length <= 8000, String(text.length));
  assert.ok(text.endsWith('\n[cut]'));
});

test('E47, E102: restoreFiles writes harness bytes (protected files from the baseline, plan files from the snapshot) and refuses a link', (t) => {
  const baselineTree = tmpDir('exp-base-');
  put(path.join(baselineTree, 'tsconfig.json'), '{"ok":true}\n');
  put(path.join(baselineTree, 'tests', 'old.test.ts'), 'old\n');
  const clone = tmpDir('exp-clone-');
  put(path.join(clone, 'tsconfig.json'), '{"strict":false}\n');
  put(path.join(clone, 'docs', 'plan.md'), 'edited plan\n');
  const planFiles = new Map([['docs/plan.md', Buffer.from('# plan\n')]]);
  const res = restoreFiles({ paths: ['tsconfig.json', 'docs/plan.md', 'tests/old.test.ts'], clone, baselineTree, planFiles });
  assert.deepEqual(res.restored.sort(), ['docs/plan.md', 'tests/old.test.ts', 'tsconfig.json']);
  assert.equal(fs.readFileSync(path.join(clone, 'tsconfig.json'), 'utf8'), '{"ok":true}\n');
  assert.equal(fs.readFileSync(path.join(clone, 'docs', 'plan.md'), 'utf8'), '# plan\n');
  assert.equal(fs.readFileSync(path.join(clone, 'tests', 'old.test.ts'), 'utf8'), 'old\n', 'a deleted protected file is recreated');
  assert.deepEqual(res.refused, []);

  const outside = tmpDir('exp-outside-');
  put(path.join(outside, 'target.txt'), 'operator file');
  const linked = tmpDir('exp-clone-');
  try {
    fs.symlinkSync(path.join(outside, 'target.txt'), path.join(linked, 'tsconfig.json'), 'file');
    fs.symlinkSync(outside, path.join(linked, 'tests'), 'junction');
  } catch (e) { t.diagnostic(`link part skipped: ${e.code}`); return; }
  const bad = restoreFiles({ paths: ['tsconfig.json', 'tests/old.test.ts'], clone: linked, baselineTree, planFiles: new Map() });
  assert.deepEqual(bad.restored, []);
  assert.deepEqual(bad.refused.map((r) => r.path).sort(), ['tests/old.test.ts', 'tsconfig.json']);
  assert.equal(fs.readFileSync(path.join(outside, 'target.txt'), 'utf8'), 'operator file', 'nothing was written through the link');
});
