import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import ModalRoute from '../components/modal-route';
import { modalForHref } from '../lib/nav';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('modal route behavior', () => {
  beforeEach(() => push.mockReset());

  it('closes on Escape and backdrop click while keeping dialog content mounted', () => {
    render(<ProjectRouteContext.Provider value={projectRoute('/projects/550e8400-e29b-41d4-a716-446655440000/backlog')}><ModalRoute closeTo="Backlog.dc.html"><div role="dialog">Dialog</div></ModalRoute></ProjectRouteContext.Provider>);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(push).toHaveBeenCalledWith('/projects/550e8400-e29b-41d4-a716-446655440000/backlog');
    fireEvent.mouseDown(screen.getByRole('presentation'));
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('identifies modal links without changing the underlying page route', () => {
    expect(modalForHref('/projects/p1/backlog?view=add-task')).toEqual({ file: 'BacklogAddTask', closeTo: '/projects/p1/backlog' });
    expect(modalForHref('/projects/p1/board?task=t5')).toEqual({ file: 'TaskDetail', closeTo: '/projects/p1/board' });
    expect(modalForHref('/projects/p1/board')).toBeNull();
  });
});
