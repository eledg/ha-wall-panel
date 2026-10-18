// @vitest-environment happy-dom
import { render } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';

import { AcPicker } from './ac-picker.tsx';

afterEach(() => render(null, document.body));

describe('AcPicker', () => {
  it.each([3, 5])('puts %i options in one landscape row', (count) => {
    const options = Array.from({ length: count }, (_, i) => `o${i}`);
    render(
      <AcPicker
        options={options}
        value="o0"
        text={(o) => o}
        onPick={() => {}}
        onBack={() => {}}
      />,
      document.body,
    );
    const grid = document.querySelector<HTMLElement>('.grid')!;

    expect(grid.className).toContain('landscape:grid-cols-(--option-grid)');
    expect(grid.className).toContain('grid-cols-2');
    expect(grid.style.getPropertyValue('--option-grid')).toBe(
      `repeat(${count}, minmax(0, 1fr))`,
    );
    expect(grid.querySelectorAll('button')).toHaveLength(count);
  });
});
