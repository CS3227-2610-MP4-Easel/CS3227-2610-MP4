// THROWAWAY (T1 of the implementation stage): facts the design relies on, measured on this machine.
// Usage: node impl-spike.mjs --part tree,toolchain,kill[,build] [--limit 3]
// `build` makes ONE real model call (Sonnet 5.5, low effort) and spends up to --limit USD; the other parts are free.
// Findings print as JSON and are written to workflow/experiments/local/spike/impl-findings.json (gitignored).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EXP_ROOT, REPO_ROOT } from '../paths.mjs';
import { claudeArgs, killTree, parseStream, resolveLauncher, runProcess } from '../spawn.mjs';
import { eventCost } from '../pricing.mjs';

const BASE = '160053ce006b6a54bc85d87f9cf380242fdef95a';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const PARTS = arg('part', 'tree,toolchain,kill').split(',');
const LIMIT = Number(arg('limit', '3'));
const WORK = path.resolve(REPO_ROOT, '..', 'exp-runs', 'impl-spike');
const OUT = path.join(EXP_ROOT, 'local', 'spike');
const findings = {};
fs.mkdirSync(OUT, { recursive: true });
const save = () => fs.writeFileSync(path.join(OUT, 'impl-findings.json'), JSON.stringify(findings, null, 2));
const secs = (t0) => Math.round((Date.now() - t0) / 100) / 10;

// The N3 candidate list. A missing variable is added here and the part re-run; the final list goes to isolation.md.
const ENV_NAMES = ['PATH', 'PATHEXT', 'ComSpec', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA'];
const checkEnv = (extra = {}) => {
  const env = {};
  for (const n of ENV_NAMES) if (process.env[n] !== undefined) env[n] = process.env[n];
  if (process.env.npm_config_cache) env.npm_config_cache = process.env.npm_config_cache;
  return { ...env, ...extra };
};
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

function historyFreeTree(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const tar = path.join(WORK, 'base.tar');
  fs.mkdirSync(WORK, { recursive: true });
  execFileSync('git', ['archive', '--format=tar', '-o', tar, BASE], { cwd: REPO_ROOT });
  // GNU tar reads 'S:...' as host:path, so extract with relative names from the work folder (finding for clone.mjs)
  execFileSync('tar', ['-xf', path.basename(tar), '-C', path.relative(WORK, dest)], { cwd: WORK });
  git(dest, 'init', '-q');
  git(dest, '-c', 'user.name=harness', '-c', 'user.email=harness@localhost', 'add', '-A');
  git(dest, '-c', 'user.name=harness', '-c', 'user.email=harness@localhost', 'commit', '-q', '-m', 'base');
  return dest;
}

function timed(label, cmd, args, cwd, env) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, shell: false });
  const entry = { label, status: r.status, seconds: secs(t0), error: r.error ? String(r.error.code ?? r.error) : null };
  entry.stdout_head = (r.stdout ?? '').split('\n').slice(0, 12);
  entry.stderr_head = (r.stderr ?? '').split('\n').slice(0, 12);
  return { entry, stdout: r.stdout ?? '' };
}

const TREE = path.join(WORK, 'tree');

if (PARTS.includes('tree')) {
  const t0 = Date.now();
  historyFreeTree(TREE);
  const log = git(TREE, 'log', '--all', '--format=%s').split('\n').filter(Boolean);
  const refs = git(TREE, 'for-each-ref', '--format=%(refname)').split('\n').filter(Boolean);
  const objects = git(TREE, 'count-objects', '-v');
  findings.tree = { seconds: secs(t0), commits: log, refs, single_commit: log.length === 1 && refs.length === 1, objects };
  if (!findings.tree.single_commit) throw new Error('tree has more than one commit or ref');
  save();
}

if (PARTS.includes('toolchain')) {
  const env = checkEnv();
  const node = process.execPath;
  const steps = [];
  const npmCli = path.join(path.dirname(node), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  steps.push(timed('npm ci --ignore-scripts', node, [npmCli, 'ci', '--ignore-scripts'], TREE, env).entry);
  const tsc = timed('tsc -b', node, [path.join('node_modules', 'typescript', 'bin', 'tsc'), '-b'], TREE, env);
  steps.push(tsc.entry);
  const feTsc = timed('tsc --noEmit (src/fe)', node, [path.join(TREE, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '-p', '.'], path.join(TREE, 'src', 'fe'), env);
  steps.push(feTsc.entry);
  const testFile = path.join('src', 'be', 'contracts', 'test', 'date-rules.test.ts');
  const test = timed('node --import tsx --test (tap)', node, ['--import', 'tsx', '--test', '--test-reporter=tap', testFile], TREE, env);
  steps.push(test.entry);
  const tap = test.stdout.split('\n').filter((l) => /^\s*(ok|not ok|# )/.test(l));
  const t0 = Date.now();
  const copy = path.join(WORK, 'nm-copy');
  fs.rmSync(copy, { recursive: true, force: true });
  fs.cpSync(path.join(TREE, 'node_modules'), copy, { recursive: true });
  const copySeconds = secs(t0);
  let files = 0;
  const count = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) count(path.join(d, e.name)); else files += 1; } };
  count(copy);
  fs.rmSync(copy, { recursive: true, force: true });
  findings.toolchain = {
    env_names: Object.keys(env), steps, tap_sample: tap.slice(0, 12), tap_total_lines: tap.length,
    node_modules_copy: { seconds: copySeconds, files },
    tsx_resolves_from_tree: fs.existsSync(path.join(TREE, 'node_modules', 'tsx', 'package.json')),
  };
  // Junction behaviour of lstat on this machine.
  const target = path.join(WORK, 'jtarget');
  const link = path.join(WORK, 'jlink');
  fs.rmSync(link, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  const j = {};
  try { fs.symlinkSync(target, link, 'junction'); const st = fs.lstatSync(link); j.junction = { isSymbolicLink: st.isSymbolicLink(), isDirectory: st.isDirectory() }; fs.rmdirSync(link); } catch (e) { j.junction = { error: String(e.code ?? e) }; }
  try { fs.symlinkSync(path.join(target, 'f'), link, 'file'); const st = fs.lstatSync(link); j.file_symlink = { isSymbolicLink: st.isSymbolicLink() }; fs.rmSync(link, { force: true }); } catch (e) { j.file_symlink = { error: String(e.code ?? e) }; }
  const hl = path.join(WORK, 'hl-a');
  fs.writeFileSync(hl, 'x');
  try { fs.linkSync(hl, `${hl}-b`); j.hardlink_nlink = fs.lstatSync(hl).nlink; fs.rmSync(`${hl}-b`); } catch (e) { j.hardlink = { error: String(e.code ?? e) }; }
  fs.rmSync(hl, { force: true });
  findings.lstat = j;
  save();
}

async function psFind(marker) {
  const script = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${marker}*' -and $_.Name -eq 'node.exe' } | ForEach-Object { "$($_.ProcessId)" }`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  return r.stdout.split('\n').map((s) => s.trim()).filter(Boolean).map(Number);
}

if (PARTS.includes('kill')) {
  const marker = `spike-grandchild-${Date.now()}`;
  const cwd = fs.mkdtempSync(path.join(WORK, 'kill-'));
  fs.writeFileSync(path.join(cwd, 'grandchild.js'), `setInterval(()=>{}, 1000); // ${marker}\n`);
  fs.writeFileSync(path.join(cwd, 'middle.js'),
    `const {spawn}=require('child_process');const c=spawn(process.execPath,[${JSON.stringify(path.join(cwd, 'grandchild.js'))},'${marker}'],{detached:true,stdio:'ignore',windowsHide:true,cwd:${JSON.stringify(cwd)}});c.unref();console.log('grandchild',c.pid);\n`);
  fs.writeFileSync(path.join(cwd, 'parent.js'),
    `const {spawn}=require('child_process');const m=spawn(process.execPath,[${JSON.stringify(path.join(cwd, 'middle.js'))}],{stdio:'inherit'});m.on('exit',()=>setInterval(()=>{},1000));\n`);
  const parent = spawn(process.execPath, [path.join(cwd, 'parent.js')], { cwd, stdio: 'ignore', windowsHide: true });
  await new Promise((r) => setTimeout(r, 2500));
  const before = await psFind(marker);
  await killTree(parent.pid);
  await new Promise((r) => setTimeout(r, 1000));
  const afterKillTree = await psFind(marker);
  // The sweep: kill what the filter finds.
  const swept = [];
  for (const pid of afterKillTree) { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }); swept.push(pid); }
  await new Promise((r) => setTimeout(r, 800));
  const afterSweep = await psFind(marker);
  findings.kill = {
    grandchild_pids_before_killTree: before, survived_killTree: afterKillTree.length > 0, swept, survived_sweep: afterSweep.length > 0,
    sweep_command: "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*<marker>*' -and $_.Name -eq 'node.exe' } -> taskkill /PID <pid> /T /F",
  };
  fs.rmSync(cwd, { recursive: true, force: true });
  save();
}

if (PARTS.includes('build')) {
  const pricing = JSON.parse(fs.readFileSync(path.join(EXP_ROOT, 'pricing.json'), 'utf8')).models['claude-sonnet-5-5'];
  const tree = historyFreeTree(path.join(WORK, 'build-tree'));
  const prompt = [
    'In this repository create one file, src/be/contracts/spike-toy.mjs, that exports a function add(a, b) returning a + b,',
    'and one test file src/be/contracts/spike-toy.test.mjs for it using node:test. Run the test with `node --test src/be/contracts/spike-toy.test.mjs`.',
    'When it passes, reply with the single line EXP-DONE.',
  ].join(' ');
  const args = [...claudeArgs({
    model: 'claude-sonnet-5-5', maxBudgetUsd: LIMIT, permissionMode: 'acceptEdits',
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'], disallowedTools: ['WebFetch', 'WebSearch'],
  }), '--effort', 'low'];
  const t0 = Date.now();
  const res = await runProcess({ launcher: resolveLauncher('claude'), args, cwd: tree, env: { ...process.env }, input: prompt, timeoutMs: 20 * 60 * 1000 });
  const events = parseStream(res.stdout);
  fs.writeFileSync(path.join(OUT, 'impl-build.jsonl'), res.stdout);
  const result = events.find((e) => e.type === 'result');
  // Cost basis = the result event's final totals (per-message usage in the stream undercounts output tokens).
  const u = result?.usage ?? {};
  const totals = {
    input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cache_read: u.cache_read_input_tokens ?? 0,
    cache_write_5m: u.cache_creation?.ephemeral_5m_input_tokens ?? 0, cache_write_1h: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
  };
  const tokenCost = eventCost(totals, pricing);
  const byId = new Map(events.filter((e) => e.type === 'assistant' && e.message?.id).map((e) => [e.message.id, 1]));
  const cli = result?.total_cost_usd ?? null;
  const git_after = git(tree, 'status', '--short').split('\n').filter(Boolean);
  findings.build = {
    exit: res.code, seconds: secs(t0), result_subtype: result?.subtype ?? null, is_error: result?.is_error ?? null,
    total_cost_usd: cli, token_cost_usd: Math.round(tokenCost * 1e6) / 1e6, token_totals: totals,
    difference_pct: cli ? Math.round(Math.abs(tokenCost - cli) / cli * 10000) / 100 : null,
    within_2_pct: cli ? Math.abs(tokenCost - cli) / cli <= 0.02 : null,
    assistant_messages: byId.size, tree_status: git_after,
    result_text: String(result?.result ?? '').slice(0, 200),
  };
  save();
}

console.log(JSON.stringify(findings, null, 2));
