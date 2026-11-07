import fs from 'node:fs';
import { UsageError } from '../bank.mjs';
import { EXP_ROOT } from '../paths.mjs';
import { answerItem } from '../queue.mjs';

export const name = 'answer';

const USAGE = 'usage: exp answer <question-id> (<text> | --file <path> | --stdin | --same-as <bank-id>)';

/** Resolve the answer text or the --same-as link from argv; throws UsageError. */
function parse(argv, readStdin) {
  const [qid, ...rest] = argv;
  if (!qid || qid.startsWith('--')) throw new UsageError(USAGE);
  if (rest[0] === '--same-as') {
    if (!rest[1] || rest.length > 2) throw new UsageError(USAGE);
    return { qid, sameAs: rest[1] };
  }
  if (rest[0] === '--file') {
    if (!rest[1] || rest.length > 2) throw new UsageError(USAGE);
    try { return { qid, text: fs.readFileSync(rest[1], 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '') }; } catch { throw new UsageError(`cannot read ${rest[1]}`); }
  }
  if (rest[0] === '--stdin') {
    if (rest.length > 1) throw new UsageError(USAGE);
    return { qid, text: readStdin().replace(/\r\n/g, '\n').replace(/\n$/, '') };
  }
  if (rest.length !== 1) throw new UsageError(USAGE);
  return { qid, text: rest[0] };
}

/** Testable body: returns the exit code. The answer text is never printed (it may be long or private). */
export function runWith(argv, expRoot, { readStdin = () => fs.readFileSync(0, 'utf8'), log = console.log, err = console.error } = {}) {
  try {
    const { qid, ...answer } = parse(argv, readStdin);
    const r = answerItem({ expRoot, qid, ...answer });
    log(`question ${qid} answered with bank entry ${r.entry.id}; ${r.resumable.length} waiting run(s) will resume${r.skipped.length ? `, ${r.skipped.length} run(s) already ended` : ''}`);
    return 0;
  } catch (e) {
    if (e instanceof UsageError) { err(e.message); return e.exit; }
    throw e;
  }
}

export const run = (argv) => runWith(argv, EXP_ROOT);
