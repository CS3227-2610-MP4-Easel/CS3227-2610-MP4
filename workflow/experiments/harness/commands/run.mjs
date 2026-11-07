import { runExperiment } from '../driver.mjs';
import { extractRun } from '../extract.mjs';
import { EXP_ROOT, REPO_ROOT } from '../paths.mjs';

export const name = 'run';

const USAGE = 'usage: exp run <experiment-id> [--task T] [--arm A] [--rep N] [--dry] [--yes <arm>=<hash>]...\n       exp run --continue <run-id>';

/** Parse argv; returns {error} or the options for runExperiment. */
export function parseArgs(argv) {
  const opts = { experimentId: null, filters: {}, dry: false, yes: {}, continueRunId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => { i += 1; if (argv[i] === undefined || argv[i].startsWith('--')) throw new Error(`${a} needs a value`); return argv[i]; };
    try {
      if (a === '--dry') opts.dry = true;
      else if (a === '--task') opts.filters.task = value();
      else if (a === '--arm') opts.filters.arm = value();
      else if (a === '--rep') {
        const n = Number(value());
        if (!Number.isInteger(n) || n < 1) return { error: '--rep needs a positive integer' };
        opts.filters.rep = n;
      } else if (a === '--yes') {
        const [arm, hash] = value().split('=');
        if (!arm || !hash) return { error: '--yes needs <arm>=<hash>' };
        opts.yes[arm] = hash;
      } else if (a === '--continue') opts.continueRunId = value();
      else if (a.startsWith('--')) return { error: `unknown option ${a}` };
      else if (opts.experimentId === null) opts.experimentId = a;
      else return { error: `unexpected argument ${a}` };
    } catch (e) {
      return { error: e.message };
    }
  }
  if (!opts.continueRunId && !opts.experimentId) return { error: 'an experiment id or --continue <run-id> is required' };
  if (opts.continueRunId && opts.experimentId) return { error: '--continue takes a run id, not an experiment id' };
  return opts;
}

export async function run(argv) {
  const opts = parseArgs(argv);
  if (opts.error) {
    console.error(`${opts.error}\n${USAGE}`);
    return 2;
  }
  const res = await runExperiment({ repoRoot: REPO_ROOT, expRoot: EXP_ROOT, ...opts, deps: {
      log: (l) => console.log(l),
      // every terminal run is extracted at the end of its turn loop (F9)
      afterRun: async (r, ctx) => {
        const { usage, warnings } = extractRun({ expRoot: EXP_ROOT, runId: r.run_id, pricing: ctx.pricing });
        console.log(`run ${r.run_id} extracted: ${usage.events} events`);
        for (const w of warnings) console.log(`warning (${r.run_id}): ${w}`);
      },
    },
  });
  return res.exit;
}
