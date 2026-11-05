// Test support: replays a scripted conversation as the Claude CLI would, so no test spends money.
// FAKE_CLAUDE_SCRIPT names a JSON file {steps:[...]}; invocation n uses steps[n] (the last step repeats).
// Step fields: text, usage{input,output,cache_read,cache_write_5m,cache_write_1h}, action
// (normal|crash|hang|budget), init (shallow overrides of the init record), hook_events[{hook_name,hook_event}],
// effects[{op:'append'|'write', path, content}], sleep_ms. Every invocation appends argv, selected env keys and the
// stdin prompt to `<script>.calls.jsonl`; counters live in `<script>.state.json`.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BASELINE_TOOLS, BUILTIN_AGENTS, BUILTIN_PLUGINS, BUILTIN_SKILLS } from '../baseline.mjs';

const scriptFile = process.env.FAKE_CLAUDE_SCRIPT;
const argv = process.argv.slice(2);

if (argv.includes('--version')) {
  console.log('2.1.316 (Claude Code)');
  process.exit(0);
}

const script = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
// per_cwd: {"-r1": [steps], "-r2": [steps]} picks the list whose key the working directory contains.
// Counters live in one state file per list, so parallel runs (one list each) never race on a shared file.
const key = Object.keys(script.per_cwd ?? {}).find((k) => process.cwd().includes(k)) ?? '*';
const list = key === '*' ? script.steps : script.per_cwd[key];
const statePath = `${scriptFile}.state${key === '*' ? '' : `.${key.replace(/[^a-z0-9]/gi, '_')}`}.json`;
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { n: 0, sessions: {} };
const index = state.n;
state.n += 1;
const step = list[Math.min(index, list.length - 1)];
const activity = (o) => fs.appendFileSync(`${scriptFile}.activity.jsonl`, `${JSON.stringify(o)}
`);
activity({ event: 'start', pid: process.pid, t: Date.now(), cwd: process.cwd() });
process.on('exit', () => activity({ event: 'end', pid: process.pid, t: Date.now() }));

const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const all = (name) => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : []));
const prompt = fs.readFileSync(0, 'utf8');
fs.appendFileSync(`${scriptFile}.calls.jsonl`, `${JSON.stringify({ index, argv, env: Object.keys(process.env), prompt, cwd: process.cwd(), pid: process.pid })}\n`);

for (const eff of step.effects ?? []) {
  if (eff.op !== 'spawn') fs.mkdirSync(path.dirname(eff.path), { recursive: true });
  if (eff.op === 'append') fs.appendFileSync(eff.path, eff.content);
  else if (eff.op === 'rm') fs.rmSync(eff.path, { recursive: true, force: true });
  else if (eff.op === 'link') fs.symlinkSync(eff.target, eff.path, 'junction');
  else if (eff.op === 'spawn') {
    // a detached child whose command line holds the working directory (the clone); it outlives this process
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', process.cwd()], { stdio: 'ignore', detached: true, windowsHide: true });
    child.unref();
    fs.appendFileSync(`${scriptFile}.pids`, `${child.pid}\n`);
  } else fs.writeFileSync(eff.path, eff.content);
}

const sessionId = arg('--resume') ?? arg('--session-id') ?? crypto.randomUUID();
const model = arg('--model') ?? 'claude-sonnet-5-5';
const prices = { input: 2, output: 10, cache_read: 0.1, cache_write_5m: 2.5, cache_write_1h: 4 };
const u = { input: 10, output: 20, cache_read: 100, cache_write_5m: 0, cache_write_1h: 50, ...(step.usage ?? {}) };
const costOf = (x) => (x.input * prices.input + x.output * prices.output + x.cache_read * prices.cache_read
  + x.cache_write_5m * prices.cache_write_5m + x.cache_write_1h * prices.cache_write_1h) / 1e6;

const session = state.sessions[sessionId] ?? { input: 0, output: 0, cache_read: 0, cache_write_5m: 0, cache_write_1h: 0 };
const thisCost = costOf(u);
const budget = arg('--max-budget-usd');
const overBudget = step.action === 'budget' || (budget !== undefined && thisCost > Number(budget));
for (const k of Object.keys(session)) session[k] += u[k];
state.sessions[sessionId] = session;
fs.writeFileSync(statePath, JSON.stringify(state));

const jsonMode = arg('--output-format') === 'json';
const out = (o) => { if (!jsonMode || o.type === 'result') process.stdout.write(`${JSON.stringify(o)}\n`); };
for (const h of step.hook_events ?? []) out({ type: 'system', subtype: 'hook_started', ...h, session_id: sessionId });

const plugins = [
  ...BUILTIN_PLUGINS.map((name) => ({ name, path: 'builtin', source: `${name}@builtin` })),
  ...all('--plugin-dir').map((p) => ({ name: p.split(/[\\/]/).pop(), path: p, source: `${p.split(/[\\/]/).pop()}@inline` })),
];
const init = {
  type: 'system', subtype: 'init', cwd: process.cwd(), session_id: sessionId, tools: BASELINE_TOOLS, mcp_servers: [],
  model, permissionMode: arg('--permission-mode') ?? 'default', slash_commands: [], apiKeySource: 'none',
  claude_code_version: '2.1.316', agents: BUILTIN_AGENTS, skills: BUILTIN_SKILLS, plugins, ...(step.init ?? {}),
};
for (const k of step.init_drop ?? []) delete init[k];
out(init);

if (step.sleep_ms) await new Promise((r) => setTimeout(r, step.sleep_ms));
if (step.action === 'hang') {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  fs.appendFileSync(`${scriptFile}.pids`, `${process.pid}\n${child.pid}\n`);
  await new Promise(() => {});
}

const text = step.text ?? 'ok';
const usage = { input_tokens: u.input, output_tokens: u.output, cache_read_input_tokens: u.cache_read, cache_creation_input_tokens: u.cache_write_5m + u.cache_write_1h };
// tool_calls [{name, input}] become tool_use blocks, tool_results [string] one user event of tool_result blocks
const toolBlocks = (step.tool_calls ?? []).map((c, i) => ({ type: 'tool_use', id: `tu_${index}_${i}`, name: c.name, input: c.input }));
out({ type: 'assistant', message: { id: `msg_${sessionId.slice(0, 8)}_${index}`, model, role: 'assistant', content: [...toolBlocks, { type: 'text', text }], usage }, session_id: sessionId });
if (step.tool_results) out({ type: 'user', message: { role: 'user', content: step.tool_results.map((r, i) => ({ type: 'tool_result', tool_use_id: `tu_${index}_${i}`, content: r })) }, session_id: sessionId });

const modelUsage = {
  [model]: {
    inputTokens: session.input, outputTokens: session.output, cacheReadInputTokens: session.cache_read,
    cacheCreationEphemeral5mInputTokens: session.cache_write_5m, cacheCreationEphemeral1hInputTokens: session.cache_write_1h,
    costUSD: costOf(session),
  },
};
const base = { type: 'result', session_id: sessionId, total_cost_usd: step.cli_total ?? costOf(session), modelUsage, num_turns: 1 };
if (step.action === 'crash') {
  out({ ...base, subtype: 'error_during_execution', is_error: true, terminal_reason: 'error', result: step.text });
  process.exit(1);
}
if (overBudget) {
  out({ ...base, subtype: 'error_max_budget_usd', is_error: true, terminal_reason: 'budget_exhausted', errors: [`Reached maximum budget ($${budget})`] });
  process.exit(1);
}
out({ ...base, subtype: 'success', is_error: false, terminal_reason: 'completed', result: text });
