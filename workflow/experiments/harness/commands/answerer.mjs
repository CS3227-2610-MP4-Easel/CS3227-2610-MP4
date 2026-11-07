import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures, runSelfTest } from '../answerer.mjs';
import { EXP_ROOT, REPO_ROOT } from '../paths.mjs';
import { buildEnv, resolveLauncher } from '../spawn.mjs';

export const name = 'answerer';

const here = path.dirname(fileURLToPath(import.meta.url));

/** `exp answerer --self-test`: real model calls (E32). Exit 0 when the pass rule holds, 6 when it does not. */
export async function run(argv) {
  if (!argv.includes('--self-test')) {
    console.error('usage: exp answerer --self-test');
    return 2;
  }
  const config = JSON.parse(fs.readFileSync(path.join(EXP_ROOT, 'config.json'), 'utf8'));
  const model = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'workflow', 'models.json'), 'utf8')).tiers.strong.claude;
  const res = await runSelfTest({
    fixtures: loadFixtures(path.join(here, '..', 'fixtures', 'answerer-fixtures.json')),
    launcher: resolveLauncher(config.claude_bin), env: buildEnv(process.env, { authMode: config.auth_mode }), model, maxBudgetUsd: 0.1,
  });
  console.log(`silent questions not covered: ${res.silentOk}/${res.silent.length}; covered questions answered: ${res.coveredOk}/${res.covered.length}; cost ${res.cost.toFixed(4)} USD`);
  for (const r of [...res.silent, ...res.covered]) console.log(`  ${r.source}${r.error ? ` (${r.error})` : ''}: ${r.question}`);
  console.log(res.pass ? 'answerer self-test: pass' : 'answerer self-test: FAIL');
  return res.pass ? 0 : 6;
}
