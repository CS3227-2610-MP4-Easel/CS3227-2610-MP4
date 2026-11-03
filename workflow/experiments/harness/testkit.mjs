// Test support (not a test): temp dirs, a scripted fake CLI launcher and a recorded-call reader.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FAKE_CLAUDE = path.join(here, 'fixtures', 'fake-claude.mjs');

export const tmpDir = (prefix = 'exp-test-') => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/** Writes the script and returns a launcher object for runProcess/driver plus helpers to read the recorded calls. */
export function fakeCli(steps, dir = tmpDir('exp-fake-')) {
  const scriptFile = path.join(dir, 'script.json');
  fs.writeFileSync(scriptFile, JSON.stringify({ steps }));
  return {
    dir,
    scriptFile,
    launcher: { command: process.execPath, prefix: [FAKE_CLAUDE] },
    env: { FAKE_CLAUDE_SCRIPT: scriptFile },
    calls: () => {
      const f = `${scriptFile}.calls.jsonl`;
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
    pids: () => {
      const f = `${scriptFile}.pids`;
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(Number) : [];
    },
  };
}

export function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
