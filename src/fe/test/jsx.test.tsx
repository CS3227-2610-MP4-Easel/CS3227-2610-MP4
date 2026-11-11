import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('jsx', () => {
  it('E82 compiles JSX in a .tsx test', () => {
    render(<p>jsx ok</p>);
    expect(screen.getByText('jsx ok').tagName).toBe('P');
  });
});
