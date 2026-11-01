'use client';
// The data layer: one function per endpoint of docs/architecture/contracts.md, named with its number.
// Screens call these and nothing else. Linking the backend replaces the bodies with calls to /api
// through the contracts client; the signatures stay. Fixtures are used only inside this folder.
import { read, write } from './store';
import type { Checkpoint, Epic, Member, Sprint, Standup, Task, TaskStatus } from './types';

export { useDb, reset as resetPrototypeData } from './store';
export * from './types';

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// 8: archive the project
export async function archiveProject_8(): Promise<void> {
  await wait();
  write((d) => {
    d.project.status = 'ARCHIVED';
    d.project.version++;
  });
}

// 9: members
export async function listMembers_9(): Promise<Member[]> {
  return read().members;
}

// 10: add a member by email (who may add whom is enforced by the backend)
export async function addMember_10(email: string, role: Member['role']): Promise<Member> {
  await wait();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('VALIDATION', 'Enter a valid email address.');
  const name = email
    .split('@')[0]
    .split('.')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
  const m: Member = { id: 'u' + (read().members.length + 1), name, email: email.toLowerCase(), role };
  write((d) => {
    d.members.push(m);
  });
  return m;
}

// 11: remove a member; the backend refuses while they hold open tasks
export async function removeMember_11(id: string): Promise<void> {
  await wait();
  write((d) => {
    d.members = d.members.filter((m) => m.id !== id);
  });
}

// 13: add a checkpoint
export async function addCheckpoint_13(name: string, targetDate: string): Promise<Checkpoint> {
  await wait();
  const c: Checkpoint = { id: 'c' + (read().checkpoints.length + 1), name, targetDate };
  write((d) => {
    d.checkpoints.push(c);
    d.checkpoints.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  });
  return c;
}

// 16 and 17: epics
export async function listEpics_16(): Promise<Epic[]> {
  return read().epics;
}
export async function createEpic_17(title: string, description: string, checkpointId: string | null): Promise<Epic> {
  await wait();
  if (!title.trim()) throw new ApiError('VALIDATION', 'Title is required.');
  if (read().epics.some((e) => e.title.toLowerCase() === title.trim().toLowerCase())) throw new ApiError('VALIDATION', 'An epic with that title already exists.');
  const e: Epic = { id: 'e' + (read().epics.length + 1), title: title.trim(), description, checkpointId };
  write((d) => {
    d.epics.push(e);
  });
  return e;
}

// 21: create a task
export async function createTask_21(input: { epicId: string; title: string; description: string; criteria: string[]; points: number | null; assignee: Task['assignee'] }): Promise<Task> {
  await wait();
  if (!input.title.trim()) throw new ApiError('VALIDATION', 'Title is required.');
  const epic = read().epics.find((e) => e.id === input.epicId);
  if (!epic) throw new ApiError('VALIDATION', 'Pick an epic.');
  const t: Task = { id: 't' + (read().tasks.length + 1), epic: epic.title, title: input.title.trim(), points: input.points, assignee: input.assignee, status: 'todo', blockedReason: '', sprintId: null, description: input.description, criteria: input.criteria.filter(Boolean), version: 1 };
  write((d) => {
    d.tasks.push(t);
  });
  return t;
}

// 20: tasks
export async function listTasks_20(): Promise<Task[]> {
  return read().tasks;
}

// 22 and 23 and 25: read, edit and delete a task
export async function getTask_22(id: string): Promise<Task | undefined> {
  return read().tasks.find((t) => t.id === id);
}
export async function updateTask_23(id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'points' | 'assignee' | 'criteria'>>): Promise<Task> {
  await wait(150);
  if (patch.title !== undefined && !patch.title.trim()) throw new ApiError('VALIDATION', 'Title is required.');
  let out: Task | undefined;
  write((d) => {
    const t = d.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    t.version++;
    out = t;
  });
  if (!out) throw new ApiError('NOT_FOUND', 'Task not found.');
  return out;
}
export async function deleteTask_25(id: string): Promise<void> {
  await wait(150);
  if (read().tasks.find((t) => t.id === id)?.status === 'done') throw new ApiError('CONFLICT_STATE', 'A done task cannot be deleted.');
  write((d) => {
    d.tasks = d.tasks.filter((t) => t.id !== id);
  });
}

// 24: change a task's status or blocked flag
export async function setTaskStatus_24(id: string, status: TaskStatus, blockedReason?: string): Promise<Task> {
  await wait(120);
  let out: Task | undefined;
  write((d) => {
    const t = d.tasks.find((x) => x.id === id);
    if (!t) return;
    t.status = status;
    if (blockedReason !== undefined) t.blockedReason = blockedReason;
    t.version++;
    out = t;
  });
  if (!out) throw new ApiError('NOT_FOUND', 'Task not found.');
  return out;
}

// 27: sprints
export async function listSprints_27(): Promise<Sprint[]> {
  return read().sprints;
}

// 30: start a sprint; only one may be active
export async function startSprint_30(id: string): Promise<Sprint> {
  await wait();
  if (read().sprints.some((s) => s.status === 'ACTIVE')) throw new ApiError('CONFLICT_STATE', 'Another sprint is active.');
  let out: Sprint | undefined;
  write((d) => {
    const s = d.sprints.find((x) => x.id === id);
    if (!s) return;
    s.status = 'ACTIVE';
    s.version++;
    out = s;
  });
  if (!out) throw new ApiError('NOT_FOUND', 'Sprint not found.');
  return out;
}

// 31: close the active sprint; unfinished tasks carry over to the next planned sprint (C~8), else the backlog
export async function closeSprint_31(id: string): Promise<{ carried: number; to: string }> {
  await wait(400);
  let carried = 0;
  let to = 'the backlog';
  write((d) => {
    const s = d.sprints.find((x) => x.id === id);
    if (!s) return;
    s.status = 'CLOSED';
    s.version++;
    const next = d.sprints.filter((x) => x.status === 'PLANNED').sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    if (next) to = next.name;
    d.tasks.forEach((t) => {
      if (t.sprintId === id && t.status !== 'done') {
        t.sprintId = next ? next.id : null;
        carried++;
      }
    });
  });
  return { carried, to };
}

// 32: delete a planned sprint; its tasks go back to the backlog
export async function deleteSprint_32(id: string): Promise<void> {
  await wait();
  write((d) => {
    d.sprints = d.sprints.filter((s) => s.id !== id);
    d.tasks.forEach((t) => {
      if (t.sprintId === id) t.sprintId = null;
    });
  });
}

// 28: create a sprint
export async function createSprint_28(name: string, startDate: string, endDate: string): Promise<Sprint> {
  await wait();
  if (endDate < startDate) throw new ApiError('VALIDATION', 'The end date is before the start date.');
  const clash = read().sprints.find((s) => s.status !== 'CLOSED' && startDate <= s.endDate && endDate >= s.startDate);
  if (clash) throw new ApiError('CONFLICT_STATE', 'Dates overlap sprint ' + clash.name + '.');
  const sp: Sprint = { id: 's' + (read().sprints.length + 1), name, status: 'PLANNED', startDate, endDate, version: 1 };
  write((d) => {
    d.sprints.push(sp);
  });
  return sp;
}

// 44: refresh the digest (a cached digest comes back when the facts are unchanged)
export async function refreshDigest_44(): Promise<{ cached: boolean }> {
  await wait(700);
  const cached = read().digest.cached;
  write((d) => {
    d.digest.generatedAt = new Date().toISOString();
    d.digest.cached = true;
  });
  return { cached };
}

// 47 and 48: apply or dismiss re-plan suggestions
export async function applySuggestions_47(ids: string[]): Promise<number> {
  await wait();
  write((d) =>
    d.suggestions.forEach((s) => {
      if (ids.includes(s.id) && s.state === 'PENDING') s.state = 'APPLIED';
    }),
  );
  return ids.length;
}
export async function dismissSuggestions_48(): Promise<void> {
  await wait();
  write((d) =>
    d.suggestions.forEach((s) => {
      if (s.state === 'PENDING') s.state = 'DISMISSED';
    }),
  );
}

// 50: retry the failed summaries
export async function retrySummaries_50(): Promise<void> {
  await wait(800);
  write((d) => {
    d.summariesMissing = 0;
  });
}

// 51 and 52: generate and read my standup
export async function generateStandup_51(): Promise<Standup> {
  await wait(900);
  write((d) => {
    d.standup.outcome = 'GENERATED';
    d.standup.today = [...d.standup.today].reverse();
  });
  return read().standup;
}
export async function getMyStandup_52(): Promise<Standup> {
  return read().standup;
}

// 53 and 54: save an edit, accept as written
export async function saveStandup_53(lines: { yesterday: string[]; today: string[]; blockers: string[] }): Promise<Standup> {
  await wait(200);
  write((d) => {
    Object.assign(d.standup, lines, { outcome: 'EDITED' as const });
  });
  return read().standup;
}
export async function acceptStandup_54(): Promise<Standup> {
  await wait(200);
  write((d) => {
    d.standup.outcome = 'ACCEPTED';
  });
  return read().standup;
}

export function exampleActivityFile_49(): string {
  return JSON.stringify(
    {
      items: [
        { kind: 'COMMIT', text: 'Fix image sizing on small phones', at: '2026-11-02T17:20:00+08:00' },
        { kind: 'NOTE', text: 'Menu API returns prices in cents', at: '2026-11-02T16:05:00+08:00' },
      ],
    },
    null,
    2,
  );
}

// 33: progress and velocity, derived from the tasks and sprints (the backend computes this)
export function progressOf(d: import('./types').Db) {
  const pointsTotal = d.tasks.reduce((a, t) => a + (t.points || 0), 0);
  const pointsDone = d.tasks.filter((t) => t.status === 'done').reduce((a, t) => a + (t.points || 0), 0);
  const velocity = d.sprints
    .filter((s) => s.status === 'CLOSED')
    .map((s) => ({ name: s.name, points: d.tasks.filter((t) => t.sprintId === s.id && t.status === 'done').reduce((a, t) => a + (t.points || 0), 0) }));
  return {
    pointsTotal,
    pointsDone,
    percent: pointsTotal ? Math.round((pointsDone / pointsTotal) * 100) : 0,
    unestimatedTasks: d.tasks.filter((t) => t.points == null && t.status !== 'done').length,
    velocity,
  };
}

// 12 and 33: checkpoint risk, derived from the remaining points of the linked epics against velocity.
// A sprint is two weeks. With no closed sprint there is no velocity, so the forecast is unknown.
const DAY = 86400000;
export type RiskRow = { checkpoint: import('./types').Checkpoint; remaining: number; projected: string | null; risk: 'ok' | 'warn' | 'bad' | 'unknown'; epics: string[] };

export function healthOf(d: import('./types').Db, today = '2026-11-02') {
  const p = progressOf(d);
  const last = p.velocity.slice(-3);
  const avg = last.length ? Math.round(last.reduce((a, v) => a + v.points, 0) / last.length) : 0;
  const open = d.tasks.filter((t) => t.status !== 'done');
  const remainingAll = open.reduce((a, t) => a + (t.points || 0), 0);
  const weeks = (pts: number) => (avg > 0 ? Math.ceil(pts / avg) * 14 : null);
  const at = (days: number | null) => (days == null ? null : new Date(new Date(today).getTime() + days * DAY).toISOString().slice(0, 10));
  const rows: RiskRow[] = d.checkpoints.map((c) => {
    const eps = d.epics.filter((e) => e.checkpointId === c.id);
    const remaining = open.filter((t) => eps.some((e) => e.title === t.epic)).reduce((a, t) => a + (t.points || 0), 0);
    const projected = at(weeks(remaining));
    const risk = projected == null ? 'unknown' : projected <= c.targetDate ? 'ok' : (new Date(projected).getTime() - new Date(c.targetDate).getTime()) / DAY > 14 ? 'bad' : 'warn';
    return { checkpoint: c, remaining, projected, risk, epics: eps.map((e) => e.title) };
  });
  const byPerson = new Map<string, number>();
  open.forEach((t) => t.assignee && byPerson.set(t.assignee, (byPerson.get(t.assignee) || 0) + (t.points || 0)));
  const overload = [...byPerson.entries()].filter(([, pts]) => pts > Math.max(avg, 8)).map(([who, pts]) => ({ who, pts }));
  return { progress: p, avg, closed: p.velocity.length, remainingAll, projectedAll: at(weeks(remainingAll)), rows, atRisk: rows.filter((r) => r.risk === 'warn' || r.risk === 'bad').length, overload };
}
