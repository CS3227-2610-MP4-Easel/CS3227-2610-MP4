import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('test runner', () => {
  it('E82 runs under jsdom and renders a component', () => {
    expect(typeof document).not.toBe('undefined');
    render(createElement('p', null, 'ok'));
    expect(screen.getByText('ok')).toBeTruthy();
  });
});
