// The six credential patterns of runtime.md § Credential patterns. Hits report a type, never the value.
export const PATTERNS = [
  { type: 'anthropic-key', source: 'sk-ant-[A-Za-z0-9_-]{20,}' },
  { type: 'aws-access-key', source: 'AKIA[0-9A-Z]{16}' },
  { type: 'private-key', source: '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  { type: 'bearer-token', source: 'Bearer [A-Za-z0-9._-]{20,}' },
  { type: 'github-token', source: 'ghp_[A-Za-z0-9]{30,}' },
  { type: 'slack-token', source: 'xox[abp]-[A-Za-z0-9-]{10,}' },
];

// Fresh RegExp per call: a shared /g regex keeps lastIndex between calls.
const fresh = (p) => new RegExp(p.source, 'g');

export function scan(text) {
  const hits = [];
  for (const p of PATTERNS) {
    for (const _ of String(text).matchAll(fresh(p))) hits.push({ type: p.type });
  }
  return hits;
}

export function redact(text) {
  return PATTERNS.reduce((t, p) => t.replace(fresh(p), `[REDACTED:${p.type}]`), String(text));
}
