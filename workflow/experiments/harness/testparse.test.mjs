import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countTsErrors, parseTap } from './testparse.mjs';

// Real output of `node --test --test-reporter=tap` for nested describe/it, a skip, a todo and a failure.
const TAP = `TAP version 13
# Subtest: suite A
    # Subtest: inner one
    ok 1 - inner one
      ---
      duration_ms: 1.3
      type: 'test'
      ...
    # Subtest: inner two
    not ok 2 - inner two
      ---
      duration_ms: 0.3
      type: 'test'
      error: 'boom'
      stack: |-
        TestContext.<anonymous> (n.test.mjs:2:86)
      ...
    # Subtest: skipped one
    ok 3 - skipped one # SKIP
      ---
      type: 'test'
      ...
    # Subtest: deep
        # Subtest: leaf
        ok 1 - leaf
          ---
          type: 'test'
          ...
        1..1
    ok 4 - deep
      ---
      type: 'suite'
      ...
    1..4
not ok 1 - suite A
  ---
  type: 'suite'
  failureType: 'subtestsFailed'
  ...
# Subtest: top
    # Subtest: sub
    ok 1 - sub
      ---
      type: 'test'
      ...
    1..1
ok 2 - top
  ---
  type: 'test'
  ...
# Subtest: todo one
ok 3 - todo one # TODO
  ---
  type: 'test'
  ...
1..3
# tests 6
# pass 3
`;

test('ids follow file::enclosing > test; parents are not counted as tests', () => {
  const r = parseTap(TAP, 'a.test.ts');
  assert.deepEqual(r.map((t) => [t.id, t.result]), [
    ['a.test.ts::suite A > inner one', 'passed'],
    ['a.test.ts::suite A > inner two', 'failed'],
    ['a.test.ts::suite A > skipped one', 'skipped'],
    ['a.test.ts::suite A > deep > leaf', 'passed'],
    ['a.test.ts::top > sub', 'passed'],
    ['a.test.ts::todo one', 'skipped'],
  ]);
});

test('a failing test carries its output lines, at most 20', () => {
  const r = parseTap(TAP, 'a.test.ts').find((t) => t.result === 'failed');
  assert.ok(r.lines.some((l) => l.includes("error: 'boom'")));
  const long = `TAP version 13\nnot ok 1 - big\n  ---\n${Array.from({ length: 60 }, (_, i) => `  line ${i}`).join('\n')}\n  ...\n`;
  assert.equal(parseTap(long, 'f')[0].lines.length, 20);
});

test('E48: a file that prints nothing and exits non-zero is one failed test <file>::load; exit 0 gives no tests', () => {
  assert.deepEqual(parseTap('SyntaxError: nope\n', 'b.test.ts', { exitCode: 1 }).map((t) => [t.id, t.result]), [['b.test.ts::load', 'failed']]);
  assert.deepEqual(parseTap('', 'b.test.ts', { exitCode: 0 }), []);
});

test('E48: duplicate names in one file get #2, #3 in output order', () => {
  const dup = 'TAP version 13\nok 1 - same\nok 2 - same\nnot ok 3 - same\n';
  assert.deepEqual(parseTap(dup, 'c.test.ts').map((t) => [t.id, t.result]), [
    ['c.test.ts::same', 'passed'], ['c.test.ts::same#2', 'passed'], ['c.test.ts::same#3', 'failed'],
  ]);
});

test('a failing parent with no failing child is kept as a failure; summary lines are ignored', () => {
  const t = 'TAP version 13\n# Subtest: p\n    # Subtest: c\n    ok 1 - c\n    1..1\nnot ok 1 - p\n# tests 2\n# fail 1\n';
  assert.deepEqual(parseTap(t, 'd').map((x) => [x.id, x.result]), [['d::p > c', 'passed'], ['d::p', 'failed']]);
});

test('E48: countTsErrors counts lines that match error TS<digits>', () => {
  const out = [
    "src/a.ts(1,10): error TS2305: Module has no exported member 'X'.",
    'src/b.ts(3,1): error TS7006: Parameter implicitly has an any type.',
    'Found 2 errors.',
    '  error TS1 appears in the middle of a line but starts none',
    'error TS999 text',
    'no error here: TS2305',
  ].join('\n');
  assert.equal(countTsErrors(out), 4);
  assert.equal(countTsErrors(''), 0);
});
