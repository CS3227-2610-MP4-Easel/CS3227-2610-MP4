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

// Status updates (found in the pilot: a turn ended to wait for a subagent and was counted as a question).
const statusMessages = [
  "The reviewer is running. I'll wait for its findings before editing the spec and starting the plan, so the plan is written against the revised spec.",
  "The spec-writer is still running. I'll wait for its completion notice before starting the review.",
  "The spec-writer has resumed on the remaining fixes. I'll lint and spot-check the files once it reports back.",
];
for (const [i, text] of statusMessages.entries()) {
  test(`status update ${i + 1} is not a question`, () => {
    assert.equal(classifyTurn(text), 'status');
  });
}

test('real questions without a question mark stay questions', () => {
  assert.equal(classifyTurn("Before I write anything, your request collides with recorded decisions. Under AGENTS.md § 4, I'm stopping here and nothing has been written. Please answer each point below. 1. Keep C8 or reverse it."), 'question');
  assert.equal(classifyTurn("I'm holding, and nothing has been written. The AD-09 question is still open after ten requests. Keep: I log the feature as deferred. Reverse: I record the reversal. ".repeat(2)), 'question');
});

test('a short message with a question mark is a question even when it mentions waiting', () => {
  assert.equal(classifyTurn('Should I wait for the reviewer?'), 'question');
});

test('a message over 300 characters is never a status update', () => {
  assert.equal(classifyTurn(`The reviewer is running. I'll wait for its findings. ${'x '.repeat(150)}`), 'question');
});

test('a status line followed by the marker is done', () => {
  assert.equal(classifyTurn("I'll wait for the reviewer.\nEXP-DONE"), 'done');
});
