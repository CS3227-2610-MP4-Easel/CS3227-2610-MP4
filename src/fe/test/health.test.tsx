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

function digest(projectId: string, explanation: string) {
  return { id: projectId, projectId, facts: facts(10), explanation, degraded: false, flagged: false, proposalId: null, cached: false, createdAt: '2026-11-12T00:00:00.000Z' };
}

function view(projectId: string) {
  return (
    <ProjectRouteContext.Provider value={projectRoute(`/projects/${projectId}/health`)}>
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
    const factsA = deferred<ReturnType<typeof facts>>();
    const digestA = deferred<ReturnType<typeof digest>>();
    const factsB = deferred<ReturnType<typeof facts>>();
    const digestB = deferred<ReturnType<typeof digest>>();
    getFacts.mockImplementation((id: string) => id === A ? factsA.promise : factsB.promise);
    getLatestDigest.mockImplementation((id: string) => id === A ? digestA.promise : digestB.promise);

    const rendered = render(view(A));
    await act(async () => {});
    rendered.rerender(view(B));
    await act(async () => {
      factsB.resolve(facts(20));
      digestB.resolve(digest(B, 'B digest'));
    });
    expect(screen.getByText('B digest')).toBeTruthy();

    await act(async () => {
      factsA.resolve(facts(99));
      digestA.resolve(digest(A, 'A stale digest'));
    });
    expect(screen.getByText('B digest')).toBeTruthy();
    expect(screen.queryByText('A stale digest')).toBeNull();
  });
});
