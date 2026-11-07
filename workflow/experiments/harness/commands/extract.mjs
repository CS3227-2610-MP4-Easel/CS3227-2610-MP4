import fs from 'node:fs';
import path from 'node:path';
import { UsageError, extractRun } from '../extract.mjs';
import { EXP_ROOT } from '../paths.mjs';

export const name = 'extract';

export function run(argv) {
  const [runId, ...rest] = argv;
  if (!runId || rest.length) {
    console.error('usage: exp extract <run-id>');
    return 2;
  }
  try {
    const pricing = JSON.parse(fs.readFileSync(path.join(EXP_ROOT, 'pricing.json'), 'utf8'));
    const { usage, warnings } = extractRun({ expRoot: EXP_ROOT, runId, pricing });
    console.log(`run ${runId} extracted: ${usage.events} events, ${usage.total_tok} tokens, arm cost ${usage.arm_cost_usd ?? 'n/a'} USD`);
    for (const w of warnings) console.log(`warning: ${w}`);
    return 0;
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(e.message);
      return e.exit;
    }
    throw e;
  }
}
