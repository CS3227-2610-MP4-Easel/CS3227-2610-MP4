// F9, F10, N1, N8: copy a run's transcripts and turn them into events.csv and usage.json. Deterministic and idempotent.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eventCost, runCost } from './pricing.mjs';
import { assignPhases } from './phases.mjs';
import { costClasses, fixIterations, reviewRounds, timeTerms, tokenTerms } from './metrics.mjs';
import { readJson, runPaths, writeAtomic, writeJsonAtomic } from './state.mjs';

export class UsageError extends Error {
  constructor(message) { super(message); this.exit = 2; }
}

export const CSV_COLUMNS = ['run_id', 'seq', 'message_id', 'agent_id', 'parent_id', 'model', 'phase', 'in_tok', 'out_tok', 'cache_read_tok', 'cache_write_tok', 'tools', 'started', 'ended', 'cost_usd'];
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** The CLI names a project folder after the working directory with every non-alphanumeric character as `-`. */
export const encodeProjectDir = (p) => p.replace(/[^A-Za-z0-9]/g, '-');

export function defaultProjectsDir() {
  return path.join(os.homedir(), '.claude', 'projects');
}

/** Main transcript of a session, found in the clone's project folder or, failing that, anywhere under projectsDir. */
export function findMainTranscript(projectsDir, sessionId, clonePath) {
  const direct = path.join(projectsDir, encodeProjectDir(clonePath), `${sessionId}.jsonl`);
  if (fs.existsSync(direct)) return direct;
  if (!fs.existsSync(projectsDir)) return null;
  for (const d of fs.readdirSync(projectsDir)) {
    const f = path.join(projectsDir, d, `${sessionId}.jsonl`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function parseTranscript(file) {
  const raw = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '');
  const lines = [];
  let truncated = false;
  raw.forEach((l, i) => {
    try { lines.push(JSON.parse(l)); } catch { if (i === raw.length - 1) truncated = true; }
  });
  return { lines, truncated };
}

/** One entry per distinct assistant message id (last usage wins), tool calls and results collected. */
function readMessages(lines) {
  const msgs = new Map();
  const results = new Map();
  for (const e of lines) {
    if (e.type === 'user' && Array.isArray(e.message?.content)) {
      for (const c of e.message.content) if (c.type === 'tool_result') results.set(c.tool_use_id, { is_error: c.is_error === true, content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content) });
    }
    if (e.type !== 'assistant' || !e.message?.id) continue;
    const m = msgs.get(e.message.id) ?? { id: e.message.id, model: e.message.model, started: e.timestamp, toolUses: [], usage: null };
    m.usage = e.message.usage ?? m.usage;
    m.ended = e.timestamp;
    m.model = e.message.model ?? m.model;
    for (const c of e.message.content ?? []) if (c.type === 'tool_use' && !m.toolUses.some((t) => t.id === c.id)) m.toolUses.push({ id: c.id, name: c.name, input: c.input });
    msgs.set(e.message.id, m);
  }
  return { msgs: [...msgs.values()], results };
}

const usageFor = (u = {}) => {
  const cc = u.cache_creation;
  const total = u.cache_creation_input_tokens ?? 0;
  return {
    input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cache_read: u.cache_read_input_tokens ?? 0,
    cache_write_5m: cc ? (cc.ephemeral_5m_input_tokens ?? 0) : total, cache_write_1h: cc ? (cc.ephemeral_1h_input_tokens ?? 0) : 0,
  };
};

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function extractRun({ expRoot, runId, pricing, projectsDir = defaultProjectsDir() }) {
  const paths = runPaths(expRoot, runId);
  if (!fs.existsSync(paths.manifest)) throw new UsageError(`run ${runId} does not exist`);
  const manifest = readJson(paths.manifest);
  const state = readJson(paths.state);
  if (!['done', 'aborted', 'extracted'].includes(state.status)) throw new UsageError(`run ${runId} is ${state.status}; extract needs done, aborted or extracted`);
  const arm = readJson(path.join(expRoot, 'arms', `${manifest.arm_id}.json`));
  const warnings = [];
  const flags = new Set(manifest.flags ?? []);

  // transcripts: copy and hash
  const agents = []; // {agent_id, parent_agent_id, agent_type, launched_by, file, lines, truncated}
  const transcripts = [];
  fs.rmSync(paths.transcript, { recursive: true, force: true });
  const mainSrc = state.session_id ? findMainTranscript(projectsDir, state.session_id, manifest.clone_path ?? '') : null;
  if (mainSrc) {
    const dest = path.join(paths.transcript, 'main.jsonl');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(mainSrc, dest);
    transcripts.push({ path: 'main.jsonl', sha256: sha(fs.readFileSync(dest)) });
    agents.push({ agent_id: 'main', parent_agent_id: null, agent_type: null, launched_by: null, ...parseTranscript(dest) });
    const subDir = path.join(path.dirname(mainSrc), state.session_id, 'subagents');
    if (fs.existsSync(subDir)) {
      for (const f of fs.readdirSync(subDir).filter((n) => /^agent-.+\.jsonl$/.test(n)).sort()) {
        const agentId = f.replace(/^agent-/, '').replace(/\.jsonl$/, '');
        const rel = `subagents/${f}`;
        fs.mkdirSync(path.join(paths.transcript, 'subagents'), { recursive: true });
        fs.copyFileSync(path.join(subDir, f), path.join(paths.transcript, rel));
        transcripts.push({ path: rel, sha256: sha(fs.readFileSync(path.join(paths.transcript, rel))) });
        let meta = {};
        const metaSrc = path.join(subDir, f.replace(/\.jsonl$/, '.meta.json'));
        if (fs.existsSync(metaSrc)) {
          fs.copyFileSync(metaSrc, path.join(paths.transcript, rel.replace(/\.jsonl$/, '.meta.json')));
          meta = readJson(metaSrc);
        }
        agents.push({ agent_id: agentId, parent_agent_id: 'main', agent_type: meta.agentType ?? null, launched_by: meta.toolUseId ?? null, ...parseTranscript(path.join(paths.transcript, rel)) });
      }
    }
  } else {
    warnings.push(`no transcript found for session ${state.session_id ?? '(none)'}`);
  }
  if (agents.some((a) => a.truncated)) flags.add('truncated');

  // messages per agent; parent agent = the agent whose transcript made the launching call
  const perAgent = agents.map((a) => ({ a, ...readMessages(a.lines) }));
  const toolOwner = new Map();
  for (const p of perAgent) for (const m of p.msgs) for (const t of m.toolUses) toolOwner.set(t.id, { agent: p.a.agent_id, message: m.id });
  for (const p of perAgent) if (p.a.launched_by && toolOwner.has(p.a.launched_by)) p.a.parent_agent_id = toolOwner.get(p.a.launched_by).agent;

  const phaseMessages = perAgent.flatMap((p) => p.msgs.map((m) => ({
    message_id: `${p.a.agent_id}:${m.id}`, agent_id: p.a.agent_id, parent_agent_id: p.a.parent_agent_id, agent_type: p.a.agent_type, launched_by: p.a.launched_by,
    skills: m.toolUses.filter((t) => t.name === 'Skill').map((t) => t.input?.skill).filter(Boolean), tool_use_ids: m.toolUses.map((t) => t.id),
  })));
  const phases = assignPhases(phaseMessages.map((m) => ({ ...m, launched_by: m.launched_by })), arm.phase_map ?? {});

  // events, ordered by start time then agent then position
  const rows = perAgent.flatMap((p, ai) => p.msgs.map((m, mi) => ({ p, m, ai, mi })))
    .sort((x, y) => (x.m.started ?? '').localeCompare(y.m.started ?? '') || x.ai - y.ai || x.mi - y.mi);
  const unpriced = new Set();
  const events = rows.map(({ p, m }, i) => {
    const u = usageFor(m.usage ?? {});
    const price = pricing.models?.[m.model];
    const cost = price ? eventCost(u, price) : null;
    if (!price) unpriced.add(m.model);
    return {
      run_id: runId, seq: i + 1, message_id: m.id, agent_id: p.a.agent_id, parent_id: p.a.agent_id === 'main' ? '' : p.a.parent_agent_id, model: m.model,
      phase: phases.get(`${p.a.agent_id}:${m.id}`) ?? 'other',
      in_tok: u.input, out_tok: u.output, cache_read_tok: u.cache_read, cache_write_tok: u.cache_write_5m + u.cache_write_1h,
      tools: [...new Set(m.toolUses.map((t) => t.name))].join('|'), started: m.started ?? '', ended: m.ended ?? '', cost_usd: cost,
    };
  });
  const csv = [CSV_COLUMNS.join(',')].concat(events.map((e) => CSV_COLUMNS.map((c) => csvCell(c === 'cost_usd' && e.cost_usd !== null ? e.cost_usd.toFixed(6) : e[c])).join(','))).join('\n');
  writeAtomic(path.join(paths.dir, 'events.csv'), `${csv}\n`);

  // metrics
  const armCost = unpriced.size ? null : runCost(events.map((e) => ({ cost: e.cost_usd })));
  const launches = perAgent.flatMap((p) => (p.a.agent_id === 'main' ? [] : [{ parent_message_id: toolOwner.get(p.a.launched_by)?.message, agent_type: p.a.agent_type }]));
  const review = reviewRounds(launches, arm.review?.agent_types ?? [], arm.review?.max_rounds ?? 0);
  if (review.review_cap_exceeded) flags.add('review_cap_exceeded');
  const bash = perAgent.flatMap((p) => p.msgs.flatMap((m) => m.toolUses.filter((t) => t.name === 'Bash').map((t) => {
    const r = p.results.get(t.id);
    return { command: t.input?.command, failed: !!r && (r.is_error || /^Exit code [1-9]/.test(r.content)) };
  })));
  const time = state.first_prompt_at && state.ended_at
    ? timeTerms({ start: state.first_prompt_at, end: state.ended_at, waits: state.timeline?.waits, answerer: state.timeline?.answerer })
    : null;
  const byPhase = {};
  for (const e of events) {
    const t = byPhase[e.phase] ?? { events: 0, total_tok: 0, cost_usd: 0 };
    t.events += 1;
    t.total_tok += e.in_tok + e.out_tok + e.cache_read_tok + e.cache_write_tok;
    t.cost_usd = Math.round((t.cost_usd + (e.cost_usd ?? 0)) * 1e6) / 1e6;
    byPhase[e.phase] = t;
  }

  // N1: compare with the CLI's own total for the arm session (cumulative over resumes, subagents included)
  const unrounded = events.reduce((s, e) => s + (e.cost_usd ?? 0), 0);
  let reference = null;
  if (state.cli_total_usd != null && armCost !== null) {
    const diff = state.cli_total_usd === 0 ? 0 : Math.abs(unrounded - state.cli_total_usd) / state.cli_total_usd * 100;
    reference = { cli_total_usd: state.cli_total_usd, extracted_usd: Math.round(unrounded * 1e6) / 1e6, diff_pct: Math.round(diff * 100) / 100 };
    if (diff > 2) warnings.push(`extracted cost ${reference.extracted_usd} differs from the CLI total ${state.cli_total_usd} by ${reference.diff_pct}% (limit 2%)`);
  }

  const usage = {
    run_id: runId, events: events.length, ...tokenTerms(events), arm_cost_usd: armCost, unpriced_models: [...unpriced].sort(),
    transcripts, truncated: flags.has('truncated'), reference, time, ...review, fix_iterations: fixIterations(bash), by_phase: byPhase,
    ...costClasses({ armCost, spend: state.spend }),
  };
  writeJsonAtomic(path.join(paths.dir, 'usage.json'), usage);

  state.status = 'extracted';
  manifest.status = 'extracted';
  manifest.flags = [...flags].sort();
  writeJsonAtomic(paths.state, state);
  writeJsonAtomic(paths.manifest, manifest);
  return { usage, warnings, events };
}
