import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import { RoleCtx } from '../lib/nav';

const getProject = vi.fn();
const getProgress = vi.fn();

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, getProjectLive_7: (...args: unknown[]) => getProject(...args), getProgressLive_33: (...args: unknown[]) => getProgress(...args) };
});

import OverviewLead from '../components/canvas/OverviewLead';

describe('jsx', () => {
  it('E82 compiles JSX in a .tsx test', () => {
    render(<p>jsx ok</p>);
    expect(screen.getByText('jsx ok').tagName).toBe('P');
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
});
