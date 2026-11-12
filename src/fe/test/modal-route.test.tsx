import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRouteContext, projectRoute } from '../lib/api/project-mode';
import ModalRoute from '../components/modal-route';

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
});
