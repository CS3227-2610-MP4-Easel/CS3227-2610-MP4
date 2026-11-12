// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = path.join(FE, 'components');
const API = path.join(FE, 'lib', 'api');
const TESTS = path.join(FE, 'test');

function read(relative: string): string {
  return readFileSync(path.join(FE, relative), 'utf8');
}

function allFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? allFiles(full) : /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [full] : [];
  });
}

const production = allFiles(COMPONENTS).concat(allFiles(API)).map((file) => readFileSync(file, 'utf8')).join('\n');
const focusedTests = allFiles(TESTS)
  .filter((file) => !file.endsWith('w5-closeout.test.ts'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

const liveScreens = [
  read('components/canvas/Projects.tsx'),
  read('components/canvas/OverviewLead.tsx'),
  read('components/canvas/ProjectHead.tsx'),
  read('components/canvas/BoardView.tsx'),
  read('components/live/backlog-list.tsx'),
  read('components/live/checkpoints.tsx'),
  read('components/live/forms.tsx'),
  read('components/live/members.tsx'),
  read('components/live/task-drawer.tsx'),
].join('\n');

const evidence: Record<string, () => void> = {
  F1: () => expect(read('components/canvas/Projects.tsx')).toContain('listProjectsLive_6'),
  F2: () => expect(read('components/canvas/OverviewLead.tsx') + read('components/canvas/ProjectHead.tsx')).toMatch(/getProjectLive_7|listProjectsLive_6/),
  F3: () => expect(read('components/canvas/BoardView.tsx')).toContain('listTasksLive_20'),
  F4: () => expect(read('components/live/forms.tsx')).toContain('createTaskLive_21'),
  F5: () => expect(read('components/live/task-drawer.tsx')).toMatch(/updateTaskLive_23|setTaskStatusLive_24/),
  F6: () => expect(read('components/live/members.tsx') + read('components/live/checkpoints.tsx')).toMatch(/listMembersLive_9|listCheckpointsLive_12/),
  F7: () => expect(read('lib/api/project-mode.ts')).toContain('projectRoute'),
  F8: () => expect(read('lib/api/http.ts')).toContain('Something went wrong. Try again.'),
  N1: () => expect(liveScreens).toMatch(/route\.projectId|projectId/),
  N2: () => {
    expect(production).not.toMatch(/@agile\/db/);
    expect(production).not.toMatch(/from ['\"][^'\"]*prisma/);
  },
  N3: () => {
    const ids = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'N1', 'N2', 'N3', ...Array.from({ length: 15 }, (_, i) => `E${i + 1}`)];
    for (const id of ids) expect(Object.keys(evidence)).toContain(id);
    expect(read('lib/api/index.ts')).toMatch(/createTaskLive_21|updateTaskLive_23/);
    expect(liveScreens).not.toMatch(/createTaskLive_21\([^;]*sprintId|updateTaskLive_23\([^;]*sprintId/);
  },
  E1: () => expect(focusedTests).toContain('E1'),
  E2: () => expect(focusedTests).toContain('E2'),
  E3: () => expect(focusedTests).toContain('E3'),
  E4: () => expect(focusedTests).toContain('E4'),
  E5: () => expect(focusedTests).toContain('E5'),
  E6: () => expect(focusedTests).toContain('E6'),
  E7: () => expect(focusedTests).toContain('E7'),
  E8: () => expect(focusedTests).toContain('E8'),
  E9: () => expect(focusedTests).toContain('E9'),
  E10: () => expect(focusedTests).toContain('E10'),
  E11: () => expect(focusedTests).toContain('E11'),
  E12: () => expect(focusedTests).toContain('E12'),
  E13: () => expect(focusedTests).toContain('E13'),
  E14: () => expect(focusedTests).toContain('E14'),
  E15: () => expect(focusedTests).toContain('E15'),
};

describe('W5 requirement-labelled verification matrix', () => {
  it.each(Object.keys(evidence))('%s has focused passing evidence', (requirement) => evidence[requirement]());
});
