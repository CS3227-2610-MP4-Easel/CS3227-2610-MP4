import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { addEntry, loadBank } from './bank.mjs';
import { runWith as queueCmd } from './commands/queue.mjs';
import { answerItem, enqueue, getItem, listRows, loadItems, logAuto, readAuto, suggestDuplicate } from './queue.mjs';
import { runPaths, writeJsonAtomic } from './state.mjs';
import { fakeCli, tmpDir } from './testkit.mjs';
import { buildEnv } from './spawn.mjs';

/** Two runs of one experiment, each with a status; arm codes as the driver assigns them. */
function setup(statuses = { r1: 'waiting_operator', r2: 'waiting_operator' }) {
  const root = tmpDir();
  const arms = { r1: 'superpowers', r2: 'lite' };
  for (const [id, status] of Object.entries(statuses)) {
    const p = runPaths(root, id);
    writeJsonAtomic(p.manifest, { run_id: id, experiment_id: 'exp', arm_id: arms[id] });
    writeJsonAtomic(p.state, { status });
  }
  writeJsonAtomic(path.join(root, 'local', 'experiments', 'exp', 'state.json'), { arm_codes: { superpowers: 'A', lite: 'B' } });
  return root;
}
const ask = (root, runId, text) => enqueue({ expRoot: root, experimentId: 'exp', runId, text });

test('E34: the same question from two runs at once is one item linked to both; one answer resumes both', () => {
  const root = setup();
  const a = ask(root, 'r1', 'Who may edit a note?');
  const b = ask(root, 'r2', 'who may edit the note');
  assert.equal(a.qid, b.qid);
  assert.equal(loadItems(root).length, 1);
  assert.deepEqual(getItem(root, a.qid).run_ids, ['r1', 'r2']);
  const r = answerItem({ expRoot: root, qid: a.qid, text: 'Only the PM.' });
  assert.deepEqual(r.resumable, ['r1', 'r2']);
  assert.equal(getItem(root, a.qid).bank_id, r.entry.id);
});

test('different questions are different items', () => {
  const root = setup();
  assert.notEqual(ask(root, 'r1', 'Who edits?').qid, ask(root, 'r2', 'Who deletes?').qid);
});

test('E35: an answer for a question whose run aborted is stored and nothing resumes', () => {
  const root = setup({ r1: 'aborted', r2: 'aborted' });
  const item = ask(root, 'r1', 'Who edits?');
  const r = answerItem({ expRoot: root, qid: item.qid, text: 'The PM.' });
  assert.deepEqual(r.resumable, []);
  assert.deepEqual(r.skipped, ['r1']);
  assert.equal(loadBank(root).length, 1);
});

test('a run that already ended is skipped while a waiting one resumes', () => {
  const root = setup({ r1: 'aborted', r2: 'waiting_operator' });
  ask(root, 'r1', 'Who edits?');
  const item = ask(root, 'r2', 'Who edits?');
  const r = answerItem({ expRoot: root, qid: item.qid, text: 'The PM.' });
  assert.deepEqual([r.resumable, r.skipped], [['r2'], ['r1']]);
});

test('E70: --same-as an existing bank id links the item without a new entry, and both runs resume', () => {
  const root = setup();
  const known = addEntry(root, { question: 'Is a note deleted with its epic?', answer: 'Yes.' });
  const item = ask(root, 'r1', 'What happens to notes when an epic is removed?');
  ask(root, 'r2', 'What happens to notes when an epic is removed?');
  const r = answerItem({ expRoot: root, qid: item.qid, sameAs: known.id });
  assert.equal(getItem(root, item.qid).bank_id, known.id);
  assert.equal(loadBank(root).length, 1, 'no new entry');
  assert.deepEqual(r.resumable, ['r1', 'r2']);
});

test('a suggestion is never applied without --same-as', () => {
  const root = setup();
  addEntry(root, { question: 'Is a note deleted with its epic?', answer: 'Yes.' });
  const item = enqueue({ expRoot: root, experimentId: 'exp', runId: 'r1', text: 'What happens to notes when an epic is removed?', suggestedBankId: 'b1' });
  assert.equal(getItem(root, item.qid).suggested_bank_id, 'b1');
  assert.equal(getItem(root, item.qid).bank_id, null);
});

test('a second answer supersedes the first entry', () => {
  const root = setup();
  const item = ask(root, 'r1', 'Who edits?');
  const first = answerItem({ expRoot: root, qid: item.qid, text: 'The PM.' });
  const second = answerItem({ expRoot: root, qid: item.qid, text: 'Everyone.' });
  assert.equal(second.entry.supersedes, first.entry.id);
  assert.equal(getItem(root, item.qid).bank_id, second.entry.id);
});

test('exp queue shows run codes, not arm ids, and the suggestion hint; answered items disappear', () => {
  const root = setup();
  ask(root, 'r1', 'Who edits?');
  const item = enqueue({ expRoot: root, experimentId: 'exp', runId: 'r2', text: 'Who deletes?', suggestedBankId: 'b9' });
  const out = [];
  assert.equal(queueCmd(['--experiment', 'exp'], root, { log: (l) => out.push(l), err: () => {} }), 0);
  const text = out.join('\n');
  assert.match(text, /q1 {2}\[A\]/);
  assert.match(text, /q2 {2}\[B\]/);
  assert.ok(!/superpowers|lite/.test(text), 'arm ids stay hidden');
  assert.match(text, /exp answer q2 --same-as b9/);
  answerItem({ expRoot: root, qid: item.qid, text: 'Nobody.' });
  assert.equal(listRows({ expRoot: root, experimentId: 'exp' }).length, 1);
});

test('exp queue --audit lists automatic matches with both texts', () => {
  const root = setup();
  logAuto(root, { run_id: 'r1', run_code: 'A', question: 'max length of the note', bank_id: 'b1', bank_question: 'Max length of note?' });
  const out = [];
  queueCmd(['--audit'], root, { log: (l) => out.push(l), err: () => {} });
  assert.equal(readAuto(root).length, 1);
  assert.match(out.join('\n'), /max length of the note[\s\S]*Max length of note\?/);
});

test('exp queue rejects unknown options with exit 2', () => {
  assert.equal(queueCmd(['--bogus'], setup(), { log: () => {}, err: () => {} }), 2);
});

test('the duplicate suggestion comes from the model, only names real bank ids, and is never applied', async () => {
  const root = setup();
  addEntry(root, { question: 'Is a note deleted with its epic?', answer: 'Yes.' });
  const bank = loadBank(root);
  const run = async (reply) => {
    const cli = fakeCli([{ text: reply, usage: { output: 20 } }]);
    return suggestDuplicate({ question: 'What happens to notes when an epic is removed?', bank, launcher: cli.launcher, env: buildEnv(process.env, { extra: cli.env }), model: 'm' });
  };
  const hit = await run('{"bank_id": "b1"}');
  assert.equal(hit.bank_id, 'b1');
  assert.ok(hit.cost > 0);
  assert.equal((await run('{"bank_id": "b77"}')).bank_id, null, 'an invented id is dropped');
  assert.equal((await run('{"bank_id": null}')).bank_id, null);
  assert.equal((await run('prose, no json')).bank_id, null);
  assert.equal((await suggestDuplicate({ question: 'x', bank: [], launcher: null, env: {}, model: 'm' })).bank_id, null, 'nothing to compare with: no model call');
});
