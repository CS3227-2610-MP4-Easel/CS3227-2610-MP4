import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import { RoleCtx } from '../lib/nav';

const getProject = vi.fn();
const getProgress = vi.fn();
const listCheckpoints = vi.fn();
const listMembers = vi.fn();

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, getProjectLive_7: (...args: unknown[]) => getProject(...args), getProgressLive_33: (...args: unknown[]) => getProgress(...args), listCheckpointsLive_12: (...args: unknown[]) => listCheckpoints(...args), listMembersLive_9: (...args: unknown[]) => listMembers(...args) };
});

import OverviewLead from '../components/canvas/OverviewLead';
import { ProgressCard } from '../components/live/overview';
import { ApiError } from '../lib/api';

const A = '550e8400-e29b-41d4-a716-446655440000';
const liveProject = (status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') => ({ id: A, name: 'Live Campus', brief: 'Live brief', status, createdBy: 'u1', createdAt: '2026-11-12T00:00:00Z', updatedAt: '2026-11-12T00:00:00Z', version: 1, progress: { pointsTotal: 10, pointsDone: 4, percent: 40, unestimatedTasks: 0 } });

beforeEach(() => {
  getProject.mockReset(); getProgress.mockReset(); listCheckpoints.mockReset(); listMembers.mockReset();
  listCheckpoints.mockResolvedValue([]); listMembers.mockResolvedValue([]);
});

describe('jsx', () => {
  it('E82 compiles JSX in a .tsx test', () => {
    render(<p>jsx ok</p>);
    expect(screen.getByText('jsx ok').tagName).toBe('P');
  });

  it('formats overview progress percentages to at most two decimal places', () => {
    render(<ProgressCard live progress={{ pointsTotal: 3, pointsDone: 1, percent: 33.333333, unestimatedTasks: 0, velocity: [] }} />);
    expect(screen.getByText('33.33%')).toBeTruthy();
    expect(screen.queryByText('33.333333%')).toBeNull();
  });

  it('F2 E2 never renders prototype overview values while a live UUID request is pending', async () => {
    getProject.mockImplementation(() => new Promise(() => {}));
    getProgress.mockImplementation(() => new Promise(() => {}));
    render(
      <ProjectRouteContext.Provider value={projectRoute('/projects/550e8400-e29b-41d4-a716-446655440000')}>
        <RoleCtx.Provider value="lead"><OverviewLead /></RoleCtx.Provider>
      </ProjectRouteContext.Provider>,
    );
    await act(async () => {});
    expect(screen.queryByText('A food-ordering app for campus canteens: browse stalls, order ahead, pay with a student ID and collect with a pickup code.')).toBeNull();
    expect(screen.queryByText('13 of 44 points done')).toBeNull();
    expect(document.querySelector('.sk')).toBeTruthy();
  });

  it('E7 shows the mapped error and retry affordance for a live overview failure', async () => {
    getProject.mockRejectedValue(new Error('server detail must stay hidden'));
    getProgress.mockRejectedValue(new Error('server progress must stay hidden'));
    render(
      <ProjectRouteContext.Provider value={projectRoute('/projects/550e8400-e29b-41d4-a716-446655440000')}>
        <RoleCtx.Provider value="lead"><OverviewLead /></RoleCtx.Provider>
      </ProjectRouteContext.Provider>,
    );
    expect(await screen.findAllByText('Something went wrong. Try again.')).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('server detail must stay hidden')).toBeNull();
  });

  it('F8 E14 renders live title, archived status, data cards and UUID-preserving tabs/actions', async () => {
    getProject.mockResolvedValue(liveProject('ARCHIVED'));
    getProgress.mockResolvedValue({ pointsTotal: 10, pointsDone: 4, percent: 40, unestimatedTasks: 0, velocity: [] });
    listCheckpoints.mockResolvedValue([{ id: 'c1', projectId: A, name: 'Beta', targetDate: '2026-12-01', createdAt: '', updatedAt: '', version: 1 }]);
    listMembers.mockResolvedValue([{ userId: 'u2', displayName: 'Ada Dev', role: 'DEVELOPER', addedAt: '' }]);
    render(<ProjectRouteContext.Provider value={projectRoute(`/projects/${A}`)}><RoleCtx.Provider value="lead"><OverviewLead /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    expect(await screen.findByRole('heading', { name: 'Live Campus' })).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Ada Dev')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Checkpoints' }).getAttribute('href')).toBe(`/projects/${A}/checkpoints`);
    expect(screen.getByRole('link', { name: 'Check project health' }).getAttribute('href')).toBe(`/projects/${A}/health`);
    expect(screen.getByRole('link', { name: 'Manage' }).getAttribute('href')).toBe(`/projects/${A}/members`);
  });

  it('E3 keeps live detail/progress 401s out of the local error state', async () => {
    getProject.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Authentication is required.', { status: 401 }));
    getProgress.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Authentication is required.', { status: 401 }));
    render(<ProjectRouteContext.Provider value={projectRoute(`/projects/${A}`)}><RoleCtx.Provider value="lead"><OverviewLead /></RoleCtx.Provider></ProjectRouteContext.Provider>);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('Something went wrong. Try again.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
