// F4: compare a probe's init record and hook events with the sets an arm should produce (isolation.md,
// runtime.md § Isolation procedure). Built-ins are part of every expected set; hooks are checked from events.
import fs from 'node:fs';
import path from 'node:path';
import { BASELINE_TOOLS, BASELINE_VERSION, BUILTIN_AGENTS, BUILTIN_PLUGINS, BUILTIN_SKILLS } from './baseline.mjs';

const listNames = (dir, filter) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => filter(path.join(dir, n), n)).sort() : []);
const isDir = (p) => fs.statSync(p).isDirectory();

/** What a plugin directory declares: its name, skills, agents and whether it has SessionStart hooks. */
export function describePlugin(dir) {
  let name = path.basename(dir);
  try { name = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).name ?? name; } catch { /* default */ }
  let sessionStartHooks = 0;
  try {
    const hooks = JSON.parse(fs.readFileSync(path.join(dir, 'hooks', 'hooks.json'), 'utf8')).hooks ?? {};
    sessionStartHooks = (hooks.SessionStart ?? []).length;
  } catch { /* no hooks file */ }
  return {
    name,
    skills: listNames(path.join(dir, 'skills'), (p) => isDir(p)),
    agents: listNames(path.join(dir, 'agents'), (p, n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, '')),
    sessionStartHooks,
  };
}

/**
 * Per set: `required` (arm and plugin entries: every one must appear) and `optional` (built-ins of the CLI: feature-gated
 * per account and session, so any of them may be absent, but nothing outside required plus optional may appear).
 */
export function expectedSets(arm, plugins) {
  const denied = new Set(arm.disallowed_tools ?? ['WebFetch', 'WebSearch']);
  return {
    skills: { required: [...(arm.skills ?? []), ...plugins.flatMap((p) => p.skills.map((s) => `${p.name}:${s}`))], optional: BUILTIN_SKILLS },
    agents: { required: [...(arm.agents ?? []), ...plugins.flatMap((p) => p.agents.map((a) => `${p.name}:${a}`))], optional: BUILTIN_AGENTS },
    plugins: { required: plugins.map((p) => p.name), optional: BUILTIN_PLUGINS },
    mcp: { required: [...(arm.mcp ?? [])], optional: [] },
    // allowed_tools are permission rules, not extra tools; denied names are ignored on both sides.
    tools: { required: [], optional: BASELINE_TOOLS.filter((t) => !denied.has(t)) },
  };
}

const REQUIRED = ['skills', 'agents', 'plugins', 'mcp_servers', 'tools'];

export function observedSets(record, arm) {
  const denied = new Set(arm.disallowed_tools ?? ['WebFetch', 'WebSearch']);
  return {
    skills: record.skills, agents: record.agents,
    plugins: record.plugins.map((p) => p.name),
    mcp: record.mcp_servers.map((m) => (typeof m === 'string' ? m : m.name)),
    tools: record.tools.filter((t) => !denied.has(t)),
  };
}

const sorted = (a) => [...new Set(a)].sort();

/**
 * Returns {ok, problems[]}. A problem is {kind: 'gap'|'version'|'mismatch'|'hook', set?, extra?, missing?, hook?}.
 * `hookEvents` are the stream's hook_started events before the init record.
 */
export function checkProbe({ record, hookEvents = [], arm, plugins = [], ignore = [], version = BASELINE_VERSION }) {
  const problems = [];
  for (const key of REQUIRED) if (!Array.isArray(record?.[key])) problems.push({ kind: 'gap', set: key });
  if (problems.length) return { ok: false, problems };
  if (record.claude_code_version !== version) {
    problems.push({ kind: 'version', expected: version, actual: record.claude_code_version });
  }
  const exp = expectedSets(arm, plugins);
  const obs = observedSets(record, arm);
  const skip = new Set(ignore);
  for (const set of Object.keys(exp)) {
    const req = sorted(exp[set].required).filter((n) => !skip.has(n));
    const allowed = new Set([...req, ...exp[set].optional]);
    const o = sorted(obs[set]).filter((n) => !skip.has(n));
    const extra = o.filter((n) => !allowed.has(n));
    const missing = req.filter((n) => !o.includes(n));
    if (extra.length || missing.length) problems.push({ kind: 'mismatch', set, extra, missing });
  }
  const declares = plugins.some((p) => p.sessionStartHooks > 0);
  for (const h of hookEvents) {
    if (h.hook_event !== 'SessionStart' || !declares) problems.push({ kind: 'hook', hook: h.hook_name, event: h.hook_event });
  }
  return { ok: problems.length === 0, problems };
}

export function describeProblems(problems) {
  return problems.map((p) => {
    if (p.kind === 'gap') return `init record has no ${p.set} set`;
    if (p.kind === 'version') return `claude_code_version ${p.actual} differs from the baseline ${p.expected}`;
    if (p.kind === 'hook') return `undeclared hook ${p.hook} (${p.event})`;
    return `${p.set}: extra [${p.extra.join(', ')}] missing [${p.missing.join(', ')}]`;
  });
}

/** First system/init record and the hook_started events that precede it. */
export function probeParts(events) {
  const i = events.findIndex((e) => e.type === 'system' && e.subtype === 'init');
  if (i < 0) return { record: null, hookEvents: [] };
  return { record: events[i], hookEvents: events.slice(0, i).filter((e) => e.type === 'system' && e.subtype === 'hook_started') };
}
