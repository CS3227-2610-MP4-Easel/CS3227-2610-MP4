import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { findCanary, plantCanary } from './canary.mjs';
import { put, tmpDir } from './testkit.mjs';

const files = () => {
  const dir = tmpDir('exp-canary-');
  const f = { js: path.join(dir, 'a.mjs'), json: path.join(dir, 'checks.json'), obj: path.join(dir, 'c.json'), ts: path.join(dir, 'b.ts') };
  put(f.js, 'export const x = 1;\n');
  put(f.json, [{ id: 'CHK1', required: true, requirement: 'r' }]);
  put(f.obj, { a: 1 });
  put(f.ts, 'export const y = 2;\n');
  return f;
};

test('plantCanary writes one token as a comment into code files and a _canary field into JSON, and findCanary returns it', () => {
  const f = files();
  assert.equal(findCanary(Object.values(f)), null);
  const token = plantCanary(Object.values(f));
  assert.match(token, /^[0-9a-f]{32}$/);
  assert.match(fs.readFileSync(f.js, 'utf8'), new RegExp(`^// canary:${token}\n`));
  assert.match(fs.readFileSync(f.ts, 'utf8'), new RegExp(`// canary:${token}`));
  assert.equal(JSON.parse(fs.readFileSync(f.obj, 'utf8'))._canary, token);
  assert.equal(JSON.parse(fs.readFileSync(f.json, 'utf8'))[0]._canary, token);
  assert.equal(findCanary(Object.values(f)), token);
  assert.equal(findCanary([f.js]), token);
  assert.equal(findCanary([f.obj]), token);
});

test('a second plant keeps the same token and does not add a second marker', () => {
  const f = files();
  const first = plantCanary(Object.values(f));
  const second = plantCanary(Object.values(f));
  assert.equal(second, first);
  assert.equal((fs.readFileSync(f.js, 'utf8').match(/canary:/g) ?? []).length, 1);
});

test('the planted code still runs and the planted JSON still parses', async () => {
  const f = files();
  plantCanary(Object.values(f));
  const mod = await import(pathToFileURL(f.js).href);
  assert.equal(mod.x, 1);
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(f.json, 'utf8')));
});
