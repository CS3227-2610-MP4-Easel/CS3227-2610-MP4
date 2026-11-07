// F8: the answer bank. Append-only entries `local/bank/<id>.json`; a correction is a new entry that supersedes the old one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashTree } from './containment.mjs';

export const MAX_ANSWER_CHARS = 4000;

export class UsageError extends Error {
  constructor(message) { super(message); this.exit = 2; }
}

const DROP = new Set(['a', 'an', 'the']);

/** Case-fold, remove punctuation, drop a/an/the, collapse whitespace. No stemming, no synonyms (runtime.md). */
export function normalizeQuestion(q) {
  return String(q ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !DROP.has(w))
    .join(' ');
}

export const bankDir = (expRoot) => path.join(expRoot, 'local', 'bank');

export function loadBank(expRoot) {
  const dir = bankDir(expRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^b\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

/** Entries that no later entry supersedes. */
export function activeEntries(entries) {
  const superseded = new Set(entries.map((e) => e.supersedes).filter(Boolean));
  return entries.filter((e) => !superseded.has(e.id));
}

/** The active entry whose normalised question equals the normalised input, or null. */
export function findExact(entries, question) {
  const n = normalizeQuestion(question);
  if (!n) return null;
  return activeEntries(entries).filter((e) => normalizeQuestion(e.question) === n).pop() ?? null;
}

/** Validate an operator answer (E37): non-empty, at most 4000 characters. */
export function checkAnswerText(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new UsageError('the answer is empty');
  if (text.length > MAX_ANSWER_CHARS) throw new UsageError(`the answer is ${text.length} characters; the limit is ${MAX_ANSWER_CHARS}`);
}

export function addEntry(expRoot, { question, answer, answeredBy = 'operator', supersedes = null, now = () => new Date() }) {
  checkAnswerText(answer);
  const dir = bankDir(expRoot);
  fs.mkdirSync(dir, { recursive: true });
  for (;;) {
    const next = loadBank(expRoot).reduce((m, e) => Math.max(m, Number(e.id.slice(1))), 0) + 1;
    const entry = { id: `b${next}`, question, answer, answered_by: answeredBy, created: now().toISOString(), supersedes };
    try {
      fs.writeFileSync(path.join(dir, `${entry.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, { flag: 'wx' });
      return entry;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e; // another writer took that id; try the next
    }
  }
}

export const bankHash = (expRoot) => hashTree(bankDir(expRoot)) ?? 'none';

export const randomId = () => crypto.randomBytes(4).toString('hex');
