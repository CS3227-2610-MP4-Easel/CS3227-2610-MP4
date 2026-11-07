import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, parseFindings, tally } from './blindreview.mjs';

test('the prompt holds the nonce-delimited material and removes the nonce from it', () => {
  const p = buildPrompt({ brief: 'b NONCE', spec: 's', plan: 'p', nonce: 'NONCE' });
  assert.ok(p.includes('<<MATERIAL-NONCE>>') && p.includes('<<END-MATERIAL-NONCE>>'));
  assert.ok(!p.includes('b NONCE'));
});

test('parseFindings maps unknown labels to other/minor and rejects non-JSON', () => {
  const f = parseFindings('x {"findings":[{"category":"ambiguity","severity":"major","where":"T1","issue":"i"},{"category":"zzz","severity":"huge"}]} y');
  assert.deepEqual(f.map((x) => [x.category, x.severity]), [['ambiguity', 'major'], ['other', 'minor']]);
  assert.equal(parseFindings('no json'), null);
  assert.equal(parseFindings('{"findings":3}'), null);
});

test('tally counts by severity and category', () => {
  const t = tally([{ category: 'test_gap', severity: 'major' }, { category: 'test_gap', severity: 'minor' }]);
  assert.equal(t.total, 2);
  assert.equal(t.severity.major, 1);
  assert.equal(t.category.test_gap, 2);
});
