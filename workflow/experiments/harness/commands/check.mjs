import { runCheck } from '../check.mjs';

export const name = 'check';

export function run(argv) {
  const { code, lines } = runCheck({ secrets: argv.includes('--secrets') });
  for (const line of lines) console.log(line);
  return code;
}
