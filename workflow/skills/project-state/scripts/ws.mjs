#!/usr/bin/env node
// ws: deterministic workflow helper. Node standard library only; no model calls.
// Usage: node ws.mjs <command> [args]   (run from the project root)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const MIN_NODE = 18;
const WORKFLOW = 'workflow';
const cfg = readJson(path.join(WORKFLOW, 'config.json')) || {};
const STATE_DIR = cfg.state_dir || path.join(WORKFLOW, 'project-state');
const STATUSES = ['Not started', "Spec'd", 'Planned', 'Building', 'Blocked — needs human', 'In review', 'Done', 'Abandoned'];
const BUDGETS = [ // soft targets in bytes; reported, never enforced
  ['AGENTS.md', 3072], [`${STATE_DIR}/STATE.md`, 8192], [`${STATE_DIR}/guardrails.md`, 2048],
];
const BRANCH_STATE_BUDGET = 8192;

const [cmd, ...args] = process.argv.slice(2);
const commands = { init, doctor, budget, pack, status, changes, task, hook, infra, test, adapters, 'verify-scope': verifyScope, decision, lesson, fold, skills, drift, 'guide-targets': guideTargets };
if (!commands[cmd]) {
  console.log('ws <init|doctor|budget|pack <role> [--area A] [--id C1] [--cat]|status <W> <status>|changes [slug]|task start|done [T]|infra ...|test [component]|adapters claude|codex|verify-scope <role>|decision new|show|supersede|lesson new|graduate|fold <slug>|skills sync|check|drift|guide-targets <paths...>>');
  process.exit(cmd ? 1 : 0);
}

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function git(...a) { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } }
function slug() { return git('branch', '--show-current').replace(/\//g, '-'); }
function branchStatePath(s = slug()) { return path.join(STATE_DIR, 'branch-states', `${s}.md`); }
function flag(a, name) { const i = a.indexOf(name); return i < 0 ? null : (a[i + 1] ?? true); }

function doctor() {
  const major = +process.versions.node.split('.')[0];
  console.log(`node ${process.versions.node} ${major >= MIN_NODE ? 'ok' : `TOO OLD (need ${MIN_NODE}+)`}`);
  console.log(`git ${git('--version') || 'MISSING'}`);
  console.log(`state tree ${fs.existsSync(path.join(STATE_DIR, 'STATE.md')) ? 'found' : 'MISSING (see project-state bootstrapping.md)'}`);
  console.log(`hooks ${git('config', 'core.hooksPath') || 'not installed (run: ws init)'}`);
}

function init() {
  for (const d of ['architecture', 'conventions', 'decisions', 'deviations', 'ledger', 'branch-states/archive'])
    fs.mkdirSync(path.join(STATE_DIR, d), { recursive: true });
  const hooks = '.githooks';
  fs.mkdirSync(hooks, { recursive: true });
  const ws = path.relative('.', new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).replace(/\\/g, '/');
  for (const h of ['prepare-commit-msg', 'commit-msg'])
    fs.writeFileSync(path.join(hooks, h), `#!/bin/sh\ncommand -v node >/dev/null 2>&1 || exit 0\nnode "${ws}" hook ${h} "$1"\nexit 0\n`, { mode: 0o755 });
  git('config', 'core.hooksPath', hooks);
  fs.appendFileSync('.gitignore', fs.existsSync('.gitignore') && /^\.ws\/?$/m.test(read('.gitignore')) ? '' : '\n.ws/\n');
  console.log(`state tree ensured; hooks installed in ${hooks} (core.hooksPath set)`);
}

function budget() {
  const over = [];
  const files = [...BUDGETS];
  const bs = path.join(STATE_DIR, 'branch-states');
  if (fs.existsSync(bs)) for (const f of fs.readdirSync(bs)) if (f.endsWith('.md')) files.push([path.join(bs, f), BRANCH_STATE_BUDGET]);
  for (const [f, max] of files) {
    if (!fs.existsSync(f)) continue;
    const size = fs.statSync(f).size;
    const flagged = size > max;
    if (flagged) over.push(f);
    console.log(`${flagged ? 'OVER' : 'ok  '} ${String(size).padStart(6)} / ${String(max).padEnd(6)} ${f}`);
  }
  if (over.length) console.log(`\nSoft targets only. Move finished entries out of the index/hot file into their cold files: ${over.join(', ')}`);
}

function pack([role, ...a]) {
  const manifest = readJson(path.join(WORKFLOW, 'manifest.json'));
  if (!role || !manifest?.roles?.[role]) { console.error(`unknown role; manifest roles: ${Object.keys(manifest?.roles || {}).join(', ') || '(no manifest.json)'}`); process.exit(1); }
  const spec = manifest.roles[role];
  const list = [...(spec.files || [])];
  if (spec.branchState) list.push(branchStatePath());
  const area = flag(a, '--area'), id = flag(a, '--id');
  if (area && spec.byArea) list.push(`${STATE_DIR}/architecture/${area}.md`, `${STATE_DIR}/conventions/${area}.md`);
  if (id) list.push(`${STATE_DIR}/decisions/${id}.md`, `${STATE_DIR}/deviations/${id}.md`);
  const lessonsDir = path.join(STATE_DIR, 'lessons');
  if (fs.existsSync(lessonsDir)) for (const lf of fs.readdirSync(lessonsDir)) { const lt = read(path.join(lessonsDir, lf)) || ''; const sc = /\*\*Scope:\*\*\s*(\S+)/.exec(lt)?.[1]; if (!/graduated/.test(lt) && (sc === 'project' || sc === 'role:' + role)) list.push(path.join(lessonsDir, lf)); }
  const seen = new Set(); let total = 0; const out = [];
  for (const f of list.map(f => f.replace('{state}', STATE_DIR))) {
    if (seen.has(f) || !fs.existsSync(f)) continue; seen.add(f);
    const size = fs.statSync(f).size; total += size; out.push(f);
    console.log(`${String(size).padStart(7)}  ${f}`);
  }
  console.log(`${String(total).padStart(7)}  total bytes (~${Math.round(total / 4)} tokens)`);
  if (flag(a, '--cat')) for (const f of out) console.log(`\n===== ${f} =====\n${read(f)}`);
}

function status([ws, ...rest]) {
  const value = rest.join(' ');
  if (!ws || !STATUSES.includes(value)) { console.error(`status must be one of: ${STATUSES.join(' | ')}`); process.exit(1); }
  const file = fs.existsSync(branchStatePath()) ? branchStatePath() : path.join(STATE_DIR, 'STATE.md');
  const lines = read(file)?.split('\n');
  if (!lines) { console.error(`no ${file}`); process.exit(1); }
  const i = lines.findIndex(l => l.startsWith(`| ${ws} |`));
  if (i < 0) { console.error(`workstream ${ws} not found in ${file}`); process.exit(1); }
  const cells = lines[i].split('|'); // ['', ID, Workstream, Status, ...]
  cells[3] = ` ${value} `;
  lines[i] = cells.join('|');
  fs.writeFileSync(file, lines.join('\n'));
  console.log(`${ws} -> ${value} in ${file}`);
}

function changes([s]) {
  s = s || slug();
  const bsFile = branchStatePath(s);
  const base = /\*\*Base:\*\*\s*`?([0-9a-f]{7,40})`?/.exec(read(bsFile) || '')?.[1];
  const range = base && git('cat-file', '-t', base) === 'commit' ? `${base}..HEAD` : `${cfg.int_branch || 'development'}..HEAD`;
  const log = git('log', '--reverse', '--format=%h%x1f%ad%x1f%s%x1f%b%x1e', '--date=short', range);
  console.log('| Date | What changed | Workstream | Ref |\n|---|---|---|---|');
  for (const rec of log.split('\x1e').map(r => r.trim()).filter(Boolean)) {
    const [h, d, subj, body = ''] = rec.split('\x1f');
    const w = /^Workstream:\s*(.+)$/m.exec(body)?.[1] || '—';
    const t = /^Task:\s*(.+)$/m.exec(body)?.[1];
    console.log(`| ${d} | ${subj}${t ? ` (${t})` : ''}${/^Workstream:/m.test(body) ? '' : ' [no trailer]'} | ${w} | \`${h}\` |`);
  }
}

function task([sub, id]) {
  const f = path.join('.ws', 'current-task');
  if (sub === 'start' && id) { fs.mkdirSync('.ws', { recursive: true }); fs.writeFileSync(f, id); console.log(`task ${id} started`); }
  else if (sub === 'done') { fs.rmSync(f, { force: true }); console.log('task cleared'); }
  else { console.error('ws task start <T> | ws task done'); process.exit(1); }
}

function hook([name, msgFile]) {
  if (!msgFile) return;
  const msg = read(msgFile) || '';
  if (/^(Merge|Revert|fixup!|squash!)/.test(msg)) return;
  if (name === 'prepare-commit-msg') {
    if (/^Workstream:/m.test(msg) && /^Task:/m.test(msg)) return;
    const add = [];
    const bs = read(branchStatePath()) || '';
    const rows = [...bs.matchAll(/^\| (W~?\d+) \|[^|]*\| (Building|Planned|Spec'd) \|/gm)];
    if (!/^Workstream:/m.test(msg) && rows.length === 1) add.push(`Workstream: ${rows[0][1]}`);
    const t = read(path.join('.ws', 'current-task'));
    if (!/^Task:/m.test(msg) && t) add.push(`Task: ${t.trim()}`);
    if (add.length) fs.writeFileSync(msgFile, msg.replace(/\n*$/, '\n\n') + add.join('\n') + '\n');
  } else if (name === 'commit-msg') { // advisory only: never rejects
    const subj = msg.split('\n')[0];
    if (!/^[a-z]+(\([^)]*\))?: .+/.test(subj)) console.error('ws: subject is not "type: what and why"');
    if (/\b[WCDQ]~\d+\b/.test(msg)) console.error('ws: provisional ID in commit message; cite a permanent ID or describe it');
    if (!/^Workstream:/m.test(msg)) console.error('ws: no Workstream: trailer (fine for one-off small changes)');
  }
}

// ---- shared test infrastructure (infra.json) and quiet runner ----
function sh(command, opts = {}) { return execFileSync(process.platform === 'win32' ? 'cmd' : 'sh', process.platform === 'win32' ? ['/c', command] : ['-c', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }); }
function tryRun(command) { try { return { ok: true, out: sh(command) }; } catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` }; } }

function infra([sub, name]) {
  const conf = readJson(path.join(WORKFLOW, 'infra.json'));
  if (!conf) { console.error('no workflow/infra.json (see project-state/templates/infra-template.json)'); process.exit(1); }
  const tree = slug() || 'main';
  if (sub === 'status') {
    for (const [n, s] of Object.entries(conf.services || {})) {
      const r = tryRun(`docker inspect -f "{{.State.Running}}" ${s.container || 'ws-' + n}`);
      console.log(`${n}: ${r.ok && r.out.trim() === 'true' ? 'running' : 'stopped'} (port ${s.port})`);
    }
  } else if (sub === 'ensure') {
    for (const [n, s] of Object.entries(conf.services || {})) {
      const c = s.container || 'ws-' + n;
      if (tryRun(`docker inspect -f "{{.State.Running}}" ${c}`).out.trim() === 'true') { console.log(`${n}: already running`); continue; }
      tryRun(`docker rm -f ${c}`);
      const env = Object.entries(s.env || {}).map(([k, v]) => `-e ${k}=${v}`).join(' ');
      const r = tryRun(`docker run -d --name ${c} -p ${s.port}:${s.containerPort || s.port} ${env} ${s.image}`);
      if (!r.ok) { console.error(`${n}: failed to start\n${r.out}`); process.exit(1); }
      for (let i = 0; i < 30; i++) { if (tryRun(`docker exec ${c} ${s.health}`).ok) break; sh(process.platform === 'win32' ? 'ping -n 2 127.0.0.1 >nul' : 'sleep 1'); }
      console.log(`${n}: started`);
    }
    for (const [n, d] of Object.entries(conf.databases || {})) ensureTemplate(conf, n, d);
  } else if (sub === 'db' && name) {
    const d = Object.values(conf.databases || {})[0]; const svc = conf.services[d.service];
    const target = `test_${tree}_${name}`.replace(/[^A-Za-z0-9_]/g, '_');
    const c = svc.container || 'ws-' + d.service;
    tryRun(`docker exec ${c} psql -U ${d.user || 'postgres'} -c "DROP DATABASE IF EXISTS ${target}"`);
    const r = tryRun(`docker exec ${c} psql -U ${d.user || 'postgres'} -c "CREATE DATABASE ${target} TEMPLATE ${d.template}"`);
    if (!r.ok) { console.error(r.out); process.exit(1); }
    console.log(`postgresql://${d.user || 'postgres'}:${(svc.env || {}).POSTGRES_PASSWORD || ''}@localhost:${svc.port}/${target}`);
  } else if (sub === 'drop' && name) {
    const d = Object.values(conf.databases || {})[0]; const c = conf.services[d.service].container || 'ws-' + d.service;
    tryRun(`docker exec ${c} psql -U ${d.user || 'postgres'} -c "DROP DATABASE IF EXISTS ${name}"`); console.log(`dropped ${name}`);
  } else if (sub === 'down') {
    for (const [n, s] of Object.entries(conf.services || {})) { tryRun(`docker rm -f ${s.container || 'ws-' + n}`); console.log(`${n}: removed`); }
  } else { console.error('ws infra ensure|status|db <name>|drop <name>|down'); process.exit(1); }
}

function ensureTemplate(conf, n, d) {
  const stamp = path.join('.ws', `${n}.migrations.hash`);
  const hash = crypto.createHash('sha256').update((d.hashFiles || []).map(f => read(f) || '').join('\n')).digest('hex');
  const c = conf.services[d.service].container || 'ws-' + d.service;
  const exists = tryRun(`docker exec ${c} psql -U ${d.user || 'postgres'} -tAc "SELECT 1 FROM pg_database WHERE datname='${d.template}'"`).out.trim() === '1';
  if (exists && read(stamp) === hash) { console.log(`${n}: template ${d.template} up to date`); return; }
  tryRun(`docker exec ${c} psql -U ${d.user || 'postgres'} -c "DROP DATABASE IF EXISTS ${d.template}"`);
  tryRun(`docker exec ${c} psql -U ${d.user || 'postgres'} -c "CREATE DATABASE ${d.template}"`);
  const url = `postgresql://${d.user || 'postgres'}:${(conf.services[d.service].env || {}).POSTGRES_PASSWORD || ''}@localhost:${conf.services[d.service].port}/${d.template}`;
  const r = tryRun(d.migrate.replace('{url}', url));
  if (!r.ok) { console.error(`${n}: migration failed\n${r.out.split('\n').slice(0, 20).join('\n')}`); process.exit(1); }
  fs.mkdirSync('.ws', { recursive: true }); fs.writeFileSync(stamp, hash);
  console.log(`${n}: template ${d.template} rebuilt`);
}

function test([component]) {
  const tests = cfg.test_commands || {};
  const names = component ? [component] : Object.keys(tests);
  if (!names.length) { console.error('no test_commands in workflow/config.json'); process.exit(1); }
  if (fs.existsSync(path.join(WORKFLOW, 'infra.json'))) infra(['ensure']);
  fs.mkdirSync(path.join('.ws', 'logs'), { recursive: true });
  let failed = 0;
  for (const n of names) {
    const r = tryRun(tests[n]);
    const log = path.join('.ws', 'logs', `${n}.log`); fs.writeFileSync(log, r.out);
    const lines = r.out.split('\n');
    if (r.ok) console.log(`PASS ${n} (${lines.length} log lines, full log ${log})`);
    else {
      failed++;
      const fails = lines.filter(l => /(FAIL|FAILED|Error|✕|✖|not ok)/.test(l)).slice(0, 15);
      console.log(`FAIL ${n} — first failures (full log ${log}):\n${(fails.length ? fails : lines.slice(-15)).join('\n')}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

// ---- roles, adapters, scope ----
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function parseRole(file) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec((read(file) || '').replace(/\r\n/g, '\n'));
  if (!m) return null;
  const meta = {};
  for (const l of m[1].split('\n')) { const k = /^([a-z_]+):\s*(.*)$/.exec(l); if (k) meta[k[1]] = k[2]; }
  return { meta, body: m[2], list: key => (meta[key] || '').split(',').map(x => x.trim()).filter(Boolean) };
}
function globRe(g) { return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$'); }
const TOOLMAP = { read: 'Read', search: 'Grep, Glob', write: 'Edit, Write', shell: 'Bash' };

function adapters([provider]) {
  const models = readJson(path.join(WORKFLOW, 'models.json'));
  if (!['claude', 'codex'].includes(provider) || !models) { console.error('ws adapters claude|codex (needs workflow/models.json)'); process.exit(1); }
  const dir = provider === 'claude' ? '.claude' : '.codex';
  fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
  const agentsDir = path.join(WORKFLOW, 'agents'); let n = 0;
  for (const f of fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : []) {
    const r = parseRole(path.join(agentsDir, f)); if (!r) continue;
    const role = f.replace(/\.md$/, ''), ov = models.roles?.[role] || {};
    const tier = ov.tier || r.meta.tier || 'mid', reasoning = ov.reasoning || r.meta.reasoning || 'medium';
    const model = models.tiers?.[tier]?.[provider] || '';
    const contract = `Reads: ${r.meta.reads || '-'}\nWrites: ${r.meta.writes || 'nothing'}\nNever touch: ${r.meta.forbidden || '-'}\nReturn: ${r.meta.returns || '-'}\nReasoning: ${reasoning}`;
    if (provider === 'claude') {
      const tools = r.list('tools').map(t => TOOLMAP[t] || t).join(', ');
      fs.writeFileSync(path.join(dir, 'agents', `${role}.md`), `---\nname: ${role}\ndescription: ${r.meta.purpose}\ntools: ${tools}\n${model ? `model: ${model}\n` : ''}---\n<!-- GENERATED by ws adapters claude from workflow/agents/${role}.md. Do not edit. -->\n${r.body.trim()}\n\n## Contract\n${contract}\n`);
    } else {
      fs.writeFileSync(path.join(dir, 'agents', `${role}.md`), `<!-- GENERATED by ws adapters codex. Codex subagent/skill format is UNVERIFIED; check current Codex docs before relying on this. model: ${model || 'default'}, reasoning: ${reasoning} -->\n# ${role}\n${r.meta.purpose}\n\n${r.body.trim()}\n\n## Contract\n${contract}\n`);
    }
    n++;
  }
  const skillsSrc = path.join(WORKFLOW, 'skills');
  if (fs.existsSync(skillsSrc)) fs.cpSync(skillsSrc, path.join(dir, 'skills'), { recursive: true });
  console.log(`${n} role(s) written to ${dir}/agents${fs.existsSync(skillsSrc) ? ', skills copied' : ''}`);
}

function verifyScope([role, ...a]) {
  const r = parseRole(path.join(WORKFLOW, 'agents', `${role}.md`));
  if (!r) { console.error(`no workflow/agents/${role}.md`); process.exit(1); }
  const base = flag(a, '--base') || 'HEAD';
  const changed = [...new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
  const allowed = r.list('writes').map(globRe);
  const bad = changed.filter(f => !allowed.some(re => re.test(f)));
  console.log(bad.length ? `OUT OF SCOPE for ${role}:\n${bad.join('\n')}` : `ok: ${changed.length} changed file(s) all within ${role}'s writes`);
  process.exit(bad.length ? 1 : 0);
}

// ---- decisions and lessons ----
function nextProvisional(text, ns) { const ids = [...text.matchAll(new RegExp(`${ns}~(\\d+)`, 'g'))].map(m => +m[1]); return Math.max(0, ...ids) + 1; }
function appendToSection(file, heading, block) {
  let t = read(file) || ''; const re = new RegExp(`^## (?:\\d+\\. )?${heading}\\s*$`, 'mi');
  if (!re.test(t)) t = t.replace(/\n*$/, `\n\n## ${heading}\n`);
  const m = re.exec(t); const rest = t.slice(m.index + m[0].length); const nx = /\n## /.exec(rest);
  const at = m.index + m[0].length + (nx ? nx.index : rest.length);
  fs.writeFileSync(file, t.slice(0, at).replace(/\n*$/, '\n') + '\n' + block.trim() + '\n' + t.slice(at));
}
function titleArgs(a, keys) { const vals = keys.map(k => flag(a, k)); return a.filter(x => !x.startsWith('--') && !vals.includes(x)).join(' '); }
function decision([sub, ...a]) {
  if (sub === 'new') {
    const title = titleArgs(a, ['--by', '--why', '--rejected']);
    const bs = branchStatePath(); if (!fs.existsSync(bs)) { console.error(`no branch state ${bs}`); process.exit(1); }
    const id = `C~${nextProvisional(read(bs), 'C')}`;
    appendToSection(bs, 'Decisions', `### ${id} — ${title}\n\n- **Date:** ${new Date().toISOString().slice(0, 10)}\n- **Who asked:** ${flag(a, '--by') || 'operator'}\n- **Supersedes:** —\n\n**Decision.** ${title}\n\n**Why.** ${flag(a, '--why') || 'TODO'}\n\n**Rejected.** ${flag(a, '--rejected') || 'TODO'}`);
    console.log(`recorded ${id} in ${bs}`);
  } else if (sub === 'show' && a[0]) {
    const f = path.join(STATE_DIR, 'decisions', `${a[0]}.md`);
    console.log(read(f) ?? (read(branchStatePath()) || '').split(/\n(?=### )/).find(b => b.startsWith(`### ${a[0]}`)) ?? 'not found');
  } else if (sub === 'supersede' && a[0] && a[1]) {
    for (const [f, k, v] of [[a[0], 'Superseded by', a[1]], [a[1], 'Supersedes', a[0]]]) {
      const p = path.join(STATE_DIR, 'decisions', `${f}.md`); const t = read(p);
      if (t) fs.writeFileSync(p, t.replace(new RegExp(`^- \\*\\*${k}:\\*\\*.*$`, 'm'), `- **${k}:** ${v}`));
    }
    console.log(`${a[0]} superseded by ${a[1]}; remove ${a[0]} from the STATE.md / guardrails.md index`);
  } else console.error('ws decision new <title> [--by X --why Y --rejected Z] | show <ID> | supersede <old> <new>');
}
function lesson([sub, ...a]) {
  if (sub === 'new') {
    const bs = branchStatePath(); if (!fs.existsSync(bs)) { console.error(`no branch state ${bs}`); process.exit(1); }
    const id = `L~${nextProvisional(read(bs), 'L')}`;
    appendToSection(bs, 'Lessons', `### ${id} — ${titleArgs(a, ['--rule', '--scope', '--cause', '--found'])}\n\n- **Date:** ${new Date().toISOString().slice(0, 10)}\n- **Cause:** ${flag(a, '--cause') || 'TODO'}\n- **Rule:** ${flag(a, '--rule') || 'TODO'}\n- **Scope:** ${flag(a, '--scope') || 'project'}\n- **Found by:** ${flag(a, '--found') || 'operator'}`);
    console.log(`recorded ${id}`);
  } else if (sub === 'graduate' && a[0]) {
    const p = path.join(STATE_DIR, 'lessons', `${a[0]}.md`); const t = read(p);
    if (!t) { console.error('not found'); process.exit(1); }
    fs.writeFileSync(p, t.replace(/\n*$/, '\n\n**Status:** graduated\n')); console.log(`${a[0]} marked graduated; move its rule into conventions/ or the role file`);
  } else console.error('ws lesson new <title> [--rule R --scope project|role:X --cause C --found F] | graduate <L-id>');
}

// ---- drift ----
function drift() {
  const dir = path.join(STATE_DIR, 'architecture');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const t = read(path.join(dir, f)) || '';
    const m = /## Target Link and Drift\s*\n+([^\n]+)/.exec(t);
    const state = !m ? 'NO TARGET LINK' : /none known|^none/i.test(m[1]) ? 'ok' : 'DRIFT: ' + m[1].slice(0, 80);
    console.log(`${state.padEnd(16)} ${f}`);
  }
}

// ---- skills vendoring ----
function dirChecksum(dir) {
  const h = crypto.createHash('sha256');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(e => {
    const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else h.update(p.slice(dir.length).replace(/\\/g, '/') + '\0').update(fs.readFileSync(p).toString('latin1').replace(/\r\n/g, '\n'));
  });
  walk(dir); return h.digest('hex');
}
function skills([sub]) {
  const src = process.env.WS_SKILLS_SRC || path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'skills');
  const dst = path.join(WORKFLOW, 'skills'), lockFile = path.join(WORKFLOW, 'skills.lock');
  const enabled = cfg.skills || [];
  if (sub === 'sync') {
    const lock = {};
    fs.mkdirSync(dst, { recursive: true });
    for (const n of enabled) {
      const from = path.join(src, n); if (!fs.existsSync(from)) { console.error(`missing in source: ${n}`); continue; }
      fs.rmSync(path.join(dst, n), { recursive: true, force: true }); fs.cpSync(from, path.join(dst, n), { recursive: true });
      lock[n] = { checksum: dirChecksum(path.join(dst, n)) };
    }
    for (const n of fs.readdirSync(dst)) if (!enabled.includes(n)) { fs.rmSync(path.join(dst, n), { recursive: true, force: true }); console.log(`removed (not enabled): ${n}`); }
    fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + '\n'); console.log(`synced ${Object.keys(lock).length} skill(s); lock updated. Commit workflow/skills and skills.lock.`);
  } else if (sub === 'check') {
    const lock = readJson(lockFile) || {}; let bad = 0;
    for (const n of enabled) {
      const p = path.join(dst, n);
      if (!fs.existsSync(p)) { console.log(`MISSING ${n}`); bad++; } else if (lock[n]?.checksum !== dirChecksum(p)) { console.log(`EDITED  ${n} (differs from lock; edit the user-level skill and re-sync)`); bad++; }
    }
    if (fs.existsSync(dst)) for (const n of fs.readdirSync(dst)) if (!enabled.includes(n)) { console.log(`UNLISTED ${n}`); bad++; }
    console.log(bad ? `${bad} problem(s)` : 'ok'); process.exit(bad ? 1 : 0);
  } else console.error('ws skills sync|check  (source: $WS_SKILLS_SRC or ~/.claude/skills; enabled list: config.json "skills")');
}

// ---- fold: the mechanical part of sync-project-state (the agent confirms the diff) ----
function walkFiles(dir, skipDirs = []) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? (skipDirs.includes(e.name) ? [] : walkFiles(p, skipDirs)) : [p];
  });
}
function mdSections(text, level) { // map normalised heading -> {heading, body}
  const parts = text.split(new RegExp(`\\n(?=${'#'.repeat(level)} )`)); const out = {};
  for (const p of parts) { const m = new RegExp(`^${'#'.repeat(level)} (.*)\\n?([\\s\\S]*)$`).exec(p); if (m) out[m[1].replace(/^\d+(\.\d+)*\.?\s*/, '').trim().toLowerCase()] = { heading: m[1], body: m[2] }; }
  return out;
}
function tableRows(body, idPrefix) { return body.split('\n').filter(l => new RegExp(`^\\|\\s*${idPrefix}`).test(l)); }
function insertAfterTableHeader(text, headerStart, row, top = false) {
  const lines = text.split('\n'); const i = lines.findIndex(l => l.startsWith(headerStart));
  if (i < 0) return null;
  let j = i + 2; if (!top) while (j < lines.length && lines[j].startsWith('|')) j++;
  lines.splice(j, 0, row); return lines.join('\n');
}

function fold([s]) {
  const bsFile = branchStatePath(s), text0 = read(bsFile);
  if (!text0) { console.error(`no ${bsFile}`); process.exit(1); }
  const text = text0.replace(/\r\n/g, '\n');
  if (!/\*\*Status:\*\*\s*Approved/.test(text)) { console.error('Status is not Approved; sync refuses (the owner approves)'); process.exit(1); }
  if (tableRows(text, 'S\\d').length) { console.error('session table is not empty'); process.exit(1); }
  // permanent ID allocation
  const used = { W: 0, C: 0, D: 0, Q: 0, L: 0 };
  const scan = t => { for (const m of t.matchAll(/\b([WCDQL])(\d+)\b/g)) used[m[1]] = Math.max(used[m[1]], +m[2]); };
  for (const f of walkFiles(STATE_DIR, [])) if (!/branch-states[\\/][^\\/]+\.md$/.test(f) || /archive/.test(f)) scan(path.basename(f) + '\n' + (read(f) || ''));
  const map = {}; let order = [];
  for (const m of text.matchAll(/\b([WCDQL])~(\d+)\b/g)) if (!map[m[0]]) { map[m[0]] = `${m[1]}${++used[m[1]]}`; order.push(m[0]); }
  const rw = t => t.replace(/\b([WCDQL])~(\d+)\b/g, m => map[m] || m);
  const today = new Date().toISOString().slice(0, 10), sl = s || slug();
  const log = [];
  const secs = mdSections(text, 2), writeNew = (rel, body) => { const p = path.join(STATE_DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); log.push(`created ${p}`); };
  const stateP = path.join(STATE_DIR, 'STATE.md'); let state = read(stateP) || '';

  // decisions (blocks "### C~n" or table rows), then rows only in architecture
  const decided = new Set();
  const dsec = secs['decisions']?.body || '';
  for (const b of dsec.split(/\n(?=### )/).filter(b => b.startsWith('### C~'))) {
    const id = map[/^### (C~\d+)/.exec(b)[1]]; decided.add(id);
    writeNew(`decisions/${id}.md`, rw(b.replace(/^### (C~\d+) — /, '# $1 — ') .replace(/^### /, '# ')).trim() + '\n');
    const title = /^### C~\d+ — (.*)$/m.exec(b)?.[1] || id;
    state = insertAfterTableHeader(state, '| ID | One-line decision', `| ${id} | ${title} | decisions/${id}.md |`) ?? state;
  }
  const rowSources = [...tableRows(dsec, 'C~'), ...tableRows(secs['architecture']?.body || '', 'C~')];
  for (const r of rowSources) {
    const c = r.split('|').map(x => x.trim()); const id = map[c[1]]; if (!id || decided.has(id)) continue; decided.add(id);
    writeNew(`decisions/${id}.md`, `# ${id} — ${c[3]}\n\n- **Date:** ${c[2]}\n- **Who asked:** ${c[5] || 'see Why'}\n- **Supersedes:** —\n- **Superseded by:** —\n- **Binding (guardrails.md):** unknown, check\n\n## Decision\n\n${rw(c[3])}\n\n## Why\n\n${rw(c[4])}\n\n## Rejected Alternatives\n\nTODO: not stated in the branch state\n`);
    state = insertAfterTableHeader(state, '| ID | One-line decision', `| ${id} | ${c[3]} | decisions/${id}.md |`) ?? state;
  }
  // deviations and lessons
  for (const [secName, ns, dir] of [['deviations', 'D', 'deviations'], ['lessons', 'L', 'lessons']])
    for (const b of (secs[secName]?.body || '').split(/\n(?=### )/).filter(b => b.startsWith(`### ${ns}~`)))
      { const id = map[new RegExp(`^### (${ns}~\\d+)`).exec(b)[1]]; writeNew(`${dir}/${id}.md`, rw(b.replace(/^### /, '# ')).trim() + '\n'); }
  // architecture areas
  for (const blk of (secs['architecture']?.body || '').split(/\n(?=### )/).filter(b => b.startsWith('### '))) {
    const name = blk.split('\n')[0].replace(/^###\s*(\d+(\.\d+|\.x)*\s*)?/, '').trim(); const file = path.join(STATE_DIR, 'architecture', `${slugify(name)}.md`);
    const now = /\*\*Now \(proposed\):\*\*\s*([\s\S]*?)(?=\n\n\||\n\|)/.exec(blk)?.[1]?.trim() || '';
    const ids = [...new Set([...blk.matchAll(/\bC~\d+\b/g)].map(m => map[m[0]]))];
    const rows = ids.map(id => `| ${id} | ${today} | see file | ../decisions/${id}.md |`).join('\n');
    if (fs.existsSync(file)) {
      let t = read(file); t = /## Now\n[\s\S]*?(?=\n## )/.test(t) ? t.replace(/## Now\n[\s\S]*?(?=\n## )/, `## Now\n\n${rw(now)}\n`) : t;
      if (rows) t = t.replace(/\n*$/, `\n${rows}\n`);
      fs.writeFileSync(file, t); log.push(`updated ${file}`);
    } else writeNew(`architecture/${slugify(name)}.md`, `# Architecture — ${name}\n\n## Now\n\n${rw(now)}\n\n## Decisions\n\n| ID | Date | One-line decision | File |\n|---|---|---|---|\n${rows}\n\n## Target Link and Drift\n\nnone known (new area; add the Target link)\n`);
  }
  // workstreams -> STATE.md
  for (const r of tableRows(secs['workstreams']?.body || '', 'W')) {
    const row = rw(r), id = row.split('|')[1].trim(); const lines = state.split('\n'); const i = lines.findIndex(l => l.startsWith(`| ${id} |`));
    if (i >= 0) lines[i] = row; else { const last = lines.map((l, k) => /^\| W\d/.test(l) ? k : -1).filter(k => k >= 0).pop(); lines.splice(last === undefined ? lines.length : last + 1, 0, row); }
    state = lines.join('\n');
  }
  // handover -> Upcoming
  for (const h of text.matchAll(/^- \[ \] \*\*Handover:\*\*\s*(.+)$/gm)) {
    const row = `| ${rw(h[1])} | Workstream | see item | handed over from \`${sl}\` | ${today} |`;
    state = insertAfterTableHeader(state, '| Item | Kind', row) ?? state;
  }
  // changes -> ledger
  const ledgerP = path.join(STATE_DIR, 'ledger', 'done-ledger.md'); let ledger = read(ledgerP) || '';
  const rows = [...tableRows(secs['changes']?.body || '', '20')].map(rw).concat(`| ${today} | Folded branch state \`${sl}\` | — | archive |`);
  for (const r of rows) ledger = insertAfterTableHeader(ledger, '| Date | What changed', r, true) ?? ledger;
  fs.writeFileSync(ledgerP, ledger); log.push(`updated ${ledgerP}`);
  state = state.replace(/^- \*\*Last updated:\*\*.*$/m, `- **Last updated:** ${today} by ws fold — folded ${sl}`);
  fs.writeFileSync(stateP, state); log.push(`updated ${stateP}`);
  // archive
  const archived = path.join(STATE_DIR, 'branch-states', 'archive', `${today}-${sl}.md`); fs.mkdirSync(path.dirname(archived), { recursive: true });
  const record = `\n\n## Fold record\nFolded ${today} by ws fold · branch \`${sl}\`\n\n| Provisional | Permanent |\n|---|---|\n${order.map(k => `| ${k} | ${map[k]} |`).join('\n')}\n`;
  fs.writeFileSync(archived, text.replace(/(\*\*Status:\*\*\s*)Approved/, '$1Folded') + record); fs.rmSync(bsFile); log.push(`archived -> ${archived}`);
  console.log(log.join('\n') + `\n\nID map: ${order.map(k => `${k}=${map[k]}`).join(', ') || '(none)'}\nReview with: git diff; then check no dangling '~' IDs, move binding decisions to guardrails.md, remove covered Upcoming rows, commit locally (never push).`);
}


// ---- guide targets ----
function guideTargets(paths) {
  const map = readJson(path.join('docs', 'guide', 'map.json'));
  if (!map) { console.error('no docs/guide/map.json'); process.exit(1); }
  const hit = new Set();
  for (const p of paths) for (const [g, secs] of Object.entries(map)) if (!g.startsWith('_') && globRe(g).test(p.replace(/\\/g, '/'))) secs.forEach(s => hit.add(s));
  console.log(hit.size ? ['index.md', ...hit].join('\n') : 'index.md (no mapped section; check map.json)');
}

commands[cmd](args);
