// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(FE, '../..');
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'test', 'scripts']);

// Blank out comments (keeping newlines so offsets and lines stay aligned) outside string literals.
function strip(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && n === '*') {
      out += '  ';
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < src.length) { out += '  '; i += 2; }
    } else if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { out += src[i++]; }
        if (i < src.length) out += src[i++];
      }
      if (i < src.length) out += src[i++];
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

type Hit = { file: string; line: number; rule: number; text: string };

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function isClient(rel: string, src: string): boolean {
  if (rel === 'src/fe/lib/auth/firebase.ts' || rel === 'src/fe/lib/auth/navigate.ts') return true;
  const first = src.split('\n').find((l) => l.trim() !== '') ?? '';
  return /^(['"])use client\1;?$/.test(first.trim());
}

function resolveSpec(rel: string, spec: string): string | null {
  let target: string;
  if (spec.startsWith('.')) target = path.posix.join(path.posix.dirname(rel), spec);
  else if (spec.startsWith('@/')) target = path.posix.join('src/fe', spec.slice(2));
  else return null;
  return target.replace(/\.(ts|tsx)$/, '');
}

function check(rel: string, src: string): Hit[] {
  const text = strip(src);
  const hits: Hit[] = [];
  const add = (rule: number, index: number, t: string) =>
    hits.push({ file: rel, line: lineOf(text, index), rule, text: t });
  const scan = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    for (const m of text.matchAll(re)) fn(m as RegExpExecArray);
  };

  if (rel !== 'src/fe/lib/auth/firebase.ts') {
    scan(/\b(?:from|import|require)\s*\(?\s*(['"])([^'"]+)\1/g, (m) => {
      if (/^(@firebase\/|firebase($|[/-]))/.test(m[2])) add(1, m.index, m[2]);
    });
  }
  if (rel !== 'src/fe/lib/api/http.ts' && !rel.startsWith('src/fe/app/api/')) {
    scan(/\bfetch\(/g, (m) => add(2, m.index, m[0]));
  }
  if (rel !== 'src/fe/lib/auth/navigate.ts') {
    scan(/location\.assign\(/g, (m) => add(3, m.index, m[0]));
  }
  scan(/dangerouslySetInnerHTML/g, (m) => add(4, m.index, m[0]));

  if (isClient(rel, src)) {
    scan(/process\.env(?!\.NEXT_PUBLIC_FIREBASE_(?:API_KEY|AUTH_DOMAIN|PROJECT_ID|APP_ID)\b)/g, (m) =>
      add(5, m.index, m[0]),
    );
    scan(/\bimport\s*(type\b)?\s*(?:[^'";()]*?\bfrom\s*|\(\s*)?(['"])([^'"]+)\2/g, (m) => {
      if (m[1]) return;
      if (resolveSpec(rel, m[3]) === 'src/fe/lib/auth/mode') add(6, m.index, m[3]);
    });
  }
  return hits;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out);
    } else if (EXT.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

const ruleHits = (rel: string, src: string, rule: number) => check(rel, src).filter((h) => h.rule === rule);

describe('source rules on the real tree', () => {
  it('E83 the six auth rules hold across src/fe', () => {
    const hits = walk(FE).flatMap((abs) => {
      const rel = path.relative(REPO, abs).split(path.sep).join('/');
      return check(rel, readFileSync(abs, 'utf8'));
    });
    const report = hits.map((h) => `rule ${h.rule}: ${h.file}:${h.line} (${h.text})`);
    expect(report).toEqual([]);
  });

  it('E83 .env.example has only empty values', () => {
    const lines = readFileSync(path.join(FE, '.env.example'), 'utf8').split('\n');
    const bad = lines
      .map((l, i) => ({ l: l.trim(), n: i + 1 }))
      .filter(({ l }) => l !== '' && !l.startsWith('#') && !/^[A-Z0-9_]+=$/.test(l));
    expect(bad).toEqual([]);
  });
});

describe('source rules catch breaches', () => {
  const other = 'src/fe/components/x.tsx';

  it('E83 rule 1 catches every firebase import form outside lib/auth/firebase.ts', () => {
    const samples = [
      "import { getAuth } from '@firebase/auth'",
      "import 'firebase/app'",
      "import {\n  getAuth,\n} from '@firebase/auth'",
      "export { x } from '@firebase/app'",
      "require('firebase/app')",
      "await import('@firebase/auth')",
    ];
    for (const s of samples) {
      expect(ruleHits(other, s, 1), s).toHaveLength(1);
      expect(ruleHits('x/lib/auth/firebase.ts', s, 1), s).toHaveLength(1);
      expect(ruleHits('src/fe/lib/auth/firebase.ts', s, 1), s).toHaveLength(0);
    }
  });

  it('E83 rule 1 ignores commented-out imports', () => {
    expect(ruleHits(other, "// import '@firebase/auth'", 1)).toHaveLength(0);
    expect(ruleHits(other, "/* import '@firebase/auth' */", 1)).toHaveLength(0);
    expect(ruleHits(other, "/* a\n import '@firebase/auth'\n */", 1)).toHaveLength(0);
  });

  it('E83 rule 2 catches fetch( but not prefetch( and honours its owners', () => {
    expect(ruleHits(other, 'await fetch(url);', 2)).toHaveLength(1);
    expect(ruleHits(other, 'router.prefetch(url);', 2)).toHaveLength(0);
    expect(ruleHits('src/fe/lib/api/http.ts', 'fetch(url);', 2)).toHaveLength(0);
    expect(ruleHits('src/fe/app/api/a/route.ts', 'fetch(url);', 2)).toHaveLength(0);
  });

  it('E83 rule 3 catches location.assign( outside navigate.ts', () => {
    expect(ruleHits(other, 'window.location.assign(u);', 3)).toHaveLength(1);
    expect(ruleHits('src/fe/lib/auth/navigate.ts', 'window.location.assign(u);', 3)).toHaveLength(0);
  });

  it('E83 rule 4 catches dangerouslySetInnerHTML', () => {
    expect(ruleHits(other, '<div dangerouslySetInnerHTML={{ __html: x }} />', 4)).toHaveLength(1);
  });

  it('E83 rule 5 catches non-public env use in client files only', () => {
    expect(ruleHits(other, "'use client';\nconst k = process.env.SECRET;", 5)).toHaveLength(1);
    expect(ruleHits(other, "'use client';\nconst k = process.env[name];", 5)).toHaveLength(1);
    expect(ruleHits(other, "'use client';\nconst k = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;", 5)).toHaveLength(0);
    expect(ruleHits(other, 'const k = process.env.SECRET;', 5)).toHaveLength(0);
  });

  it('E83 rule 6 catches a non-type import of lib/auth/mode in a client file', () => {
    const f = 'src/fe/lib/auth/x.tsx';
    expect(ruleHits(f, "'use client';\nimport { authMode } from './mode';", 6)).toHaveLength(1);
    expect(ruleHits(f, "'use client';\nimport { type AuthMode } from './mode.ts';", 6)).toHaveLength(1);
    expect(ruleHits('src/fe/components/y.tsx', "\"use client\";\nimport { authMode } from '../lib/auth/mode';", 6)).toHaveLength(1);
    expect(ruleHits(f, "'use client';\nimport type { AuthMode } from './mode';", 6)).toHaveLength(0);
    expect(ruleHits(f, "import { authMode } from './mode';", 6)).toHaveLength(0);
  });
});
