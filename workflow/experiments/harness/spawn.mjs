// Process launching for the harness (N7, F17, F4): native executables only, no shell, argument arrays,
// prompts on stdin, an environment allowlist and a process-tree kill. Also the shared no-tools launch (N4).
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class ConfigError extends Error {
  constructor(message) { super(message); this.exit = 3; }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// ---- launcher -------------------------------------------------------------------------------------------------

const SHELL_EXT = ['.cmd', '.bat', '.ps1'];

/** Resolve `bin` to an absolute native executable; refuse shell launchers (E61). Returns {command, prefix}. */
export function resolveLauncher(bin, { env = process.env, platform = process.platform } = {}) {
  const refuse = (p) => new ConfigError(`launcher ${p} is a shell script, not a native executable (.cmd, .bat and .ps1 are refused)`);
  const hasSep = /[\\/]/.test(bin);
  const candidates = [];
  if (hasSep || path.isAbsolute(bin)) {
    candidates.push(path.resolve(bin));
    if (platform === 'win32' && !path.extname(bin)) candidates.push(path.resolve(`${bin}.exe`));
  } else {
    const dirs = String(env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
    for (const d of dirs) {
      if (platform === 'win32') candidates.push(path.join(d, `${bin}.exe`), path.join(d, `${bin}.cmd`), path.join(d, `${bin}.bat`), path.join(d, `${bin}.ps1`));
      else candidates.push(path.join(d, bin));
    }
  }
  for (const c of candidates) {
    if (!fs.existsSync(c) || fs.statSync(c).isDirectory()) continue;
    if (SHELL_EXT.includes(path.extname(c).toLowerCase())) throw refuse(c);
    return { command: c, prefix: [] };
  }
  if (SHELL_EXT.includes(path.extname(bin).toLowerCase())) throw refuse(bin);
  throw new ConfigError(`claude_bin ${bin} was not found as a native executable`);
}

// ---- environment ----------------------------------------------------------------------------------------------

const ENV_ALLOW = ['PATH', 'SYSTEMROOT', 'USERPROFILE', 'HOME', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA'];
const ENV_ALLOW_PREFIX = ['OTEL_'];
const ENV_ALLOW_EXACT_TELEMETRY = ['CLAUDE_CODE_ENABLE_TELEMETRY'];

/** Child environment: only the allowlist; the API key only in api_key mode (F17, E57). */
export function buildEnv(parentEnv, { authMode = 'login', extra = {} } = {}) {
  const env = {};
  for (const [k, v] of Object.entries(parentEnv)) {
    const up = k.toUpperCase();
    const allowed = ENV_ALLOW.includes(up) || ENV_ALLOW_EXACT_TELEMETRY.includes(up) || ENV_ALLOW_PREFIX.some((p) => up.startsWith(p))
      || (up === 'ANTHROPIC_API_KEY' && authMode === 'api_key');
    if (allowed && v !== undefined) env[k] = v;
  }
  return { ...env, ...extra };
}

// ---- argument lists -------------------------------------------------------------------------------------------

const DEFAULT_DENY = ['WebFetch', 'WebSearch'];
const safeValue = (what, v) => {
  if (typeof v !== 'string' || v === '' || v.startsWith('-')) throw new ConfigError(`${what} must be a non-empty value that does not start with "-"`);
  return v;
};

const EFFORT_LEVELS = ['low', 'medium', 'high'];

/** Argument list of one agent invocation. Isolation flags are identical for first and resumed launches (F4, E58). */
export function claudeArgs({ model, maxBudgetUsd, pluginDirs = [], mcp = [], allowedTools = [], disallowedTools = DEFAULT_DENY, permissionMode, resume, effort }) {
  if (effort !== undefined && !EFFORT_LEVELS.includes(effort)) throw new ConfigError(`effort must be one of ${EFFORT_LEVELS.join(', ')}`);
  if (mcp.length > 0) throw new ConfigError('MCP servers are not supported in v1');
  if (resume !== undefined && !isUuid(resume)) throw new ConfigError('session id is not a UUID');
  const denied = [...new Set([...DEFAULT_DENY.filter((t) => !allowedTools.includes(t)), ...disallowedTools])];
  const args = [
    '-p', '--output-format', 'stream-json', '--verbose', '--include-hook-events',
    '--setting-sources', 'project', '--strict-mcp-config',
    '--model', safeValue('model', model),
    '--max-budget-usd', String(maxBudgetUsd),
  ];
  if (permissionMode) args.push('--permission-mode', safeValue('permission_mode', permissionMode));
  if (effort !== undefined) args.push('--effort', effort);
  if (allowedTools.length) args.push('--allowedTools', allowedTools.join(','));
  if (denied.length) args.push('--disallowedTools', denied.join(','));
  for (const p of pluginDirs) args.push('--plugin-dir', safeValue('plugin path', p));
  if (resume) args.push('--resume', resume);
  return args;
}

/** The flags that fix isolation, for comparing a resumed launch with the first one. */
export function isolationFlags(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--setting-sources') out.push(`--setting-sources=${args[i + 1]}`);
    if (args[i] === '--strict-mcp-config') out.push('--strict-mcp-config');
    if (args[i] === '--mcp-config') out.push(`--mcp-config=${args[i + 1]}`);
    if (args[i] === '--plugin-dir') out.push(`--plugin-dir=${args[i + 1]}`);
  }
  return out.sort();
}

/** Shared by the answerer, matcher and judge (N4): no tools, no settings, no plugins, no MCP, no persistence. */
export function noToolsArgs({ model, maxBudgetUsd }) {
  return [
    '-p', '--output-format', 'json', '--tools', '', '--setting-sources', '', '--strict-mcp-config',
    '--no-session-persistence', '--model', safeValue('model', model), '--max-budget-usd', String(maxBudgetUsd),
  ];
}

export function neutralDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'exp-neutral-'));
}

// ---- running --------------------------------------------------------------------------------------------------

/** Kill a process and everything it started (Windows: taskkill /T /F). */
export function killTree(pid) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
    } else {
      try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ }
      resolve();
    }
  });
}

/**
 * Run `launcher` with `args`, the prompt on stdin. Resolves {code, stdout, stderr, timedOut}.
 * `onSpawn(kill)` hands the caller a function that kills the whole tree (containment aborts).
 */
export function runProcess({ launcher, args, cwd, env, input = '', timeoutMs, onSpawn }) {
  return new Promise((resolve, reject) => {
    const child = spawn(launcher.command, [...launcher.prefix, ...args], {
      cwd, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    const kill = async () => { killed = true; await killTree(child.pid); };
    onSpawn?.(kill);
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; kill(); }, timeoutMs) : null;
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, killed });
    });
    child.stdin.on('error', () => { /* child exited before reading */ });
    child.stdin.end(input);
  });
}

/** Parse stream-json stdout into events, ignoring a truncated last line. */
export function parseStream(stdout) {
  const events = [];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* truncated or non-JSON line */ }
  }
  return events;
}
