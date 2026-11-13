import { describe, expect, it } from 'vitest';
import { resolve } from '../lib/screens';

describe('retired Tier 2 views', () => {
  it('does not expose usage or sprint management', () => {
    expect(resolve('/usage', undefined, 'pm')).toEqual({ notFound: true });
    expect(resolve('/projects/p1/sprints', undefined, 'lead')).toEqual({ notFound: true });
    expect(resolve('/lead/overview', undefined, 'lead')).toEqual({ notFound: true });
    expect(resolve('/projects/p1/plan/history', undefined, 'pm')).toEqual({ notFound: true });
  });
});
