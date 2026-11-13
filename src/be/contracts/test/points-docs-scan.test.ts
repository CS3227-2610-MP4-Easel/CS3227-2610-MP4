import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const ignored = new Set(['node_modules', 'dist', '.next', 'test', 'tests']);

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : files(path);
    return entry.isFile() ? [path] : [];
  }))).flat();
}

test('W7c E7 old points scale is confined to the superseded decision', async () => {
  const paths = (await Promise.all(['src', 'docs'].map((dir) => files(join(root, dir))))).flat();
  const hits: string[] = [];
  for (const path of paths) {
    const name = relative(root, path).replaceAll('\\', '/');
    if (name === 'src/be/db/prisma/seed.ts') continue;
    let content = await readFile(path, 'utf8');
    if (name === 'docs/architecture/decision-log.md') {
      content = content.replace(/### AD-12\b[\s\S]*?(?=^### |$(?![\s\S]))/m, '');
    }
    if (/\b1\W{1,5}2\W{1,5}3\W{1,5}5\W{1,5}8\W{1,5}13\b|literal\(13\)/.test(content)) hits.push(name);
  }
  assert.deepEqual(hits, []);
});
