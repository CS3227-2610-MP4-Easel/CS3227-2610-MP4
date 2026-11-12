import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import { RoleCtx } from '../lib/nav';

const getFacts = vi.fn();
const getLatestDigest = vi.fn();

vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error { status = 0; },
  applySuggestions_47: vi.fn(),
  createDigest_44: vi.fn(),
  dismissSuggestions_48: vi.fn(),
  getFacts_42: (...args: unknown[]) => getFacts(...args),
  getLatestDigest_45: (...args: unknown[]) => getLatestDigest(...args),
  refreshDigest_44: vi.fn(),
  useDb: () => ({ project: { status: 'ACTIVE' } }),
  healthOf: () => ({ progress: { percent: 0, pointsDone: 0, pointsTotal: 0, unestimatedTasks: 0 }, closed: 0, avg: 0, projectedAll: null, atRisk: 0, rows: [], overload: [] }),
}));

import Health from '../components/canvas/Health';

const A = '550e8400-e29b-41d4-a716-446655440000';
const B = '550e8400-e29b-41d4-a716-446655440001';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function facts(pointsTotal: number) {
  return {
    asOf: '2026-11-12T00:00:00.000Z', pointsTotal, pointsDone: 1, pointsRemaining: pointsTotal - 1,
    unestimatedTasks: 0, velocity: [], avgVelocity: null, projectedCompletionDate: null, checkpoints: [], overload: [],
  };
}

function digest(projectId: string, explanation: string, overload: Array<{ userId: string; displayName: string; openPoints: number; avgCompletedPerSprint: number; projects: Array<{ projectId: string; name: string; openPoints: number }> }> = []) {
  return { id: projectId, projectId, facts: { ...facts(10), overload }, explanation, degraded: false, flagged: false, proposalId: null, cached: false, createdAt: '2026-11-12T00:00:00.000Z' };
}

function view(projectId: string) {
  return (
    <ProjectRouteContext.Provider value={projectRoute(`/projects/${projectId}/health`)}>
      <RoleCtx.Provider value="lead"><Health /></RoleCtx.Provider>
    </ProjectRouteContext.Provider>
  );
}

function prototypeView() {
  return (
    <ProjectRouteContext.Provider value={projectRoute('/projects/p1/health')}>
      <RoleCtx.Provider value="lead"><Health /></RoleCtx.Provider>
    </ProjectRouteContext.Provider>
  );
}

beforeEach(() => {
  getFacts.mockReset();
  getLatestDigest.mockReset();
});

describe('Health route identity', () => {
  it('E3 ignores stale project responses after a live route change', async () => {
    const factsA1 = deferred<ReturnType<typeof facts>>();
    const digestA1 = deferred<ReturnType<typeof digest>>();
    const factsB = deferred<ReturnType<typeof facts>>();
    const digestB = deferred<ReturnType<typeof digest>>();
    const factsA2 = deferred<ReturnType<typeof facts>>();
    const digestA2 = deferred<ReturnType<typeof digest>>();
    const aFacts = [factsA1, factsA2];
    const aDigests = [digestA1, digestA2];
    getFacts.mockImplementation((id: string) => id === A ? aFacts.shift()!.promise : factsB.promise);
    getLatestDigest.mockImplementation((id: string) => id === A ? aDigests.shift()!.promise : digestB.promise);

    const rendered = render(view(A));
    await act(async () => {});
    rendered.rerender(view(B));
    await act(async () => {});
    rendered.rerender(view(A));
    await act(async () => {});
    await act(async () => {
      factsA1.resolve(facts(99));
      digestA1.resolve(digest(A, 'A stale digest'));
    });
    expect(screen.queryByText('A stale digest')).toBeNull();

    await act(async () => {
      factsA2.resolve(facts(20));
      digestA2.resolve(digest(A, 'A current digest'));
    });
    expect(screen.getByText('A current digest')).toBeTruthy();

    await act(async () => {
      factsB.resolve(facts(88));
      digestB.resolve(digest(B, 'B stale digest'));
    });
    expect(screen.getByText('A current digest')).toBeTruthy();
    expect(screen.queryByText('B stale digest')).toBeNull();
  });

  it('F7 never renders prototype data while a live UUID route is loading', async () => {
    getFacts.mockImplementation(() => new Promise(() => {}));
    getLatestDigest.mockImplementation(() => new Promise(() => {}));
    const rendered = render(prototypeView());
    expect(screen.getByText(/Progress is steady and all three checkpoints/)).toBeTruthy();
    rendered.rerender(view(A));
    await act(async () => {});
    expect(screen.queryByText(/Progress is steady and all three checkpoints/)).toBeNull();
    expect(screen.queryByText('Suggested changes (3)')).toBeNull();
    expect(document.querySelector('.sk')).toBeTruthy();
  });

  it('shows latest digest overload on the initial live health load', async () => {
    getFacts.mockResolvedValue(facts(10));
    getLatestDigest.mockResolvedValue(digest(A, 'Current digest', [{ userId: 'u1', displayName: 'Alex Member', openPoints: 9, avgCompletedPerSprint: 4, projects: [{ projectId: A, name: 'W13 Delivery Demo', openPoints: 9 }] }]));

    render(view(A));
    await act(async () => {});

    expect(screen.getByText('Alex Member')).toBeTruthy();
  });
});
