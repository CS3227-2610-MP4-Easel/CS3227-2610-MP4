import { EXP_ROOT } from '../paths.mjs';
import { listRows, readAuto } from '../queue.mjs';

export const name = 'queue';

/** `exp queue [--experiment E] [--audit]`: read-only. Run codes, never arm ids. */
export function runWith(argv, expRoot, { log = console.log, err = console.error } = {}) {
  let experimentId;
  let audit = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--audit') audit = true;
    else if (argv[i] === '--experiment' && argv[i + 1]) { experimentId = argv[i + 1]; i += 1; }
    else { err('usage: exp queue [--experiment E] [--audit]'); return 2; }
  }
  if (audit) {
    const rows = readAuto(expRoot);
    if (!rows.length) log('no automatic matches yet');
    for (const r of rows) log(`${r.bank_id}: matched ${r.run_code ?? ''}\n  asked:    ${r.question}\n  in bank:  ${r.bank_question}`);
    return 0;
  }
  const rows = listRows({ expRoot, experimentId });
  if (!rows.length) log('no questions are waiting');
  for (const r of rows) log(`${r.qid}  [${r.codes.join(',')}]  ${r.age_s}s  ${r.text.replace(/\s+/g, ' ')}${r.suggested ? `  (possible duplicate of ${r.suggested}; apply with: exp answer ${r.qid} --same-as ${r.suggested})` : ''}`);
  return 0;
}

export const run = (argv) => runWith(argv, EXP_ROOT);
