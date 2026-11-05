// F6, E99: one random token written into every committed acceptance file and never shown to an agent. The harness scans
// tool results and the clone for it; a hit means the agent read the checks.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

const COMMENT = /canary:([0-9a-f]{32})/;

/** The token already planted in any of `files`, or null. */
export function findCanary(files) {
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) {
      const m = /"_canary":\s*"([0-9a-f]{32})"/.exec(text);
      if (m) return m[1];
    } else {
      const m = COMMENT.exec(text);
      if (m) return m[1];
    }
  }
  return null;
}

/** Plant one token (an existing one is reused) into each file and return it. Idempotent. */
export function plantCanary(files, token = findCanary(files) ?? randomBytes(16).toString('hex')) {
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) {
      const data = JSON.parse(text);
      const target = Array.isArray(data) ? data[0] : data;
      if (target && typeof target === 'object') target._canary = token;
      fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    } else if (!COMMENT.test(text)) {
      fs.writeFileSync(file, `// canary:${token}\n${text}`);
    }
  }
  return token;
}
