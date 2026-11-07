// F11: the question log of one run, `questions.jsonl`. A row is {run_id, turn, text, source, bank_id, issue_id, issue_alt, note}.
import fs from 'node:fs';
import { classifyTurn } from './classify.mjs';
import { sanitizeText } from './sanitize.mjs';
import { writeAtomic } from './state.mjs';

export const SOURCES = ['sheet', 'bank', 'assumption', 'operator'];

/** Append one row; text is sanitized and capped, the source must be known. issue ids start null (set by grading). */
export function appendQuestion(paths, row) {
  if (!SOURCES.includes(row.source)) throw new Error(`unknown question source ${row.source}`);
  fs.mkdirSync(paths.dir, { recursive: true });
  const full = { run_id: row.run_id, turn: row.turn, text: sanitizeText(row.text), source: row.source, bank_id: row.bank_id ?? null, issue_id: null, issue_alt: null, note: row.note ?? null };
  fs.appendFileSync(paths.questions, `${JSON.stringify(full)}\n`);
  return full;
}

/** Rows of the log. Status updates that older runs logged as questions are left out unless includeStatus is true. */
export function readQuestions(paths, { includeStatus = false } = {}) {
  if (!fs.existsSync(paths.questions)) return [];
  const rows = fs.readFileSync(paths.questions, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return includeStatus ? rows : rows.filter((r) => classifyTurn(r.text) !== 'status');
}

/**
 * Fill issue_id and issue_alt after grading. mapping: [{turn, issue_id, issue_alt?}]; every id must be in validIds.
 * Nothing is written when any entry is invalid.
 */
export function setIssueIds(paths, mapping, validIds) {
  const rows = readQuestions(paths, { includeStatus: true });
  const byTurn = new Map(rows.map((r) => [r.turn, r]));
  for (const m of mapping) {
    if (!byTurn.has(m.turn)) throw new Error(`no question at turn ${m.turn}`);
    for (const id of [m.issue_id, m.issue_alt ?? null]) {
      if (id !== null && id !== undefined && !validIds.includes(id)) throw new Error(`unknown seeded issue id ${id}`);
    }
    if (m.issue_alt != null && m.issue_alt === m.issue_id) throw new Error('issue_alt must differ from issue_id');
  }
  for (const m of mapping) {
    const r = byTurn.get(m.turn);
    r.issue_id = m.issue_id ?? null;
    r.issue_alt = m.issue_alt ?? null;
  }
  writeAtomic(paths.questions, rows.map((r) => `${JSON.stringify(r)}\n`).join(''));
}
