// Screens may only reach data through lib/api. Fixtures and the store are private to it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const skip = new Set(['node_modules', '.next', 'scripts']);
const bad = [];

function walk(dir) {
  for (const f of readdirSync(dir)) {
    if (skip.has(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f)) check(p);
  }
}

function check(p) {
  const rel = relative(root, p).split(sep).join('/');
  if (rel.startsWith('lib/api/')) return;
  readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    if (/from\s+['"][^'"]*\/api\/(fixtures|store)['"]/.test(line)) bad.push(`${rel}:${i + 1}  ${line.trim()}`);
  });
}

walk(root);
if (bad.length) {
  console.error('Import data through lib/api, not its fixtures or store:\n' + bad.join('\n'));
  process.exit(1);
}
console.log('data layer: ok');
