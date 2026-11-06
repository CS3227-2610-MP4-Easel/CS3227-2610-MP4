import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendQuestion, readQuestions, setIssueIds } from './questions.mjs';
import { runPaths } from './state.mjs';
import { tmpDir } from './testkit.mjs';

const paths = () => runPaths(tmpDir(), 'run-1');
const IDS = ['collision', 'contradiction', 'tenancy'];

test('F11: a stored question has run, turn, text, one source and null issue ids before grading', () => {
  const p = paths();
  appendQuestion(p, { run_id: 'run-1', turn: 2, text: 'Which role may edit?', source: 'sheet' });
  appendQuestion(p, { run_id: 'run-1', turn: 3, text: 'Max length?', source: 'assumption', note: 'ignored_after_done' });
  const rows = readQuestions(p);
  assert.deepEqual(rows[0], { run_id: 'run-1', turn: 2, text: 'Which role may edit?', source: 'sheet', bank_id: null, issue_id: null, issue_alt: null, note: null });
  assert.equal(rows[1].note, 'ignored_after_done');
});

test('an unknown source is refused and nothing is written', () => {
  const p = paths();
  assert.throws(() => appendQuestion(p, { run_id: 'r', turn: 1, text: 'x', source: 'guess' }), /source/);
  assert.deepEqual(readQuestions(p), []);
});

test('E36: question text is sanitized when stored', () => {
  const p = paths();
  appendQuestion(p, { run_id: 'r', turn: 1, text: 'see S:\\repo\\a.txt \u001b[31mnow', source: 'sheet' });
  assert.equal(readQuestions(p)[0].text, 'see <path> now');
});

test('setIssueIds fills issue_id and issue_alt for the named turns only', () => {
  const p = paths();
  appendQuestion(p, { run_id: 'r', turn: 1, text: 'a', source: 'sheet' });
  appendQuestion(p, { run_id: 'r', turn: 2, text: 'b', source: 'assumption' });
  setIssueIds(p, [{ turn: 2, issue_id: 'collision', issue_alt: 'tenancy' }], IDS);
  const rows = readQuestions(p);
  assert.deepEqual([rows[0].issue_id, rows[0].issue_alt], [null, null]);
  assert.deepEqual([rows[1].issue_id, rows[1].issue_alt], ['collision', 'tenancy']);
});

test('setIssueIds rejects an unknown issue id, an unknown turn and equal ids, and writes nothing', () => {
  const p = paths();
  appendQuestion(p, { run_id: 'r', turn: 1, text: 'a', source: 'sheet' });
  assert.throws(() => setIssueIds(p, [{ turn: 1, issue_id: 'ghost' }], IDS), /ghost/);
  assert.throws(() => setIssueIds(p, [{ turn: 9, issue_id: 'collision' }], IDS), /turn 9/);
  assert.throws(() => setIssueIds(p, [{ turn: 1, issue_id: 'collision', issue_alt: 'collision' }], IDS), /differ/);
  assert.throws(() => setIssueIds(p, [{ turn: 1, issue_id: 'collision' }, { turn: 1, issue_id: 'ghost' }], IDS), /ghost/);
  assert.equal(readQuestions(p)[0].issue_id, null);
});

test('status updates logged as questions by older runs are left out of readQuestions but kept by setIssueIds', () => {
  const p = paths();
  appendQuestion(p, { run_id: 'r1', turn: 1, text: 'Which role may edit a note?', source: 'assumption' });
  appendQuestion(p, { run_id: 'r1', turn: 2, text: "The reviewer is running. I'll wait for its findings.", source: 'assumption' });
  assert.equal(readQuestions(p).length, 1);
  assert.equal(readQuestions(p, { includeStatus: true }).length, 2);
  setIssueIds(p, [{ turn: 1, issue_id: 'collision' }], IDS);
  assert.equal(readQuestions(p, { includeStatus: true }).length, 2);
});
