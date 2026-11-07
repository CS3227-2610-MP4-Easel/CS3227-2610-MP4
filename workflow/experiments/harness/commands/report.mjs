import path from 'node:path';
import { EXP_ROOT, REPO_ROOT } from '../paths.mjs';
import { ReportError, writeReport } from '../report.mjs';

export const name = 'report';

export function run(argv) {
  if (argv.length !== 1 || argv[0].startsWith('--')) {
    console.error('usage: exp report <experiment-id>');
    return 2;
  }
  try {
    const res = writeReport({ expRoot: EXP_ROOT, outDir: path.join(REPO_ROOT, 'docs', 'telemetry', 'experiments'), experimentId: argv[0] });
    res.lines.forEach((l) => console.log(l));
    return 0;
  } catch (e) {
    if (e instanceof ReportError) { console.error(e.message); return e.exit; }
    throw e;
  }
}
