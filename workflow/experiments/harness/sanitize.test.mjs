import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TEXT, sanitizeText } from './sanitize.mjs';

test('E36: ANSI escapes and control characters are removed, newlines and tabs kept', () => {
  const dirty = '\u001b[31mred\u001b[0m \u001b]0;title\u0007text\u0000\u0007\u001b[2J line\nsecond\tcol\r\nthird';
  assert.equal(sanitizeText(dirty), 'red text line\nsecond\tcol\nthird');
});

test('E36: text is capped at 2000 characters', () => {
  assert.equal(sanitizeText('x'.repeat(5000)).length, MAX_TEXT);
  assert.equal(MAX_TEXT, 2000);
  assert.equal(sanitizeText('short'), 'short');
});

test('E36: Windows, UNC and POSIX paths become <path>', () => {
  assert.equal(sanitizeText('see S:\\repo\\a.txt now'), 'see <path> now');
  assert.equal(sanitizeText('at \\\\host\\share\\x ok'), 'at <path> ok');
  assert.equal(sanitizeText('in /home/u/proj/f and more'), 'in <path> and more');
});

test('a single-segment slash, a URL and plain prose are left alone', () => {
  assert.equal(sanitizeText('use and/or, a/b is fine'), 'use and/or, a/b is fine');
  assert.equal(sanitizeText('see https://example.com/docs/page please'), 'see https://example.com/docs/page please');
  assert.equal(sanitizeText('/ alone'), '/ alone');
});

test('E36: a credential becomes [REDACTED:type] before anything else sees it', () => {
  const key = ['sk-ant-', 'api03-', 'abcdefghij0123456789ABCD'].join('');
  assert.equal(sanitizeText(`my key ${key} end`), 'my key [REDACTED:anthropic-key] end');
});

test('a key inside a path is still redacted and the path replaced', () => {
  const key = ['ghp_', 'a'.repeat(30)].join('');
  assert.equal(sanitizeText(`/home/u/${key}/x`), '<path>');
});

test('null and undefined give an empty string', () => {
  assert.equal(sanitizeText(null), '');
  assert.equal(sanitizeText(undefined), '');
});
