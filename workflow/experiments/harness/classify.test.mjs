import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTurn, hasQuestionBeforeDone } from './classify.mjs';

// The six fixtures of F5, in the order of the requirement.
const fixtures = {
  done: ['Spec and plan written.\nEXP-DONE', 'done'],
  'marker-quoted-mid-text': ['I will finish with EXP-DONE soon', 'question'], // E14
  'question-then-marker-last-line': ['Should notes be editable by everyone?\nEXP-DONE', 'done'], // E15
  'marker-then-question-last-line': ['EXP-DONE\nShould notes be editable by everyone?', 'question'], // E15
  question: ['Which role may edit a note?', 'question'],
  blank: ['   \n\t\n', 'empty'],
};

for (const [name, [text, expected]] of Object.entries(fixtures)) {
  test(`F5 fixture ${name} -> ${expected}`, () => {
    assert.equal(classifyTurn(text), expected);
  });
}

test('trailing whitespace and CRLF around the marker still count', () => {
  assert.equal(classifyTurn('ok\r\n  EXP-DONE  \r\n\r\n'), 'done');
});

test('the marker is case-sensitive', () => {
  assert.equal(classifyTurn('exp-done'), 'question');
});

test('E15: a question before a final marker is flagged for the note ignored_after_done', () => {
  assert.equal(hasQuestionBeforeDone('Should notes be editable?\nEXP-DONE'), true);
  assert.equal(hasQuestionBeforeDone('All written.\nEXP-DONE'), false);
  assert.equal(hasQuestionBeforeDone('Should notes be editable?'), false);
});

test('null and undefined are empty', () => {
  assert.equal(classifyTurn(undefined), 'empty');
  assert.equal(classifyTurn(null), 'empty');
});
