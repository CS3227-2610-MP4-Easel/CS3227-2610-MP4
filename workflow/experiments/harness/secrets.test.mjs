import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan, redact, PATTERNS } from './secrets.mjs';

// Built from parts so this file never contains a literal credential.
const positives = {
  'anthropic-key': ['sk-ant-', 'api03-', 'abcdefghij0123456789ABCD'].join(''),
  'aws-access-key': ['AKIA', 'ABCDEFGHIJKLMNOP'].join(''),
  'private-key': ['-----BEGIN ', 'RSA PRIVATE KEY', '-----'].join(''),
  'bearer-token': ['Bearer ', 'abcdefghij0123456789.xyz-_'].join(''),
  'github-token': ['ghp_', 'a'.repeat(30)].join(''),
  'slack-token': ['xoxb-', '1234567890-abcdef'].join(''),
};

test('six credential patterns, one positive each', () => {
  assert.equal(PATTERNS.length, 6);
  for (const [type, sample] of Object.entries(positives)) {
    const hits = scan(`before ${sample} after`);
    assert.deepEqual(hits.map((h) => h.type), [type], type);
  }
});

test('scan reports the type, never the value', () => {
  const hits = scan(positives['github-token']);
  assert.deepEqual(Object.keys(hits[0]), ['type']);
});

test('negatives: a git sha and a base64 image header do not match', () => {
  const sha = 'a3f5c9d8e7b6a5948372615049382716abcdef01';
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgGAWjYBQAAAUAAQ==';
  assert.deepEqual(scan(`commit ${sha} and data:image/png;base64,${png}`), []);
});

test('short lookalikes do not match', () => {
  assert.deepEqual(scan('sk-ant-short Bearer abc ghp_123 AKIA123'), []);
});

test('redact replaces each hit with [REDACTED:type] and leaves the rest', () => {
  const text = `key ${positives['anthropic-key']} and ${positives['aws-access-key']} end`;
  assert.equal(redact(text), 'key [REDACTED:anthropic-key] and [REDACTED:aws-access-key] end');
});

test('redact is stable across repeated calls (no regex lastIndex state)', () => {
  const text = positives['github-token'];
  assert.equal(redact(text), '[REDACTED:github-token]');
  assert.equal(redact(text), '[REDACTED:github-token]');
  assert.equal(scan(text).length, 1);
  assert.equal(scan(text).length, 1);
});
