import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, SEVERITIES, blindReview, tally } from '../blindreview.mjs';
import { EXP_ROOT, REPO_ROOT } from '../paths.mjs';
import { scan } from '../secrets.mjs';
import { buildEnv, resolveLauncher } from '../spawn.mjs';

export const name = 'blindreview';

const USAGE = 'usage: exp blindreview <experiment-id> --rep <n> [--calls <n>]';

function markdown(experimentId, rep, result) {
  const arms = [...new Set(result.reviews.map((r) => r.arm))];
  const out = [`# Blind review: ${experimentId}, replicate ${rep}`, '',
    `Reviews: ${result.reviews.length}, cost ${result.cost.toFixed(4)} USD. The reviewer saw the request, the spec and the plan, never the arm name.`, '',
    '| Arm | Call | Findings | ' + SEVERITIES.join(' | ') + ' |', '|---|---|---|' + SEVERITIES.map(() => '---|').join('')];
  for (const arm of arms) {
    for (const r of result.reviews.filter((x) => x.arm === arm)) {
      const t = tally(r.findings);
      out.push(`| ${arm} | ${r.call + 1} | ${r.error ? 'unparseable' : t.total} | ${SEVERITIES.map((s) => t.severity[s]).join(' | ')} |`);
    }
  }
  out.push('', '| Category | ' + arms.join(' | ') + ' |', '|---|' + arms.map(() => '---|').join(''));
  for (const c of CATEGORIES) out.push(`| ${c} | ${arms.map((a) => result.reviews.filter((r) => r.arm === a).map((r) => tally(r.findings).category[c]).join(' / ')).join(' | ')} |`);
  for (const arm of arms) {
    out.push('', `## ${arm}`);
    for (const r of result.reviews.filter((x) => x.arm === arm)) {
      out.push('', `Call ${r.call + 1}:`, '');
      for (const f of r.findings) out.push(`- [${f.severity}] ${f.category}, ${f.where}: ${f.issue}`);
    }
  }
  return `${out.join('\n')}\n`;
}

export async function run(argv) {
  const [experimentId] = argv;
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? Number(argv[i + 1]) : undefined; };
  const rep = flag('--rep');
  const calls = flag('--calls') ?? 2;
  if (!experimentId || experimentId.startsWith('--') || !Number.isInteger(rep) || !Number.isInteger(calls) || calls < 1) { console.error(USAGE); return 2; }
  const runsDir = path.join(EXP_ROOT, 'local', 'runs');
  const runs = fs.readdirSync(runsDir).map((d) => ({ dir: path.join(runsDir, d), m: JSON.parse(fs.readFileSync(path.join(runsDir, d, 'manifest.json'), 'utf8')) }))
    .filter((r) => r.m.experiment_id === experimentId && r.m.rep === rep && r.m.status === 'complete')
    .map((r) => ({ arm: r.m.arm_id, dir: r.dir, task: r.m.task_id }));
  if (runs.length === 0) { console.error(`no complete runs for ${experimentId} replicate ${rep}`); return 2; }
  const task = path.join(EXP_ROOT, 'tasks', runs[0].task);
  const brief = fs.readFileSync(path.join(task, 'brief.md'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(EXP_ROOT, 'config.json'), 'utf8'));
  const model = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'workflow', 'models.json'), 'utf8')).tiers.strong.claude;
  const result = await blindReview({ runs, brief, launcher: resolveLauncher(config.claude_bin), env: buildEnv(process.env, { authMode: config.auth_mode }), model, calls });
  const body = { experiment_id: experimentId, rep, model, ...result };
  const md = markdown(experimentId, rep, result);
  const hits = scan(JSON.stringify(body) + md);
  if (hits.length) { console.error(`credential pattern in the output (${hits.map((h) => h.type).join(', ')}); nothing written`); return 9; }
  const outDir = path.join(REPO_ROOT, 'docs', 'telemetry', 'experiments', experimentId);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'blind-review.json'), `${JSON.stringify(body, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'blind-review.md'), md);
  console.log(md.split('\n').slice(0, 14).join('\n'));
  console.log(`written to ${path.relative(REPO_ROOT, outDir)}; cost ${result.cost.toFixed(4)} USD`);
  return result.reviews.some((r) => r.error) ? 6 : 0;
}
