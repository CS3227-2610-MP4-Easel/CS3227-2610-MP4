import fs from 'node:fs';
import path from 'node:path';
import { UsageError } from '../bank.mjs';
import { gradeRun } from '../grade.mjs';
import { scoreArtifact, seedFor } from '../judge.mjs';
import { EXP_ROOT, REPO_ROOT } from '../paths.mjs';
import { buildEnv, resolveLauncher } from '../spawn.mjs';

export const name = 'grade';

/**
 * E46 and F12: score the three calibration artifacts and check that good > mediocre > bad and that each score sits in
 * its stored band. The bad artifact carries an instruction to the judge ("canary"); it must keep its band.
 */
export async function selfTest({ expRoot, launcher, env, model }) {
  const dir = path.join(expRoot, 'rubric');
  const rubric = fs.readFileSync(path.join(dir, 'rubric.md'), 'utf8');
  const bands = JSON.parse(fs.readFileSync(path.join(dir, 'calibration', 'bands.json'), 'utf8'));
  const results = {};
  let cost = 0;
  for (const n of ['good', 'mediocre', 'bad']) {
    const artifact = fs.readFileSync(path.join(dir, 'calibration', `${n}.md`), 'utf8');
    const r = await scoreArtifact({ rubric, artifact, launcher, env, model, seeds: [seedFor('selftest', n, 0), seedFor('selftest', n, 1)] });
    cost += r.cost;
    results[n] = r.error ? { error: r.error } : { mean: r.mean, gap: r.gap, inBand: r.mean >= bands[n][0] && r.mean <= bands[n][1] };
  }
  const ok = (n) => results[n].inBand === true;
  const ordered = !results.good.error && !results.mediocre.error && !results.bad.error && results.good.mean > results.mediocre.mean && results.mediocre.mean > results.bad.mean;
  return { pass: ordered && ok('good') && ok('mediocre') && ok('bad'), ordered, results, bands, cost };
}

export async function run(argv) {
  const config = JSON.parse(fs.readFileSync(path.join(EXP_ROOT, 'config.json'), 'utf8'));
  const model = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'workflow', 'models.json'), 'utf8')).tiers.strong.claude;
  const env = buildEnv(process.env, { authMode: config.auth_mode });
  if (argv[0] === '--self-test' && argv.length === 1) {
    const r = await selfTest({ expRoot: EXP_ROOT, launcher: resolveLauncher(config.claude_bin), env, model });
    for (const [n, v] of Object.entries(r.results)) console.log(`${n}: ${v.error ?? `score ${v.mean} (band ${r.bands[n][0]}-${r.bands[n][1]})${v.inBand ? '' : ' OUT OF BAND'}`}`);
    console.log(`order good > mediocre > bad: ${r.ordered}; cost ${r.cost.toFixed(4)} USD`);
    console.log(r.pass ? 'grade self-test: pass' : 'grade self-test: FAIL');
    return r.pass ? 0 : 6;
  }
  if (argv.length !== 1 || argv[0].startsWith('--')) {
    console.error('usage: exp grade <run-id> | exp grade --self-test');
    return 2;
  }
  try {
    const res = await gradeRun({ expRoot: EXP_ROOT, repoRoot: REPO_ROOT, runId: argv[0], launcher: resolveLauncher(config.claude_bin), env, model });
    if (res.reason) console.log(res.reason);
    else console.log(`run ${argv[0]} graded: rubric ${res.grades.rubric_total ?? 'n/a'}, flags [${res.grades.flags.join(', ')}]`);
    return res.exit;
  } catch (e) {
    if (e instanceof UsageError) { console.error(e.message); return e.exit; }
    throw e;
  }
}
