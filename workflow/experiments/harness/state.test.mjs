import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  approvalHash, approve, buildManifest, changedHashes, computeHashes, faults, isApproved, isTerminal, loadApprovals,
  loadState, newRunState, readJson, runPaths, saveState, writeAtomic,
} from './state.mjs';
import { makeExperimentRepo, put, tmpDir } from './testkit.mjs';

test('E21, N8: a kill during a state.json write leaves the previous valid file', () => {
  const paths = runPaths(tmpDir(), 'run-1');
  const v1 = { ...newRunState(), status: 'running', session_id: 's1' };
  saveState(paths, v1);
  faults.beforeRename = () => { throw new Error('killed'); };
  try {
    assert.throws(() => saveState(paths, { ...v1, status: 'done' }), /killed/);
  } finally {
    faults.beforeRename = null;
  }
  assert.deepEqual(loadState(paths), v1);
  assert.ok(fs.readdirSync(paths.dir).some((f) => f.includes('.tmp-')), 'the half-written temp file is left behind, not loaded');
});

test('a kill while writing the very first file leaves nothing to load, not a corrupt file', () => {
  const file = path.join(tmpDir(), 'x.json');
  faults.beforeRename = () => { throw new Error('killed'); };
  try { assert.throws(() => writeAtomic(file, '{}'), /killed/); } finally { faults.beforeRename = null; }
  assert.equal(fs.existsSync(file), false);
});

test('saveState returns the hash of the written content', () => {
  const paths = runPaths(tmpDir(), 'run-1');
  const state = newRunState();
  const hash = saveState(paths, state);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(saveState(paths, state), hash);
});

test('E20: a reloaded state carries spend and the session id', () => {
  const paths = runPaths(tmpDir(), 'run-1');
  saveState(paths, { ...newRunState(), status: 'running', session_id: '0e1234a8-eaf3-4e5f-a919-bea3da9e2715', turn_state: 'in_turn', spend: { arm: 0.42, answerer: 0, matcher: 0, judge: 0, probe: 0.01 } });
  const s = loadState(paths);
  assert.equal(s.spend.arm, 0.42);
  assert.equal(s.turn_state, 'in_turn');
  assert.equal(s.session_id, '0e1234a8-eaf3-4e5f-a919-bea3da9e2715');
});

test('terminal statuses', () => {
  for (const s of ['done', 'aborted', 'extracted', 'complete']) assert.equal(isTerminal(s), true, s);
  for (const s of ['queued', 'running', 'waiting_operator']) assert.equal(isTerminal(s), false, s);
});

test('N2: the manifest holds every input hash, versions, models and the bank hash', () => {
  const ctx = makeExperimentRepo({ plugin: true });
  const m = buildManifest({ ...ctx, runId: 'r1', experimentId: 'exp-one', taskId: 'task-one', armId: 'arm-one', rep: 1, baseCommit: ctx.sha, cliVersion: '2.1.316' });
  assert.equal(m.base_commit, ctx.sha);
  assert.match(m.experiment_blob, /^[0-9a-f]{40}$/);
  for (const k of ['arm', 'task', 'experiment', 'answer_sheet', 'rubric', 'pricing', 'config', 'prompts', 'harness']) assert.match(m.hashes[k], /^[0-9a-f]{64}$/, k);
  assert.match(m.hashes.plugins.pl, /^[0-9a-f]{64}$/);
  assert.equal(m.versions.cli, '2.1.316');
  assert.ok(m.versions.harness && m.versions.node);
  assert.deepEqual(m.models, { main: 'claude-sonnet-5-5' });
  assert.equal(m.bank_hash, 'none');
  assert.equal(m.schema_version, 1);
});

test('changedHashes names an edited arm, plugin file or config.json (E59)', () => {
  const ctx = makeExperimentRepo({ plugin: true });
  const args = { expRoot: ctx.expRoot, armId: 'arm-one', taskId: 'task-one', experimentId: 'exp-one' };
  const stored = computeHashes(args);
  assert.deepEqual(changedHashes(stored, computeHashes(args)), []);
  fs.appendFileSync(path.join(ctx.expRoot, 'plugins', 'pl', 'skills', 'alpha', 'SKILL.md'), ' edited');
  assert.deepEqual(changedHashes(stored, computeHashes(args)), ['plugin:pl']);
  put(path.join(ctx.expRoot, 'config.json'), { worktrees_root: '../elsewhere', claude_bin: 'claude', auth_mode: 'login', isolation_ignore: [] });
  assert.deepEqual(changedHashes(stored, computeHashes(args)), ['config', 'plugin:pl']);
});

test('E4: the approval hash changes when a file inside a plugin directory changes', () => {
  const ctx = makeExperimentRepo({ plugin: true });
  const before = approvalHash({ expRoot: ctx.expRoot, armId: 'arm-one' });
  assert.equal(approvalHash({ expRoot: ctx.expRoot, armId: 'arm-one' }), before);
  fs.appendFileSync(path.join(ctx.expRoot, 'plugins', 'pl', 'skills', 'alpha', 'SKILL.md'), ' edited');
  assert.notEqual(approvalHash({ expRoot: ctx.expRoot, armId: 'arm-one' }), before);
});

test('E4: approvals are stored per arm outside the repo and survive a reload', () => {
  const dir = tmpDir('exp-approvals-');
  assert.equal(isApproved(dir, 'arm-one', 'abc'), false);
  approve(dir, 'arm-one', 'abc');
  approve(dir, 'arm-one', 'abc');
  assert.equal(isApproved(dir, 'arm-one', 'abc'), true);
  assert.equal(isApproved(dir, 'arm-one', 'zzz'), false);
  assert.equal(isApproved(dir, 'arm-two', 'abc'), false);
  assert.deepEqual(loadApprovals(dir), { 'arm-one': ['abc'] });
  assert.deepEqual(readJson(path.join(dir, 'approvals.json')), { 'arm-one': ['abc'] });
});
