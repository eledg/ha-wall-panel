// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockTile, msToNextMinute } from './clock-tile.tsx';

const text = () => document.body.textContent;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  render(null, document.body);
  vi.useRealTimers();
});

describe('msToNextMinute', () => {
  it('counts to the next whole minute', () => {
    expect(msToNextMinute(new Date(2026, 0, 5, 9, 30, 15, 250))).toBe(44_750);
    expect(msToNextMinute(new Date(2026, 0, 5, 9, 30, 0, 0))).toBe(60_000);
  });
});

describe('ClockTile', () => {
  it('shows 24-hour time and a UK date', () => {
    vi.setSystemTime(new Date(2026, 0, 5, 9, 5, 10));
    act(() => render(<ClockTile area="clock" />, document.body));

    expect(text()).toContain('09:05');
    expect(text()).toContain('Monday 5 January');
  });

  it('ticks on the minute and stays aligned when a timer fires late', () => {
    vi.setSystemTime(new Date(2026, 0, 5, 9, 5, 50));
    act(() => render(<ClockTile area="clock" />, document.body));

    act(() => {
      vi.advanceTimersByTime(9_999);
    });
    expect(text()).toContain('09:05');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(text()).toContain('09:06');

    // A full minute later it advances again, with no accumulated drift.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(text()).toContain('09:07');
  });

  it('rolls the date over at midnight', () => {
    vi.setSystemTime(new Date(2026, 0, 5, 23, 59, 30));
    act(() => render(<ClockTile area="clock" />, document.body));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(text()).toContain('00:00');
    expect(text()).toContain('Tuesday 6 January');
  });

  it('stops ticking when removed', () => {
    vi.setSystemTime(new Date(2026, 0, 5, 9, 5, 50));
    act(() => render(<ClockTile area="clock" />, document.body));
    act(() => render(null, document.body));

    expect(vi.getTimerCount()).toBe(0);
  });
});
