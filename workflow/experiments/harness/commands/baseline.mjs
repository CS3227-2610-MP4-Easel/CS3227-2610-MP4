import fs from 'node:fs';
import path from 'node:path';
import { buildBaseline } from '../implbaseline.mjs';
import { EXP_ROOT, REPO_ROOT } from '../paths.mjs';
import { validateTask } from '../schema.mjs';

export const name = 'baseline';

/** `exp baseline <task-id>`: exit 2 for a wrong call, 3 when the task or its base cannot give a baseline. */
export async function run(argv) {
  if (argv.length !== 1 || argv[0].startsWith('-')) {
    console.error('usage: exp baseline <task-id>');
    return 2;
  }
  const file = path.join(EXP_ROOT, 'tasks', argv[0], 'task.json');
  if (!fs.existsSync(file)) { console.error(`task ${argv[0]} does not exist`); return 3; }
  const task = JSON.parse(fs.readFileSync(file, 'utf8'));
  const check = validateTask(task);
  if (!check.ok || task.stage !== 'implementation') {
    console.error(`task ${argv[0]} is not a valid implementation task:\n${[...check.errors, ...(task.stage === 'implementation' ? [] : ['stage must be implementation'])].join('\n')}`);
    return 3;
  }
  const res = await buildBaseline({ expRoot: EXP_ROOT, repoRoot: REPO_ROOT, task });
  for (const line of res.lines) (res.code === 0 ? console.log : console.error)(line);
  return res.code;
}
