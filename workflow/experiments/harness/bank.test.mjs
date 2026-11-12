import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_ANSWER_CHARS, UsageError, activeEntries, addEntry, bankDir, findExact, loadBank, normalizeQuestion } from './bank.mjs';
import { runWith as answerCmd } from './commands/answer.mjs';
import { enqueue } from './queue.mjs';
import { tmpDir } from './testkit.mjs';

const same = (a, b) => normalizeQuestion(a) === normalizeQuestion(b);
const quiet = { log: () => {}, err: () => {} };

test('E33: the pair table of F8', () => {
  assert.equal(same('Max length of note?', 'max length of the note'), true);
  assert.equal(same('Can the PM edit?', 'Can the Dev Lead edit?'), false);
  assert.equal(same('Is the note required?', 'Is the note not required?'), false);
  assert.equal(same('Is a note deleted with its epic?', 'What happens to notes when an epic is removed?'), false);
});

test('normalisation: case-fold, punctuation, a/an/the, whitespace; nothing else', () => {
  assert.equal(normalizeQuestion('  The   Max,  LENGTH -- of a note?! '), 'max length of note');
  assert.equal(normalizeQuestion('notes'), 'notes');
  assert.notEqual(normalizeQuestion('note'), normalizeQuestion('notes'), 'no stemming');
  assert.equal(normalizeQuestion(''), '');
});

test('entries are append-only, numbered, and a correction supersedes without editing the old file', () => {
  const root = tmpDir();
  const a = addEntry(root, { question: 'Who edits?', answer: 'The PM.' });
  const b = addEntry(root, { question: 'Who edits?', answer: 'Everyone.', supersedes: a.id });
  assert.deepEqual([a.id, b.id], ['b1', 'b2']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(bankDir(root), 'b1.json'), 'utf8')).answer, 'The PM.');
  assert.deepEqual(activeEntries(loadBank(root)).map((e) => e.id), ['b2']);
  assert.equal(findExact(loadBank(root), 'who edits').answer, 'Everyone.');
});

test('findExact returns null for a question with no normalised match, and for an empty question', () => {
  const root = tmpDir();
  addEntry(root, { question: 'Who edits?', answer: 'The PM.' });
  assert.equal(findExact(loadBank(root), 'Who deletes?'), null);
  assert.equal(findExact(loadBank(root), '???'), null);
});

test('E37: empty text and 4001 characters are refused and nothing is stored', () => {
  const root = tmpDir();
  assert.throws(() => addEntry(root, { question: 'q', answer: '' }), UsageError);
  assert.throws(() => addEntry(root, { question: 'q', answer: '   ' }), UsageError);
  assert.throws(() => addEntry(root, { question: 'q', answer: 'x'.repeat(MAX_ANSWER_CHARS + 1) }), UsageError);
  assert.equal(loadBank(root).length, 0);
  assert.equal(addEntry(root, { question: 'q', answer: 'x'.repeat(MAX_ANSWER_CHARS) }).id, 'b1');
});

test('E37: exp answer with empty text, 4001 characters or an unknown id exits 2 and stores nothing', () => {
  const root = tmpDir();
  const item = enqueue({ expRoot: root, experimentId: 'e', runId: 'r1', text: 'Who edits?' });
  assert.equal(answerCmd([item.qid, ''], root, quiet), 2);
  assert.equal(answerCmd([item.qid, 'x'.repeat(4001)], root, quiet), 2);
  assert.equal(answerCmd(['q99', 'text'], root, quiet), 2);
  assert.equal(answerCmd([item.qid, '--same-as', 'b99'], root, quiet), 2);
  assert.equal(answerCmd([], root, quiet), 2);
  assert.equal(loadBank(root).length, 0);
  assert.equal(answerCmd([item.qid, 'The PM.'], root, quiet), 0);
  assert.equal(loadBank(root).length, 1);
});

test('exp answer reads text from --file and --stdin, trimming one trailing newline', () => {
  const root = tmpDir();
  const i1 = enqueue({ expRoot: root, experimentId: 'e', runId: 'r1', text: 'one?' });
  const i2 = enqueue({ expRoot: root, experimentId: 'e', runId: 'r1', text: 'two?' });
  const f = path.join(tmpDir(), 'a.txt');
  fs.writeFileSync(f, 'from file\r\n');
  assert.equal(answerCmd([i1.qid, '--file', f], root, quiet), 0);
  assert.equal(answerCmd([i2.qid, '--stdin'], root, { ...quiet, readStdin: () => 'from stdin\n' }), 0);
  assert.deepEqual(loadBank(root).map((e) => e.answer), ['from file', 'from stdin']);
});

test('the answer text is never logged by exp answer', () => {
  const root = tmpDir();
  const lines = [];
  const item = enqueue({ expRoot: root, experimentId: 'e', runId: 'r1', text: 'one?' });
  answerCmd([item.qid, 'a very private answer'], root, { log: (l) => lines.push(l), err: (l) => lines.push(l) });
  assert.ok(lines.length === 1 && !lines[0].includes('private'));
});
