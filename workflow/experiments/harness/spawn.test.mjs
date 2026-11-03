import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ConfigError, buildEnv, claudeArgs, isolationFlags, noToolsArgs, parseStream, resolveLauncher, runProcess,
} from './spawn.mjs';
import { fakeCli, pidAlive, tmpDir } from './testkit.mjs';

const UUID = '0e1234a8-eaf3-4e5f-a919-bea3da9e2715';

test('E57: the child environment holds exactly the allowlist', () => {
  const parent = {
    PATH: 'p', SystemRoot: 'C:\\Windows', USERPROFILE: 'u', TEMP: 't', TMP: 't', APPDATA: 'a', LOCALAPPDATA: 'l',
    CLAUDE_CODE_ENABLE_TELEMETRY: '1', OTEL_METRICS_EXPORTER: 'console',
    ANTHROPIC_API_KEY: 'k', GITHUB_TOKEN: 'g', AWS_SECRET_ACCESS_KEY: 's', SECRET_THING: 'x', HOME: 'h',
  };
  const login = buildEnv(parent, { authMode: 'login' });
  assert.deepEqual(Object.keys(login).sort(), [
    'APPDATA', 'CLAUDE_CODE_ENABLE_TELEMETRY', 'HOME', 'LOCALAPPDATA', 'OTEL_METRICS_EXPORTER', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE',
  ]);
  assert.ok(!('ANTHROPIC_API_KEY' in login));
  assert.equal(buildEnv(parent, { authMode: 'api_key' }).ANTHROPIC_API_KEY, 'k');
});

test('E57: the deny flags for WebFetch and WebSearch are present unless the arm lists the tool', () => {
  const args = claudeArgs({ model: 'm', maxBudgetUsd: 1 });
  assert.equal(args[args.indexOf('--disallowedTools') + 1], 'WebFetch,WebSearch');
  const allowed = claudeArgs({ model: 'm', maxBudgetUsd: 1, allowedTools: ['WebSearch', 'Read'], disallowedTools: [] });
  assert.equal(allowed[allowed.indexOf('--disallowedTools') + 1], 'WebFetch');
});

test('F4: every launch carries the isolation flags, with one --plugin-dir per plugin', () => {
  const args = claudeArgs({ model: 'm', maxBudgetUsd: 1, pluginDirs: ['/p/a', '/p/b'] });
  assert.equal(args[args.indexOf('--setting-sources') + 1], 'project');
  assert.ok(args.includes('--strict-mcp-config'));
  assert.deepEqual(isolationFlags(args), ['--plugin-dir=/p/a', '--plugin-dir=/p/b', '--setting-sources=project', '--strict-mcp-config']);
});

test('E58: a resumed launch has the same isolation flags as the first', () => {
  const first = claudeArgs({ model: 'm', maxBudgetUsd: 1, pluginDirs: ['/p/a'] });
  const resumed = claudeArgs({ model: 'm', maxBudgetUsd: 0.5, pluginDirs: ['/p/a'], resume: UUID });
  assert.deepEqual(isolationFlags(resumed), isolationFlags(first));
  assert.equal(resumed[resumed.indexOf('--resume') + 1], UUID);
});

test('E59: a session id that is not a UUID never reaches argv', () => {
  assert.throws(() => claudeArgs({ model: 'm', maxBudgetUsd: 1, resume: '--dangerously-skip-permissions' }), ConfigError);
  assert.throws(() => claudeArgs({ model: '--dangerously-skip-permissions', maxBudgetUsd: 1 }), ConfigError);
  assert.throws(() => claudeArgs({ model: 'm', maxBudgetUsd: 1, pluginDirs: ['--bad'] }), ConfigError);
});

test('N4: the no-tools launch has no tools, settings, persistence or plugins, and no --resume', () => {
  const args = noToolsArgs({ model: 'm', maxBudgetUsd: 0.2 });
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.equal(args[args.indexOf('--setting-sources') + 1], '');
  assert.ok(args.includes('--strict-mcp-config') && args.includes('--no-session-persistence'));
  assert.ok(!args.includes('--plugin-dir') && !args.includes('--resume') && !args.includes('--allowedTools'));
});

test('E61: .cmd, .bat and .ps1 launchers are refused, naming the launcher', () => {
  const dir = tmpDir();
  for (const ext of ['.cmd', '.bat', '.ps1']) {
    const file = path.join(dir, `claude${ext}`);
    fs.writeFileSync(file, 'echo hi');
    assert.throws(() => resolveLauncher(file), (e) => e instanceof ConfigError && e.exit === 3 && e.message.includes(`claude${ext}`));
  }
});

test('E61: a bare name found on PATH only as a .cmd shim is refused (win32 rules)', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'claude.cmd'), 'echo hi');
  assert.throws(() => resolveLauncher('claude', { env: { PATH: dir }, platform: 'win32' }), /claude\.cmd/);
});

test('a native executable resolves to an absolute path without a prefix', () => {
  const l = resolveLauncher(process.execPath);
  assert.equal(l.command, process.execPath);
  assert.deepEqual(l.prefix, []);
});

test('N7: & | ^ " % in every argv value reach the child unchanged, and the prompt arrives on stdin', async () => {
  const hostile = 'a&b|c^d"e%f';
  const cli = fakeCli([{ text: 'ok' }]);
  const args = [
    '-p', '--model', hostile, '--session-id', `x${hostile}`, '--plugin-dir', `C:\\p ath\\${hostile}`, '--resume', `run-${hostile}-r1`,
  ];
  const prompt = `question with ${hostile} and "quotes"\nsecond line`;
  const res = await runProcess({ launcher: cli.launcher, args, cwd: cli.dir, env: { ...process.env, ...cli.env }, input: prompt });
  assert.equal(res.code, 0, res.stderr);
  const call = cli.calls()[0];
  assert.deepEqual(call.argv, args);
  assert.equal(call.prompt, prompt);
});

test('an empty-string argument survives (used by --tools "")', async () => {
  const cli = fakeCli([{}]);
  const args = noToolsArgs({ model: 'm', maxBudgetUsd: 0.1 });
  await runProcess({ launcher: cli.launcher, args, cwd: cli.dir, env: { ...process.env, ...cli.env } });
  assert.deepEqual(cli.calls()[0].argv, args);
});

test('a hung child and its grandchild are killed at the timeout', async () => {
  const cli = fakeCli([{ action: 'hang' }]);
  const res = await runProcess({ launcher: cli.launcher, args: ['-p'], cwd: cli.dir, env: { ...process.env, ...cli.env }, timeoutMs: 1500 });
  assert.equal(res.timedOut, true);
  await new Promise((r) => setTimeout(r, 300));
  const pids = cli.pids();
  assert.ok(pids.length >= 2, 'fake recorded child and grandchild');
  for (const pid of pids) assert.equal(pidAlive(pid), false, `pid ${pid} still alive`);
});

test('parseStream skips a truncated last line', () => {
  const events = parseStream('{"type":"a"}\n{"type":"b"}\n{"type":"res');
  assert.deepEqual(events.map((e) => e.type), ['a', 'b']);
});
