// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getConfig } from '@/config/config.ts';
import { SHIFT_STEP_MS } from '@/lib/pixel-shift.ts';

import { Shell } from './shell.tsx';

describe('Shell', () => {
  it('renders its tiles inside the padded grid', () => {
    render(
      <Shell>
        <p>tile</p>
      </Shell>,
      document.body,
    );

    const main = document.querySelector('main')!;
    expect(main.className).toContain('p-edge');
    expect(main.querySelector('.dash-grid')).not.toBeNull();
    expect(main.querySelector('.dash-grid p')?.textContent).toBe('tile');
  });

  describe('pixel shift', () => {
    afterEach(() => {
      render(null, document.body);
      vi.useRealTimers();
    });

    it('moves the grid on each step and stops on unmount', () => {
      vi.useFakeTimers();
      vi.setSystemTime(SHIFT_STEP_MS * 10 + 5);
      render(<Shell />, document.body);
      const grid = document.querySelector<HTMLElement>('.dash-grid')!;
      const first = grid.style.transform;
      expect(first).toMatch(/^translate\(/);

      vi.advanceTimersByTime(SHIFT_STEP_MS);
      expect(grid.style.transform).not.toBe(first);

      const second = grid.style.transform;
      render(null, document.body);
      vi.advanceTimersByTime(SHIFT_STEP_MS * 3);
      expect(grid.style.transform).toBe(second);
    });
  });
});

describe('Shell night mode', () => {
  afterEach(() => {
    render(null, document.body);
    vi.useRealTimers();
  });

  it('dims at night, and a tap wakes it for a while', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14, 20, 59, 0));
    render(<Shell />, document.body);
    const main = document.querySelector('main')!;
    expect(main.dataset.night).toBeUndefined();
    expect(main.querySelector('button')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(main.dataset.night).toBe('true');
    expect(main.querySelector('.dash-grid')?.className).toContain('opacity-60');

    act(() => main.querySelector('button')!.click());
    expect(main.querySelector('button')).toBeNull();
    expect(main.querySelector('.dash-grid')?.className).not.toContain(
      'opacity-60',
    );

    act(() => {
      vi.advanceTimersByTime(getConfig().night.wakeMs);
    });
    expect(main.querySelector('button')).not.toBeNull();
  });
});
