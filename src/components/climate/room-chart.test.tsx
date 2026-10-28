// @vitest-environment happy-dom
import { render } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';

import { RoomChart } from './room-chart.tsx';

const START = Date.UTC(2026, 9, 18, 6);
const END = START + 6 * 3_600_000;
const at = (hours: number) => START + hours * 3_600_000;
const temps = [
  { at: at(0), value: 20.2 },
  { at: at(3), value: 21 },
  { at: at(6), value: 22.4 },
];
const humidity = [
  { at: at(0), value: 50 },
  { at: at(6), value: 45 },
];

afterEach(() => render(null, document.body));

const draw = (props: Partial<Parameters<typeof RoomChart>[0]> = {}) =>
  render(
    <RoomChart
      temps={temps}
      humidity={humidity}
      start={START}
      end={END}
      {...props}
    />,
    document.body,
  );

describe('RoomChart', () => {
  it('labels the axes from the padded temperature range', () => {
    draw();
    const text = document.body.textContent;

    expect(text).toContain('23°');
    expect(text).toContain('21°');
    expect(text).toContain('19°');
    expect(text).toContain('100%');
    expect(text).toContain('0%');
  });

  it('draws one temperature and one humidity line', () => {
    draw();

    expect(document.querySelectorAll('.stroke-fg')).toHaveLength(1);
    expect(document.querySelectorAll('.stroke-humidity')).toHaveLength(1);
  });

  it('shades the heating and AC runs and lists them in the legend', () => {
    draw({
      heating: {
        intervals: [{ start: at(1), end: at(2), on: true }],
        target: 21,
      },
      ac: { intervals: [{ start: at(3), end: at(4), on: true }] },
    });

    expect(document.querySelectorAll('rect.fill-accent-soft')).toHaveLength(1);
    expect(document.querySelectorAll('rect.fill-cool-soft')).toHaveLength(1);
    expect(document.querySelectorAll('.stroke-accent')).toHaveLength(1);
    expect(document.querySelectorAll('.stroke-cool')).toHaveLength(0);
    expect(document.body.textContent).toContain('Heating');
    expect(document.body.textContent).toContain('AC');
  });

  it('leaves out a target outside the axis', () => {
    draw({ heating: { intervals: [], target: 30 } });

    expect(document.querySelectorAll('.stroke-accent')).toHaveLength(0);
  });

  it('shows loading, then the empty state', () => {
    draw({ temps: undefined });
    expect(document.body.textContent).toContain('Loading…');

    draw({ temps: [] });
    expect(document.body.textContent).toContain('No climate history available');
    expect(document.querySelector('svg')).toBeNull();
  });
});
