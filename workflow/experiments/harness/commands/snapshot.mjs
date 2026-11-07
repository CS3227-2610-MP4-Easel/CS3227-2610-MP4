import { EXP_ROOT } from '../paths.mjs';
import { snapshotRun } from '../snapshot.mjs';

export const name = 'snapshot';

/** `exp snapshot <run-id>... [--accept-findings]`: exit 2 refused, 9 credential pattern; the worst code of all runs wins. */
export function run(argv) {
  const acceptFindings = argv.includes('--accept-findings');
  const ids = argv.filter((a) => a !== '--accept-findings');
  if (ids.length === 0 || ids.some((a) => a.startsWith('-'))) {
    console.error('usage: exp snapshot <run-id>... [--accept-findings]');
    return 2;
  }
  let code = 0;
  for (const runId of ids) {
    const res = snapshotRun({ expRoot: EXP_ROOT, runId, acceptFindings });
    for (const line of res.lines) console.log(line);
    code = Math.max(code, res.code);
  }
  return code;
}
