'use client';
// The data layer: one function per endpoint of docs/architecture/contracts.md, named with its number.
// Screens call these and nothing else. Linking the backend replaces the bodies with calls to /api
// through the contracts client; the signatures stay. Fixtures are used only inside this folder.
import { StoryPointsSchema } from '@agile/contracts';
import { read, write } from './store';
import { LiveError, openProjectId } from './live';
import { ApiError } from './errors';
import { apiFetch } from './http';
import type {
  Checkpoint,
  CheckpointDraft, EpicPatch, LiveProject, PlanApproved, PlanEpic, PlanProposal,
  Epic,
  LiveCheckpoint,
  LiveCheckpointCreateInput,
  LiveEpic,
  LiveEpicCreateInput,
  LiveMember,
  LiveProgress,
  LiveProjectDetail,
  LiveSprint,
  LiveSprintCloseInput,
  LiveSprintCreateInput,
  LiveSprintPage,
  LiveSprintPatchInput,
  LiveTask,
  LiveTaskCreateInput,
  LiveTaskListFilters,
  LiveTaskStatusInput,
  LiveTaskUpdateInput,
  Page,
  Member,
  ReplanApproval,
  ReplanProposalPage,
  ReplanRejection,
  Sprint,
  Standup,
  Task,
  TaskStatus,
  User,
} from './types';

export { useDb, reset as resetPrototypeData } from './store';
export { isLive, ModeProvider } from './mode';
export * from './types';
export { ApiError } from './errors';
export * as live from './dev';

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const live = <T,>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> => apiFetch<T>(`/api${path}`, { method, body });

// The project of the open page, as an ApiError when the page has none.
const pid = (): string => {
  try {
    return openProjectId();
  } catch (e) {
    throw e instanceof LiveError ? new ApiError(e.code, e.message) : e;
  }
};

// 5: create a project (the creator becomes a member)
export const createProject_5 = (name: string, brief: string) => live<LiveProject>('POST', '/pm/projects', { name, ...(brief.trim() ? { brief } : {}) });
// 6: the projects of the signed-in user, newest first
export const listLiveProjects_6 = () => live<Page<LiveProject>>('GET', '/projects?size=100');
// 7: one project
export const getLiveProject_7 = (id?: string) => live<LiveProject>('GET', `/projects/${id ?? pid()}`);

// 34: draft a plan from an idea
export const createPlan_34 = (idea: string) => live<PlanProposal>('POST', `/pm/projects/${pid()}/plans`, { idea });
// 35: read a proposal
export const getProposal_35 = (id: string) => live<PlanProposal>('GET', `/pm/proposals/${id}`);
// 61: expand all unexpanded epics
export const expandAll_61 = (id: string, version: number) => live<PlanProposal>('POST', `/pm/proposals/${id}/expand`, { version });
// A numeric input must contain digits only; the shared schema validates the range.
export const validPoints = (value: string) => /^\d+$/.test(value) && StoryPointsSchema.safeParse(Number(value)).success;
// 37: expand one epic into tasks
export const expandEpic_37 = (id: string, index: number) => live<PlanEpic>('POST', `/pm/proposals/${id}/epics/${index}/expand`, {});
// 36: earlier proposals of the project, newest first
export const listProposals_36 = (projectId = pid(), page = 0, status?: PlanProposal['status']) => {
  const query = new URLSearchParams({ size: '20', page: String(page) });
  if (status) query.set('status', status);
  return live<Page<PlanProposal>>('GET', `/pm/projects/${projectId}/proposals?${query}`);
};
// 38: edit one epic (title, description, checkpoint, and the whole task list); every edit needs the proposal's version
export const editEpic_38 = (id: string, index: number, version: number, patch: EpicPatch) => live<PlanProposal>('PATCH', `/pm/proposals/${id}/epics/${index}`, { ...patch, version });
// 39: regenerate one expanded epic with the model
export const regenerateEpic_39 = (id: string, index: number, version: number) => live<PlanProposal>('POST', `/pm/proposals/${id}/epics/${index}/regenerate`, { version });
// 58: replace the checkpoint list; `previousName` keeps epics attached to a renamed checkpoint
export const setCheckpoints_58 = (id: string, version: number, checkpoints: CheckpointDraft[]) => live<PlanProposal>('PATCH', `/pm/proposals/${id}/checkpoints`, { checkpoints, version });
// 59: add an epic
export const addEpic_59 = (id: string, version: number, epic: { title: string; description: string; checkpointName: string | null }) => live<PlanProposal>('POST', `/pm/proposals/${id}/epics`, { ...epic, version });
// 60: delete an epic
export const deleteEpic_60 = (id: string, index: number, version: number) => live<PlanProposal>('DELETE', `/pm/proposals/${id}/epics/${index}?version=${version}`);
// 40: approve; creates the checkpoints, epics and tasks
export const approvePlan_40 = (id: string, version: number) => live<PlanApproved>('POST', `/pm/proposals/${id}/approve`, { version });
// 41: reject
export const rejectPlan_41 = (id: string, version: number) => live<PlanProposal>('POST', `/pm/proposals/${id}/reject`, { version });

// 12, 16, 20: what approve created, read back for the live backlog
export const listLiveCheckpoints_12 = (projectId = pid()) => live<LiveCheckpoint[]>('GET', `/projects/${projectId}/checkpoints`);
export const listLiveMembers_9 = (projectId: string) => live<LiveMember[]>('GET', `/projects/${projectId}/members`);
export const listLiveSprints_27 = (projectId: string) => live<LiveSprint[]>('GET', `/projects/${projectId}/sprints`);
export const updateLiveCheckpoint_14 = (id: string, patch: { name?: string; targetDate?: string; version: number }) => live<LiveCheckpoint>('PATCH', `/checkpoints/${id}`, patch);
export const updateLiveEpic_18 = (id: string, patch: { title?: string; description?: string | null; checkpointId?: string | null; version: number }) => live<LiveEpic>('PATCH', `/epics/${id}`, patch);
export const updateLiveTask_23 = (id: string, patch: { title?: string; description?: string | null; acceptanceCriteria?: string[]; storyPoints?: number | null; epicId?: string; assigneeId?: string | null; sprintId?: string | null; version: number }) => live<LiveTask>('PATCH', `/tasks/${id}`, patch);
async function all<T extends { id: string }>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 0; ; page++) {
    const res = await live<Page<T>>('GET', `${path}?size=100&page=${page}`);
    items.push(...res.items);
    if (res.items.length === 0 || items.length >= res.total) return [...new Map(items.map((item) => [item.id, item])).values()];
  }
}
export const listLiveEpics_16 = (projectId = pid()) => all<LiveEpic>(`/projects/${projectId}/epics`);
export const listLiveTasks_20 = (projectId = pid()) => all<LiveTask>(`/projects/${projectId}/tasks`);

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

// W8: Dev Lead facts and digest endpoints.
export async function getFacts_42(projectId: string): Promise<import('./types').Facts> {
  return apiFetch<import('./types').Facts>(`/api/projects/${encodeURIComponent(projectId)}/facts`);
}

export async function createDigest_44(projectId: string): Promise<import('./types').LeadDigest> {
  return apiFetch<import('./types').LeadDigest>(`/api/lead/projects/${encodeURIComponent(projectId)}/digests`, { method: 'POST', body: {} });
}

export async function getLatestDigest_45(projectId: string): Promise<import('./types').LeadDigest> {
  return apiFetch<import('./types').LeadDigest>(`/api/lead/projects/${encodeURIComponent(projectId)}/digests/latest`);
}

// W5: typed live project, planning, membership and progress clients.
const pageParams = (page: number, size: number, filters?: Record<string, string | boolean | undefined>) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  for (const [key, value] of Object.entries(filters ?? {})) if (value !== undefined) params.set(key, String(value));
  return params.toString();
};

export function listProjectsLive_6(page = 0, size = 20): Promise<Page<LiveProjectDetail>> {
  return apiFetch<Page<LiveProjectDetail>>(`/api/projects?${pageParams(page, size)}`);
}

export function getProjectLive_7(projectId: string): Promise<LiveProjectDetail> {
  return apiFetch<LiveProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`).catch(async (error: unknown) => {
    // Some local API builds expose the project collection before the detail route.
    // Keep the live overview usable while that route is being rebuilt.
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    const page = await listProjectsLive_6(0, 100);
    const project = page.items.find((item) => item.id === projectId);
    if (!project) throw error;
    return project;
  });
}

// 8: rename, edit the brief or archive (one way). Archived projects drop out of reads, so callers leave the page afterwards.
export function updateProjectLive_8(projectId: string, patch: { name?: string; brief?: string | null; status?: 'ARCHIVED'; version: number }): Promise<Omit<LiveProjectDetail, 'progress'>> {
  return apiFetch<Omit<LiveProjectDetail, 'progress'>>(`/api/pm/projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: patch });
}

export function readProgressLive_33(projectId: string): Promise<LiveProgress> {
  return apiFetch<LiveProgress>(`/api/projects/${encodeURIComponent(projectId)}/progress`);
}

export async function listMembersLive_9(projectId: string): Promise<LiveMember[]> {
  const members = await apiFetch<LiveMember[]>(`/api/projects/${encodeURIComponent(projectId)}/members`);
  return [...members.reduce((unique, member) => unique.has(member.userId) ? unique : unique.set(member.userId, member), new Map<string, LiveMember>()).values()];
}

// 11: the backend refuses (409) while the member holds open tasks
export function removeMemberLive_11(projectId: string, userId: string): Promise<void> {
  return apiFetch<void>(`/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

// 15, 19, 25: soft deletes under the version guard. An epic delete also deletes its tasks; a DONE task (or an epic holding one) answers 409.
const deleteLive = (path: string, id: string, version: number): Promise<void> => apiFetch<void>(`/api/${path}/${encodeURIComponent(id)}?version=${version}`, { method: 'DELETE' });
export const deleteCheckpointLive_15 = (id: string, version: number) => deleteLive('checkpoints', id, version);
export const deleteEpicLive_19 = (id: string, version: number) => deleteLive('epics', id, version);
export const deleteTaskLive_25 = (id: string, version: number) => deleteLive('tasks', id, version);

export async function addMemberLive_10(projectId: string, email: string): Promise<LiveMember> {
  const added = await apiFetch<LiveMember>(`/api/projects/${encodeURIComponent(projectId)}/members`, { method: 'POST', body: { email } });
  let members: LiveMember[];
  try {
    members = await listMembersLive_9(projectId);
  } catch {
    return added;
  }
  return members.find((member) => member.userId === added.userId) ?? added;
}

export function listCheckpointsLive_12(projectId: string): Promise<LiveCheckpoint[]> {
  return apiFetch<LiveCheckpoint[]>(`/api/projects/${encodeURIComponent(projectId)}/checkpoints`);
}

export function createCheckpointLive_13(projectId: string, input: LiveCheckpointCreateInput): Promise<LiveCheckpoint> {
  return apiFetch<LiveCheckpoint>(`/api/projects/${encodeURIComponent(projectId)}/checkpoints`, {
    method: 'POST',
    body: { name: input.name, targetDate: input.targetDate },
  });
}

export function listEpicsLive_16(projectId: string, page = 0, size = 20): Promise<Page<LiveEpic>> {
  return apiFetch<Page<LiveEpic>>(`/api/projects/${encodeURIComponent(projectId)}/epics?${pageParams(page, size)}`);
}

export function createEpicLive_17(projectId: string, input: LiveEpicCreateInput): Promise<LiveEpic> {
  const body: Record<string, unknown> = { title: input.title };
  if (input.description !== undefined) body.description = input.description;
  if (input.checkpointId !== undefined) body.checkpointId = input.checkpointId;
  return apiFetch<LiveEpic>(`/api/projects/${encodeURIComponent(projectId)}/epics`, { method: 'POST', body });
}

export function listTasksLive_20(projectId: string, page = 0, size = 20, filters?: LiveTaskListFilters): Promise<Page<LiveTask>> {
  const query = filters && { status: filters.status, epicId: filters.epicId, assigneeId: filters.assigneeId, sprintId: filters.sprintId, blocked: filters.blocked };
  return apiFetch<Page<LiveTask>>(`/api/projects/${encodeURIComponent(projectId)}/tasks?${pageParams(page, size, query)}`);
}

export function createTaskLive_21(projectId: string, input: LiveTaskCreateInput): Promise<LiveTask> {
  const body: Record<string, unknown> = {};
  for (const key of ['epicId', 'title', 'description', 'acceptanceCriteria', 'storyPoints', 'assigneeId'] as const) {
    if (input[key] !== undefined) body[key] = input[key];
  }
  return apiFetch<LiveTask>(`/api/projects/${encodeURIComponent(projectId)}/tasks`, { method: 'POST', body });
}

export function getTaskLive_22(taskId: string): Promise<LiveTask> {
  return apiFetch<LiveTask>(`/api/tasks/${encodeURIComponent(taskId)}`);
}

export function updateTaskLive_23(taskId: string, input: LiveTaskUpdateInput): Promise<LiveTask> {
  const body: Record<string, unknown> = {};
  for (const key of ['title', 'description', 'acceptanceCriteria', 'storyPoints', 'assigneeId'] as const) {
    if (input[key] !== undefined) body[key] = input[key];
  }
  body.version = input.version;
  return apiFetch<LiveTask>(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body });
}

export function setTaskStatusLive_24(taskId: string, input: LiveTaskStatusInput): Promise<LiveTask> {
  const body: Record<string, unknown> = { status: input.status };
  if (input.blocked !== undefined) body.blocked = input.blocked;
  if (input.blockedReason !== undefined) body.blockedReason = input.blockedReason;
  body.version = input.version;
  return apiFetch<LiveTask>(`/api/tasks/${encodeURIComponent(taskId)}/status`, { method: 'POST', body });
}

// W14: live sprint lifecycle and paged project progress clients. These names are
// intentionally separate from the fixture helpers above so existing W10 screens
// retain their current behavior while live consumers migrate independently.
export function listSprintsLive_27(projectId: string, page: number, size: number): Promise<LiveSprintPage> {
  return apiFetch<LiveSprintPage>(`/api/projects/${encodeURIComponent(projectId)}/sprints?${pageParams(page, size)}`);
}

export function createSprintLive_28(projectId: string, input: LiveSprintCreateInput): Promise<LiveSprint> {
  return apiFetch<LiveSprint>(`/api/projects/${encodeURIComponent(projectId)}/sprints`, {
    method: 'POST',
    body: { name: input.name, startDate: input.startDate, endDate: input.endDate },
  });
}

export function patchSprintLive_29(sprintId: string, input: LiveSprintPatchInput): Promise<LiveSprint> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.startDate !== undefined) body.startDate = input.startDate;
  if (input.endDate !== undefined) body.endDate = input.endDate;
  body.version = input.version;
  return apiFetch<LiveSprint>(`/api/sprints/${encodeURIComponent(sprintId)}`, { method: 'PATCH', body });
}

export function startSprintLive_30(sprintId: string, version: number): Promise<LiveSprint> {
  return apiFetch<LiveSprint>(`/api/sprints/${encodeURIComponent(sprintId)}/start`, { method: 'POST', body: { version } });
}

export function closeSprintLive_31(sprintId: string, input: LiveSprintCloseInput): Promise<LiveSprint> {
  return apiFetch<LiveSprint>(`/api/sprints/${encodeURIComponent(sprintId)}/close`, {
    method: 'POST',
    body: { version: input.version, carryOver: input.carryOver.map(({ taskId, to }) => ({ taskId, to })) },
  });
}

export function deleteSprintLive_32(sprintId: string, version: number): Promise<void> {
  const query = new URLSearchParams({ version: String(version) });
  return apiFetch<void>(`/api/sprints/${encodeURIComponent(sprintId)}?${query.toString()}`, { method: 'DELETE' });
}

export function listProposalsLive_46(projectId: string, page: number, size: number, status?: ReplanProposalPage['items'][number]['status']): Promise<ReplanProposalPage> {
  const query = pageParams(page, size, status === undefined ? undefined : { status });
  return apiFetch<ReplanProposalPage>(`/api/lead/projects/${encodeURIComponent(projectId)}/proposals?${query}`);
}

export function approveProposalLive(proposalId: string, version: number, suggestionIds: string[]): Promise<ReplanApproval> {
  return apiFetch<ReplanApproval>(`/api/lead/proposals/${encodeURIComponent(proposalId)}/approve`, {
    method: 'POST',
    body: { version, suggestionIds: [...suggestionIds] },
  });
}

export function rejectProposalLive(proposalId: string, version: number): Promise<ReplanRejection> {
  return apiFetch<ReplanRejection>(`/api/lead/proposals/${encodeURIComponent(proposalId)}/reject`, {
    method: 'POST',
    body: { version },
  });
}

export const listProjects_6 = listProjectsLive_6;
export const getProject_7 = getProjectLive_7;
export const getProgressLive_33 = readProgressLive_33;
export const getProgress_33 = readProgressLive_33;

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
      // The ActivityItemInput shape endpoint 49 accepts; the upload panel sends a file's items unchanged.
      items: [
        { type: 'COMMIT', repo: 'menu-app', externalId: '3f9a1c2', title: 'Fix image sizing on small phones', body: 'Scale the menu card below 360 px so the price stays visible.', timestamp: '2026-11-02T17:20:00+08:00', files: ['src/menu/card.css'] },
        { type: 'COMMIT', repo: 'menu-app', externalId: '8b04d7e', title: 'Note that the menu API returns prices in cents', timestamp: '2026-11-02T16:05:00+08:00', files: [] },
        { type: 'PR', repo: 'menu-app', externalId: '42', title: 'Add menu item detail layout', body: 'Detail page with photo, allergens and an add-to-cart button.', timestamp: '2026-11-02T18:40:00+08:00', url: 'https://github.com/example/menu-app/pull/42', files: ['src/menu/detail.tsx', 'src/menu/detail.css'] },
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

// 55: standups of the whole team for one day, newest first (Dev Lead; read only).
export async function listTeamStandups_55(date: string, person?: import('./types').Person): Promise<import('./types').TeamStandup[]> {
  return read().teamStandups.filter((s) => s.date === date && (!person || s.person === person));
}

// 56: the signed-in user's AI sessions with token and cost totals.
export async function listAiSessions_56(): Promise<import('./types').AiSession[]> {
  return read().aiSessions;
}

export type ApiRole = 'PM' | 'DEV_LEAD' | 'DEVELOPER';

// 2: check a registration code (no session yet)
export async function checkCode_2(role: ApiRole, code: string): Promise<void> {
  await apiFetch<unknown>('/api/auth/check-code', { method: 'POST', body: { role, code: code.trim() }, auth: false });
}

// 3: register the signed-in Firebase user with a role code
export async function register_3(role: ApiRole, code: string, displayName: string): Promise<User> {
  return apiFetch<User>('/api/auth/register', { method: 'POST', body: { role, code: code.trim(), displayName: displayName.trim() } });
}

// 4: the signed-in user's profile
export async function me_4(): Promise<User> {
  return apiFetch<User>('/api/me');
}
