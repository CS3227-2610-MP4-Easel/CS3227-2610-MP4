import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import { RoleCtx } from '../lib/nav';

const listTasks = vi.fn();
const listEpics = vi.fn();
const listMembers = vi.fn();
const listCheckpoints = vi.fn();
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
    listMembersLive_9: (...args: unknown[]) => listMembers(...args),
    listCheckpointsLive_12: (...args: unknown[]) => listCheckpoints(...args),
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
import { AddTaskForm } from '../components/live/forms';
import BacklogList from '../components/live/backlog-list';
import TaskDrawer from '../components/live/task-drawer';

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
  listMembers.mockReset().mockResolvedValue([{ userId: 'user-1', displayName: 'Ada Lead', role: 'DEVELOPER', addedAt: '' }, { userId: 'user-1', displayName: 'Ada Lead', role: 'DEVELOPER', addedAt: '' }]);
  listCheckpoints.mockReset().mockResolvedValue([]);
  getTask.mockReset().mockResolvedValue(task);
  updateTask.mockReset().mockResolvedValue({ ...task, title: 'Saved task', version: 5 });
  setStatus.mockReset().mockResolvedValue({ ...task, status: 'IN_PROGRESS', version: 5 });
  addMember.mockReset().mockResolvedValue({ userId: 'user-2', displayName: 'New Dev', role: 'DEVELOPER', addedAt: '' });
  createTask.mockReset().mockResolvedValue({ ...task, id: 'task-2', epicId: 'epic-1' });
  session.mockReset().mockReturnValue(null);
  router.push.mockReset();
});

describe('W5 live planning surfaces', () => {
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

  it('E7 shows a safe retryable task-load error and rejects a task from another project', async () => {
    getTask.mockRejectedValueOnce(new Error('server detail must stay hidden'));
    render(liveView(<TaskDrawer projectId={PROJECT} />));
    expect(await screen.findByRole('heading', { name: 'Unable to load task' })).toBeTruthy();
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(screen.queryByText('server detail must stay hidden')).toBeNull();
    getTask.mockResolvedValueOnce({ ...task, projectId: '550e8400-e29b-41d4-a716-446655440001' });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('This task is not in the selected project.')).toBeTruthy();
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
