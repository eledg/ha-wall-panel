import { describe, expect, it, vi } from 'vitest';

import { fetchHistory, toIntervals, toSeries } from './history.ts';

const T = (minute: number) => Date.UTC(2026, 9, 18, 12, minute);
const row = (state: string, minute: number) => ({
  state,
  last_changed: new Date(T(minute)).toISOString(),
});

describe('toIntervals', () => {
  it('builds back-to-back on/off intervals to the end', () => {
    expect(
      toIntervals([row('off', 0), row('on', 20), row('off', 50)], T(0), T(90)),
    ).toEqual([
      { start: T(0), end: T(20), on: false },
      { start: T(20), end: T(50), on: true },
      { start: T(50), end: T(90), on: false },
    ]);
  });

  it('clips the state that began before the window', () => {
    expect(toIntervals([row('on', -300), row('off', 30)], T(0), T(60))).toEqual(
      [
        { start: T(0), end: T(30), on: true },
        { start: T(30), end: T(60), on: false },
      ],
    );
  });

  it('merges repeats and counts unavailable as off', () => {
    expect(
      toIntervals(
        [row('on', 0), row('on', 10), row('unavailable', 30)],
        T(0),
        T(60),
      ),
    ).toEqual([
      { start: T(0), end: T(30), on: true },
      { start: T(30), end: T(60), on: false },
    ]);
  });

  it('gives nothing when nothing was recorded', () => {
    expect(toIntervals([], T(0), T(60))).toEqual([]);
  });
});

describe('fetchHistory', () => {
  const auth = { expired: false, accessToken: 'tok' } as never;

  it('asks HA for the window with the bearer token and unwraps the rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([[row('on', 0)]]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const rows = await fetchHistory(
      auth,
      'binary_sensor.x',
      new Date(T(0)),
      new Date(T(60)),
    );

    expect(rows).toEqual([row('on', 0)]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `/api/history/period/${new Date(T(0)).toISOString()}?`,
    );
    expect(url).toContain('filter_entity_id=binary_sensor.x');
    expect(url).toContain('minimal_response');
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
    vi.unstubAllGlobals();
  });

  it('rejects when HA answers with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(
      fetchHistory(auth, 'binary_sensor.x', new Date(T(0)), new Date(T(60))),
    ).rejects.toThrow('500');
    vi.unstubAllGlobals();
  });

  it('gives no rows for an entity HA has no history for', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
    );

    expect(
      await fetchHistory(
        auth,
        'binary_sensor.x',
        new Date(T(0)),
        new Date(T(60)),
      ),
    ).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe('toIntervals with a custom predicate', () => {
  it('counts any state but off as on', () => {
    expect(
      toIntervals(
        [row('off', 0), row('cool', 20)],
        T(0),
        T(60),
        (s) => s !== 'off',
      ),
    ).toEqual([
      { start: T(0), end: T(20), on: false },
      { start: T(20), end: T(60), on: true },
    ]);
  });
});

describe('toSeries', () => {
  it('reads numbers, skips unusable states and clips to the window', () => {
    expect(
      toSeries(
        [
          row('20.5', -90),
          row('unavailable', 10),
          row('unknown', 15),
          row('21.0', 30),
          row('22.0', 70),
        ],
        T(0),
        T(60),
      ),
    ).toEqual([
      { at: T(0), value: 20.5 },
      { at: T(30), value: 21 },
    ]);
  });

  it('sorts oldest first', () => {
    expect(
      toSeries([row('2', 20), row('1', 10)], T(0), T(60)).map((s) => s.value),
    ).toEqual([1, 2]);
  });
});
