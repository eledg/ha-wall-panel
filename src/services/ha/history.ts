import type { Auth } from 'home-assistant-js-websocket';

import { parseNumber } from './entity.ts';

/** A state from `GET /api/history/period`, as far as the store reads it. */
export type RawHistoryState = { state: string; last_changed: string };

/** A stretch of time an on/off entity spent in one state (epoch ms). */
export type Interval = { start: number; end: number; on: boolean };

/**
 * The entity's recorded states over a window, oldest first. The URL is
 * relative, so it is same-origin like the calendar's (see `fetchCalendarEvents`).
 * `minimal_response` and `no_attributes` keep the reply small.
 */
export const fetchHistory = async (
  auth: Auth,
  entityId: string,
  start: Date,
  end: Date,
): Promise<RawHistoryState[]> => {
  const query = new URLSearchParams({
    filter_entity_id: entityId,
    end_time: end.toISOString(),
    minimal_response: '',
    no_attributes: '',
  });
  if (auth.expired) await auth.refreshAccessToken();
  const response = await fetch(
    `/api/history/period/${start.toISOString()}?${query}`,
    { headers: { Authorization: `Bearer ${auth.accessToken}` } },
  );
  if (!response.ok) throw new Error(`History ${entityId}: ${response.status}`);
  const rows = (await response.json()) as RawHistoryState[][];
  return rows[0] ?? [];
};

/**
 * Turns recorded states into back-to-back on/off intervals covering
 * `start`..`end`. States before `start` are clipped; `unavailable` and
 * `unknown` count as off (`isOn` decides what is on; by default the state
 * `on`). Returns `[]` when nothing was recorded, so the
 * sheet can show an empty state instead of a blank bar.
 */
export const toIntervals = (
  rows: RawHistoryState[],
  start: number,
  end: number,
  isOn: (state: string) => boolean = (state) => state === 'on',
): Interval[] => {
  const points = rows
    .map((row) => ({
      at: Math.max(start, Date.parse(row.last_changed)),
      on: isOn(row.state),
    }))
    .filter(({ at }) => Number.isFinite(at) && at < end)
    .sort((a, b) => a.at - b.at);
  const intervals: Interval[] = [];
  points.forEach((point, i) => {
    const next = points[i + 1]?.at ?? end;
    const last = intervals.at(-1);
    if (last?.on === point.on) last.end = next;
    else if (next > point.at) {
      intervals.push({ start: point.at, end: next, on: point.on });
    }
  });
  return intervals;
};

/** A numeric sensor's reading at one moment (epoch ms). */
export type Sample = { at: number; value: number };

/**
 * Turns a numeric sensor's recorded states into samples within `start`..`end`,
 * oldest first. A state before `start` is clipped to it; `unavailable`,
 * `unknown` and anything that is not a number are skipped.
 */
export const toSeries = (
  rows: RawHistoryState[],
  start: number,
  end: number,
): Sample[] =>
  rows
    .flatMap((row) => {
      const value = parseNumber(row.state);
      const at = Math.max(start, Date.parse(row.last_changed));
      return value === undefined || !Number.isFinite(at) || at >= end
        ? []
        : [{ at, value }];
    })
    .sort((a, b) => a.at - b.at);
