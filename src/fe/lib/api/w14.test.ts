import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const idToken = vi.fn();
const signOutUser = vi.fn();
vi.mock('../auth/firebase', () => ({
  idToken: (...args: unknown[]) => idToken(...args),
  signOutUser: (...args: unknown[]) => signOutUser(...args),
}));

import {
  ApiError,
  approveProposalLive,
  closeSprintLive_31,
  createSprintLive_28,
  deleteSprintLive_32,
  listProposalsLive_46,
  listSprintsLive_27,
  patchSprintLive_29,
  readProgressLive_33,
  rejectProposalLive,
  startSprintLive_30,
} from './index';

const fetchMock = vi.fn();

function reply(status: number, body: string, headers: Record<string, string> = {}) {
  fetchMock.mockResolvedValue(new Response(status === 204 ? null : body, { status, headers }));
}

beforeEach(() => {
  fetchMock.mockReset();
  idToken.mockReset();
  signOutUser.mockReset();
  idToken.mockResolvedValue('token');
  signOutUser.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('W14 live client contracts', () => {
  it('preserves paged sprint and proposal envelopes and forwards bounded query fields', async () => {
    reply(200, JSON.stringify({ items: [], page: 2, size: 25, total: 51 }));
    const sprints = await listSprintsLive_27('project 1', 2, 25);
    expect(sprints).toEqual({ items: [], page: 2, size: 25, total: 51 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project%201/sprints?page=2&size=25');

    reply(200, JSON.stringify({ items: [], page: 0, size: 20, total: 0 }));
    const proposals = await listProposalsLive_46('project 1', 0, 20, 'PENDING');
    expect(proposals.total).toBe(0);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/lead/projects/project%201/proposals?page=0&size=20&status=PENDING');
  });

  it('uses exact W14 paths and strict mutation bodies', async () => {
    reply(200, '{}');
    await createSprintLive_28('project 1', { name: 'Sprint 4', startDate: '2026-11-16', endDate: '2026-11-27' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project%201/sprints');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Sprint 4', startDate: '2026-11-16', endDate: '2026-11-27' });

    reply(200, '{}');
    await patchSprintLive_29('sprint 1', { name: 'Sprint 4', version: 3, extra: 'drop' } as never);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/sprints/sprint%201');
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'Sprint 4', version: 3 });

    reply(200, '{}');
    await startSprintLive_30('sprint 1', 3);
    expect(fetchMock.mock.calls[2][0]).toBe('/api/sprints/sprint%201/start');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ version: 3 });

    reply(200, '{}');
    await closeSprintLive_31('sprint 1', { version: 4, carryOver: [{ taskId: 'task 1', to: 'BACKLOG', extra: true } as never] });
    expect(fetchMock.mock.calls[3][0]).toBe('/api/sprints/sprint%201/close');
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ version: 4, carryOver: [{ taskId: 'task 1', to: 'BACKLOG' }] });

    reply(204, '');
    await deleteSprintLive_32('sprint 1', 5);
    expect(fetchMock.mock.calls[4][0]).toBe('/api/sprints/sprint%201?version=5');
    expect(fetchMock.mock.calls[4][1].method).toBe('DELETE');
  });

  it('returns percent progress and session outcomes from proposal mutations', async () => {
    reply(200, JSON.stringify({ pointsTotal: 10, pointsDone: 4, percent: 40, unestimatedTasks: 0, velocity: [] }));
    expect((await readProgressLive_33('project 1')).percent).toBe(40);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/project%201/progress');

    reply(200, JSON.stringify({ proposalId: 'proposal-1', status: 'APPROVED', applied: ['suggestion-1'], sessionOutcome: 'ACCEPTED' }));
    const approved = await approveProposalLive('proposal 1', 2, ['suggestion-1']);
    expect(approved.sessionOutcome).toBe('ACCEPTED');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/lead/proposals/proposal%201/approve');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ version: 2, suggestionIds: ['suggestion-1'] });

    reply(200, JSON.stringify({ id: 'proposal-1', projectId: 'project-1', kind: 'REPLAN', status: 'REJECTED', suggestions: [], explanation: 'No change.', flagged: false, createdAt: '2026-11-13T00:00:00.000Z', version: 2, sessionOutcome: 'REJECTED' }));
    const rejected = await rejectProposalLive('proposal 1', 1);
    expect(rejected.sessionOutcome).toBe('REJECTED');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/lead/proposals/proposal%201/reject');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ version: 1 });
  });

  it('keeps oversized query failures and suggestion details typed', async () => {
    reply(422, JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'Invalid', details: { suggestionIds: ['s1', 's2'] }, requestId: 'req-1' } }));
    let error: unknown;
    try {
      await listSprintsLive_27('project-1', 10_001, 101);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_FAILED', requestId: 'req-1' });
    expect((error as ApiError).details[0]).toMatchObject({ field: 'suggestionIds', suggestionIds: ['s1', 's2'] });
  });
});
