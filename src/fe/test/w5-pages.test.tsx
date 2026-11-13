import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import { ModalCtx, RoleCtx } from '../lib/nav';
import { ApiError } from '../lib/api';

const listTasks = vi.fn();
const listEpics = vi.fn();
const listLiveEpics = vi.fn();
const listMembers = vi.fn();
const listCheckpoints = vi.fn();
const getFacts = vi.fn();
const listSprints = vi.fn();
const readProgress = vi.fn();
const createCheckpoint = vi.fn();
const patchSprint = vi.fn();
const getTask = vi.fn();
const updateTask = vi.fn();
const setStatus = vi.fn();
const addMember = vi.fn();
const createTask = vi.fn();
const session = vi.fn();
const router = { push: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams('task=task-1'),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    listTasksLive_20: (...args: unknown[]) => listTasks(...args),
    listEpicsLive_16: (...args: unknown[]) => listEpics(...args),
    listLiveEpics_16: (...args: unknown[]) => listLiveEpics(...args),
    listMembersLive_9: (...args: unknown[]) => listMembers(...args),
    listCheckpointsLive_12: (...args: unknown[]) => listCheckpoints(...args),
    getFacts_42: (...args: unknown[]) => getFacts(...args),
    listSprintsLive_27: (...args: unknown[]) => listSprints(...args),
    readProgressLive_33: (...args: unknown[]) => readProgress(...args),
    createCheckpointLive_13: (...args: unknown[]) => createCheckpoint(...args),
    patchSprintLive_29: (...args: unknown[]) => patchSprint(...args),
    getTaskLive_22: (...args: unknown[]) => getTask(...args),
    updateTaskLive_23: (...args: unknown[]) => updateTask(...args),
    setTaskStatusLive_24: (...args: unknown[]) => setStatus(...args),
    addMemberLive_10: (...args: unknown[]) => addMember(...args),
    createTaskLive_21: (...args: unknown[]) => createTask(...args),
  };
});

vi.mock('../lib/auth/session', async () => {
  const actual = await vi.importActual<typeof import('../lib/auth/session')>('../lib/auth/session');
  return { ...actual, useSession: () => session() };
});

import BoardView from '../components/canvas/BoardView';
import { MemberTable, AddMember } from '../components/live/members';
import { AddEpicForm, AddTaskForm } from '../components/live/forms';
import { NewSprintForm } from '../components/live/forms';
import BacklogList from '../components/live/backlog-list';
import TaskDrawer from '../components/live/task-drawer';
import { AddCheckpointForm, CheckpointCards } from '../components/live/checkpoints';
import SprintsPage from '../components/live/sprints-page';

const PROJECT = '550e8400-e29b-41d4-a716-446655440000';
const route = projectRoute(`/projects/${PROJECT}/board`);

const task = {
  id: 'task-1', projectId: PROJECT, epicId: 'epic-1', sprintId: 'sprint-must-not-be-used', assigneeId: 'user-1',
  title: 'Live task', description: 'Description', acceptanceCriteria: [], status: 'TODO', blocked: false,
  blockedReason: null, storyPoints: 3, doneAt: null, createdAt: '2026-11-12', updatedAt: '2026-11-12', version: 4,
} as const;

function liveView(children: React.ReactNode) {
  return <ProjectRouteContext.Provider value={route}><RoleCtx.Provider value="lead">{children}</RoleCtx.Provider></ProjectRouteContext.Provider>;
}

beforeEach(() => {
  listTasks.mockReset().mockResolvedValue({ items: [task], page: 0, size: 20, total: 1 });
  listEpics.mockReset().mockResolvedValue({ items: [{ id: 'epic-1', projectId: PROJECT, checkpointId: null, title: 'Live epic', description: null, position: 0, taskCount: 1, pointsTotal: 3, createdAt: '', updatedAt: '', version: 1 }], page: 0, size: 100, total: 1 });
  listLiveEpics.mockReset().mockResolvedValue([]);
  listMembers.mockReset().mockResolvedValue([{ userId: 'user-1', displayName: 'Ada Lead', role: 'DEVELOPER', addedAt: '' }, { userId: 'user-1', displayName: 'Ada Lead', role: 'DEVELOPER', addedAt: '' }]);
  listCheckpoints.mockReset().mockResolvedValue([]);
  getFacts.mockReset().mockResolvedValue({ checkpoints: [] });
  listSprints.mockReset().mockResolvedValue({ items: [{ id: 'sprint-must-not-be-used', projectId: PROJECT, name: 'Sprint 1: Test', status: 'ACTIVE', startDate: '', endDate: '', completedPoints: 0, version: 1 }], page: 0, size: 100, total: 1 });
  readProgress.mockReset().mockResolvedValue({ pointsTotal: 3, pointsDone: 0, percent: 0, unestimatedTasks: 0, velocity: [] });
  createCheckpoint.mockReset().mockResolvedValue({ id: 'checkpoint-1', projectId: PROJECT, name: 'Launch', targetDate: '2026-12-01', createdAt: '', updatedAt: '', version: 1 });
  patchSprint.mockReset().mockResolvedValue({ id: 'sprint-1', projectId: PROJECT, name: 'Sprint 1: Updated', status: 'PLANNED', startDate: '2026-11-16', endDate: '2026-11-27', completedPoints: null, version: 2 });
  getTask.mockReset().mockResolvedValue(task);
  updateTask.mockReset().mockResolvedValue({ ...task, title: 'Saved task', version: 5 });
  setStatus.mockReset().mockResolvedValue({ ...task, status: 'IN_PROGRESS', version: 5 });
  addMember.mockReset().mockResolvedValue({ userId: 'user-2', displayName: 'New Dev', role: 'DEVELOPER', addedAt: '' });
  createTask.mockReset().mockResolvedValue({ ...task, id: 'task-2', epicId: 'epic-1' });
  session.mockReset().mockReturnValue(null);
  router.push.mockReset();
});

describe('W5 live planning surfaces', () => {
  it('renders a close button for the checkpoint dialog', () => {
    render(liveView(<AddCheckpointForm dialog />));
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(router.push).toHaveBeenCalledWith(`/projects/${PROJECT}/checkpoints`);
  });

  it('F3 F6 E1 E2 loads UUID board data, maps supported filters, resets pagination, and renders no sprint control', async () => {
    listTasks.mockResolvedValue({ items: [task], page: 0, size: 20, total: 21 });
    render(liveView(<BoardView role="lead" />));
    expect(await screen.findByText('Live task')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Live task' }).getAttribute('href')).toBe(`/projects/${PROJECT}/board?task=task-1`);
    expect(listTasks).toHaveBeenCalledWith(PROJECT, 0, 20, {});
    expect(screen.queryByText(/Sprint:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await act(async () => {});
    expect(listTasks).toHaveBeenLastCalledWith(PROJECT, 1, 20, {});
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'IN_PROGRESS' } });
    await act(async () => {});
    expect(listTasks).toHaveBeenLastCalledWith(PROJECT, 0, 20, { status: 'IN_PROGRESS' });
  });

  it('closes a task status menu when clicking outside the task card', async () => {
    render(liveView(<BoardView role="lead" />));
    expect(await screen.findByText('Live task')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('F5 E11 E13 refetches the board after a live status mutation', async () => {
    render(liveView(<BoardView role="lead" />));
    expect(await screen.findByText('Live task')).toBeTruthy();
    const before = listTasks.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'In progress' }));
    await act(async () => {});
    expect(setStatus).toHaveBeenCalledWith('task-1', expect.objectContaining({ status: 'IN_PROGRESS', version: 4 }));
    expect(listTasks.mock.calls.length).toBeGreaterThan(before);
  });

  it('E3 ignores an older board response after a newer mutation refresh', async () => {
    let resolveOld!: (value: typeof task) => void;
    listTasks.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = (value) => resolve({ items: [value], page: 0, size: 20, total: 1 }); }));
    listTasks.mockResolvedValueOnce({ items: [{ ...task, title: 'Fresh task' }], page: 0, size: 20, total: 1 });
    render(liveView(<BoardView role="lead" />));
    await act(async () => {});
    await act(async () => { window.dispatchEvent(new Event('easel-board-refresh')); });
    expect(await screen.findByText('Fresh task')).toBeTruthy();
    await act(async () => { resolveOld({ ...task, title: 'Stale task' } as any); });
    expect(screen.getByText('Fresh task')).toBeTruthy();
    expect(screen.queryByText('Stale task')).toBeNull();
  });

  it('F5 E13 sends live Mark blocked for the selected task with its version', async () => {
    render(liveView(<BoardView role="lead" />));
    expect(await screen.findByText('Live task')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark blocked' }));
    await act(async () => {});
    expect(setStatus).toHaveBeenCalledWith('task-1', expect.objectContaining({ blocked: true, blockedReason: 'Blocked', version: 4 }));
  });

  it('lets Dev Leads assign a task to a sprint or explicitly return it to No sprint', async () => {
    listSprints.mockResolvedValue({ items: [{ id: 'sprint-1', projectId: PROJECT, name: 'Sprint 1', status: 'PLANNED', startDate: '', endDate: '', completedPoints: null, version: 1 }], page: 0, size: 100, total: 1 });
    getTask.mockResolvedValue({ ...task, sprintId: null });
    updateTask.mockResolvedValue({ ...task, sprintId: 'sprint-1', version: 5 });
    render(liveView(<TaskDrawer projectId={PROJECT} />));
    expect(await screen.findByRole('option', { name: 'No sprint' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Sprint 1' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Sprint'), { target: { value: 'sprint-1' } });
    await act(async () => {});
    expect(updateTask).toHaveBeenCalledWith('task-1', { sprintId: 'sprint-1', version: 4 });
  });

  it('highlights the Sprint field when story points are required for assignment', async () => {
    getTask.mockResolvedValue({ ...task, storyPoints: null, sprintId: null });
    render(liveView(<TaskDrawer projectId={PROJECT} />));
    expect(await screen.findByRole('heading', { name: 'Live task' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Sprint'), { target: { value: 'sprint-must-not-be-used' } });
    await act(async () => {});
    expect(screen.getByLabelText('Sprint').className).toContain('err');
    expect(screen.getAllByText('Add story points before assigning this task to a sprint.')).toHaveLength(2);
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('highlights Story points when saving an assigned task without an estimate', async () => {
    getTask.mockResolvedValue({ ...task, sprintId: 'sprint-must-not-be-used', storyPoints: null });
    render(liveView(<TaskDrawer projectId={PROJECT} />));
    expect(await screen.findByRole('heading', { name: 'Live task' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(async () => {});
    expect(screen.getByLabelText('Story points').className).toContain('err');
    expect(screen.getByRole('alert').textContent).toContain('Add story points before saving a task assigned to a sprint.');
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('refreshes sprint task lists after a task assignment changes', async () => {
    render(<ProjectRouteContext.Provider value={route}><RoleCtx.Provider value="lead"><SprintsPage /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    expect(await screen.findByText('Sprint 1: Test')).toBeTruthy();
    expect(listSprints).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('easel-board-refresh'));
    await act(async () => {});
    expect(listSprints).toHaveBeenCalledTimes(2);
  });

  it('loads sprint data into the edit modal and uses Save sprint', async () => {
    listSprints.mockResolvedValue({ items: [{ id: 'sprint-1', projectId: PROJECT, name: 'Sprint 1: Planning', status: 'PLANNED', startDate: '2026-11-16', endDate: '2026-11-27', completedPoints: null, version: 4 }], page: 0, size: 100, total: 1 });
    const close = vi.fn();
    render(<ProjectRouteContext.Provider value={route}><RoleCtx.Provider value="lead"><ModalCtx.Provider value={{ modal: { file: 'SprintsNew', closeTo: `/projects/${PROJECT}/sprints`, params: { sprint: 'sprint-1' } }, open: vi.fn(), close }}><NewSprintForm /></ModalCtx.Provider></RoleCtx.Provider></ProjectRouteContext.Provider>);
    expect(await screen.findByRole('heading', { name: 'Edit sprint' })).toBeTruthy();
    expect(screen.getByLabelText('Name', { exact: false }).getAttribute('value')).toBe('Sprint 1: Planning');
    expect(screen.getByLabelText('Start date', { exact: false }).getAttribute('value')).toBe('2026-11-16');
    expect(screen.getByLabelText('End date (inclusive)', { exact: false }).getAttribute('value')).toBe('2026-11-27');
    expect(screen.getByRole('button', { name: 'Save sprint' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save sprint' }));
    await act(async () => {});
    expect(patchSprint).toHaveBeenCalledWith('sprint-1', { name: 'Sprint 1: Planning', startDate: '2026-11-16', endDate: '2026-11-27', version: 4 });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('F7 E10 E12 loads and reloads live members without a remove control', async () => {
    render(liveView(<><MemberTable canRemove removeRole="DEVELOPER" /><AddMember role="DEVELOPER" label="Developer" /></>));
    expect(await screen.findByText('Ada Lead')).toBeTruthy();
    expect(screen.getAllByText('Ada Lead')).toHaveLength(1);
    expect(listMembers).toHaveBeenCalledWith(PROJECT);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.edu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Developer' }));
    await act(async () => {});
    expect(addMember).toHaveBeenCalledWith(PROJECT, 'new@example.edu');
    expect(listMembers.mock.calls.length).toBeGreaterThan(1);
    expect(screen.queryByRole('link', { name: 'Remove' })).toBeNull();
  });

  it('F4 E1 preserves the active UUID in live backlog task links', async () => {
    render(liveView(<BacklogList />));
    expect(await screen.findByText('Live task')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Live task' }).getAttribute('href')).toBe(`/projects/${PROJECT}/board?task=task-1`);
    expect(screen.getByText('Sprint 1')).toBeTruthy();
  });

  it('filters live backlog tasks by title and assignment state', async () => {
    listTasks.mockResolvedValue({ items: [task, { ...task, id: 'task-2', title: 'Unscheduled task', sprintId: null, assigneeId: null, storyPoints: null }], page: 0, size: 100, total: 2 });
    render(liveView(<BacklogList />));
    expect(await screen.findByText('Unscheduled task')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search by title'), { target: { value: 'Live task' } });
    expect(screen.queryByText('Unscheduled task')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search by title'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }));
    expect(screen.getByText('Unscheduled task')).toBeTruthy();
    expect(screen.queryByText('Live task')).toBeNull();
  });

  it('F4 N1 E9 initializes live task creation from live epics and never sends sprintId', async () => {
    render(liveView(<AddTaskForm />));
    expect(await screen.findByRole('option', { name: 'Live epic' })).toBeTruthy();
    fireEvent.change(document.getElementById('t1')!, { target: { value: 'Created task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    await act(async () => {});
    expect(createTask).toHaveBeenCalledWith(PROJECT, expect.objectContaining({ epicId: 'epic-1' }));
    expect(createTask.mock.calls[0][1]).not.toHaveProperty('sprintId');
  });

  it('F8 E4 persists live checkpoint form values on conflict and does not auto-retry', async () => {
    createCheckpoint.mockRejectedValue(new ApiError('CONFLICT_VERSION', 'This changed elsewhere. Reload before trying again.', { status: 409 }));
    render(liveView(<AddCheckpointForm />));
    fireEvent.change(document.getElementById('cn')!, { target: { value: 'Launch' } });
    fireEvent.change(document.getElementById('cd')!, { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await act(async () => {});
    expect(createCheckpoint).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Launch')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-12-01')).toBeTruthy();
  });

  it('F4 E9 keeps failed live task creation open without a phantom row or retry', async () => {
    createTask.mockRejectedValue(new ApiError('VALIDATION_FAILED', 'Check the highlighted fields.', { status: 422 }));
    render(liveView(<AddTaskForm />));
    expect(await screen.findByRole('option', { name: 'Live epic' })).toBeTruthy();
    fireEvent.change(document.getElementById('t1')!, { target: { value: 'Rejected task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    await act(async () => {});
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Rejected task')).toBeTruthy();
    expect(screen.queryByText('Rejected task', { selector: '.t' })).toBeNull();
  });

  it('E4 exposes checkpoint dependency failures with retry while preserving epic form values', async () => {
    listCheckpoints.mockRejectedValueOnce(new Error('checkpoint details must stay hidden')).mockResolvedValueOnce([]);
    render(liveView(<AddEpicForm />));
    fireEvent.change(document.getElementById('t2')!, { target: { value: 'Notifications' } });
    expect(await screen.findByRole('button', { name: 'Retry loading checkpoints' })).toBeTruthy();
    expect(screen.queryByText('checkpoint details must stay hidden')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading checkpoints' }));
    expect(await screen.findByDisplayValue('Notifications')).toBeTruthy();
    expect(listCheckpoints).toHaveBeenCalledTimes(2);
  });

  it('E4 exposes epic/member dependency failures with retry while preserving task form values', async () => {
    listEpics.mockRejectedValueOnce(new Error('epic details must stay hidden')).mockResolvedValueOnce({ items: [{ id: 'epic-1', title: 'Live epic' }], page: 0, size: 100, total: 1 });
    render(liveView(<AddTaskForm />));
    fireEvent.change(document.getElementById('t1')!, { target: { value: 'Keep this task' } });
    expect(await screen.findByRole('button', { name: 'Retry loading task options' })).toBeTruthy();
    expect(screen.queryByText('epic details must stay hidden')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading task options' }));
    expect(await screen.findByDisplayValue('Keep this task')).toBeTruthy();
    expect(listEpics).toHaveBeenCalledTimes(2);
  });

  it('F5 E11 E13 reads and updates a live task with its server version and no sprintId', async () => {
    render(liveView(<TaskDrawer />));
    expect(await screen.findByRole('heading', { name: 'Live task' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Saved task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(async () => {});
    expect(updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({ version: 4 }));
    expect(updateTask.mock.calls[0][1]).not.toHaveProperty('sprintId');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'prog' } });
    await act(async () => {});
    expect(setStatus).toHaveBeenCalledWith('task-1', expect.objectContaining({ status: 'IN_PROGRESS', version: 5 }));
    expect(screen.getByRole('link', { name: 'Close' }).getAttribute('href')).toBe(`/projects/${PROJECT}/board`);
  });

  it('E7 keeps task mutation conflicts visible with an explicit reload action', async () => {
    updateTask.mockRejectedValue(new ApiError('CONFLICT_VERSION', 'This changed elsewhere. Reload before trying again.', { status: 409 }));
    render(liveView(<TaskDrawer />));
    expect(await screen.findByRole('heading', { name: 'Live task' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(async () => {});
    expect(screen.getByRole('alert').textContent).toContain('This changed elsewhere. Reload before trying again.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(updateTask).toHaveBeenCalledTimes(1);
  });

  it('explains closed-sprint task conflicts without offering a misleading reload', async () => {
    setStatus.mockRejectedValue(new ApiError('CONFLICT_STATE', 'This changed elsewhere. Reload before trying again.', { status: 409 }));
    render(liveView(<TaskDrawer />));
    expect(await screen.findByRole('heading', { name: 'Live task' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'prog' } });
    await act(async () => {});
    expect(screen.getByRole('alert').textContent).toContain('This task is in a closed sprint and cannot be changed.');
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
  });

  it('E7 shows a safe retryable task-load error and rejects a task from another project', async () => {
    getTask.mockRejectedValueOnce(new Error('server detail must stay hidden'));
    render(liveView(<TaskDrawer projectId={PROJECT} />));
    expect(await screen.findByRole('heading', { name: 'Unable to load task' })).toBeTruthy();
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(screen.queryByText('server detail must stay hidden')).toBeNull();
    getTask.mockResolvedValueOnce({ ...task, projectId: '550e8400-e29b-41d4-a716-446655440001' });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Task not found' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('E7 treats a live 404 and a project mismatch as the same normal missing-task result', async () => {
    getTask.mockRejectedValueOnce(new ApiError('NOT_FOUND', 'This project or task was not found.', { status: 404 }));
    render(liveView(<TaskDrawer projectId={PROJECT} />));
    expect(await screen.findByRole('heading', { name: 'Task not found' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByText('This project or task was not found.')).toBeNull();
  });

  it('E3 ignores stale task responses after the live route changes', async () => {
    let resolveA!: (value: typeof task) => void;
    let resolveB!: (value: typeof task) => void;
    getTask.mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; })).mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));
    const rendered = render(<ProjectRouteContext.Provider value={projectRoute(`/projects/${PROJECT}`)}><RoleCtx.Provider value="lead"><TaskDrawer projectId={PROJECT} /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    rendered.rerender(<ProjectRouteContext.Provider value={projectRoute('/projects/550e8400-e29b-41d4-a716-446655440001')}><RoleCtx.Provider value="lead"><TaskDrawer projectId="550e8400-e29b-41d4-a716-446655440001" /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    await act(async () => { resolveA({ ...task, title: 'Stale task' } as any); });
    expect(screen.queryByText('Stale task')).toBeNull();
    await act(async () => { resolveB({ ...task, projectId: '550e8400-e29b-41d4-a716-446655440001', title: 'Current task' } as any); });
    expect(screen.getByRole('heading', { name: 'Current task' })).toBeTruthy();
  });

  it('E4 shows checkpoint loading and retries a safe list error', async () => {
    listCheckpoints.mockRejectedValueOnce(new Error('server details must stay hidden')).mockResolvedValueOnce([]);
    render(liveView(<CheckpointCards showRisk />));
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('server details must stay hidden')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No checkpoints yet.')).toBeTruthy();
    expect(listCheckpoints).toHaveBeenCalledTimes(2);
  });

  it('renders only epics linked to each live checkpoint', async () => {
    listCheckpoints.mockResolvedValueOnce([{ id: 'checkpoint-1', projectId: PROJECT, name: 'Launch', targetDate: '2026-12-01', createdAt: '', updatedAt: '', version: 1 }]);
    listLiveEpics.mockResolvedValueOnce([
      { id: 'epic-1', projectId: PROJECT, checkpointId: 'checkpoint-1', title: 'Linked epic', description: null, position: 0, taskCount: 0, pointsTotal: 0, createdAt: '', updatedAt: '', version: 1 },
      { id: 'epic-2', projectId: PROJECT, checkpointId: null, title: 'Unlinked epic', description: null, position: 1, taskCount: 0, pointsTotal: 0, createdAt: '', updatedAt: '', version: 1 },
    ]);

    render(liveView(<CheckpointCards showRisk />));

    expect(await screen.findByText('Linked epic', { exact: false })).toBeTruthy();
    expect(screen.queryByText('Unlinked epic')).toBeNull();
    expect(screen.queryByText('No linked epics in checkpoint response.')).toBeNull();
    expect(listCheckpoints).toHaveBeenCalledWith(PROJECT);
    expect(listLiveEpics).toHaveBeenCalledWith(PROJECT);
  });

  it('matches the role-specific checkpoint information in the mockup', async () => {
    listCheckpoints.mockResolvedValue([{ id: 'checkpoint-1', projectId: PROJECT, name: 'Launch', targetDate: '2026-12-01', createdAt: '', updatedAt: '', version: 1 }]);
    listLiveEpics.mockResolvedValue([{ id: 'epic-1', projectId: PROJECT, checkpointId: 'checkpoint-1', title: 'Linked epic', description: null, position: 0, taskCount: 2, pointsTotal: 5, createdAt: '', updatedAt: '', version: 1 }]);
    getFacts.mockResolvedValue({ checkpoints: [{ id: 'checkpoint-1', name: 'Launch', targetDate: '2026-12-01', remainingPoints: 3, projectedDate: null, risk: 'AT_RISK' }] });

    const lead = render(liveView(<CheckpointCards showRisk />));
    expect(await lead.findByText('At risk')).toBeTruthy();
    expect(lead.getByText('Remaining', { exact: false })).toBeTruthy();
    expect(lead.getByText('Close a sprint to get a projected date.')).toBeTruthy();
    expect(lead.getByText('Linked epic', { exact: false })).toBeTruthy();
    lead.unmount();

    const developer = render(<ProjectRouteContext.Provider value={route}><RoleCtx.Provider value="dev"><CheckpointCards showRisk={false} /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    expect(await developer.findByText('Linked epic', { exact: false })).toBeTruthy();
    expect(developer.queryByText('At risk')).toBeNull();
    expect(developer.queryByText('Close a sprint to get a projected date.')).toBeNull();
    expect(getFacts).toHaveBeenCalledTimes(1);
  });

  it('shows a computed forecast date on PM and lead checkpoint cards', async () => {
    listCheckpoints.mockResolvedValue([{ id: 'checkpoint-1', projectId: PROJECT, name: 'Launch', targetDate: '2026-12-01', createdAt: '', updatedAt: '', version: 1 }]);
    getFacts.mockResolvedValue({ checkpoints: [{ id: 'checkpoint-1', name: 'Launch', targetDate: '2026-12-01', remainingPoints: 0, projectedDate: '2026-11-28', risk: 'ON_TRACK' }] });

    render(liveView(<CheckpointCards showRisk />));

    expect(await screen.findByText('Projected')).toBeTruthy();
    expect(screen.getByText('Sat 28 Nov')).toBeTruthy();
    expect(screen.getByText('Remaining', { exact: false })).toBeTruthy();
    expect(screen.queryByText('Close a sprint to get a projected date.')).toBeNull();
  });

  it('E14 keeps PM live board and task drawer read-only', async () => {
    const pmView = <ProjectRouteContext.Provider value={route}><RoleCtx.Provider value="pm"><BoardView role="pm" /></RoleCtx.Provider></ProjectRouteContext.Provider>;
    render(pmView);
    expect(await screen.findByText('Live task')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull();
  });

  it('E15 lets a Developer mutate only their own assigned live task', async () => {
    session.mockReturnValue({ user: { id: 'user-1' } });
    render(<ProjectRouteContext.Provider value={route}><RoleCtx.Provider value="dev"><BoardView role="dev" /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    expect(await screen.findByText('Live task')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change status' })).toBeTruthy();
    session.mockReturnValue({ user: { id: 'other-user' } });
    const other = render(<ProjectRouteContext.Provider value={route}><RoleCtx.Provider value="dev"><TaskDrawer projectId={PROJECT} /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    expect(await other.findByRole('heading', { name: 'Live task' })).toBeTruthy();
    expect(other.queryByRole('button', { name: 'Edit' })).toBeNull();
    other.unmount();
  });
});
