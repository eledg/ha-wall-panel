import type { RawHistoryState } from '@/services/ha/history.ts';

const HOUR = 3_600_000;
const STEP_MS = 600_000;
/** Samples across the six hours, ten minutes apart. */
const SAMPLES = 37;

/** Minutes from the window's start where the AC alternates off and cool. */
const AC_BOUNDARIES = [0, 150, 200, 255, 290, 360];

const stamp = (at: number) => new Date(at).toISOString();

/** The recorded states of the AC's climate entity over the last six hours. */
export const acHistory = (now: number): RawHistoryState[] => {
  const start = now - 6 * HOUR;
  return AC_BOUNDARIES.slice(0, -1).map((minute, i) => ({
    state: i % 2 === 1 ? 'cool' : 'off',
    last_changed: stamp(start + minute * 60_000),
  }));
};

const isOn = (boundaries: number[], minute: number) =>
  boundaries.findIndex((b, i) => minute >= b && minute < boundaries[i + 1]!) %
    2 ===
  1;

/** How much the room changes in ten minutes: the AC cools and dries, the heating warms. */
const drift = (heating: boolean, cooling: boolean) => {
  if (cooling) return { dTemperature: -0.22, dHumidity: -0.6 };
  if (heating) return { dTemperature: 0.18, dHumidity: -0.15 };
  return { dTemperature: -0.05, dHumidity: 0.12 };
};

/**
 * Six hours of room temperature and humidity that react to the heating and
 * the AC, shifted so the last sample is the live reading. `heating` is the
 * demand sensor's boundaries in minutes, as in `demandHistory`.
 */
export const climateHistory = (
  now: number,
  heatingBoundaries: number[],
  latest: { temperature: number; humidity: number },
): { temperature: RawHistoryState[]; humidity: RawHistoryState[] } => {
  const start = now - 6 * HOUR;
  let temperature = 20;
  let humidity = 50;
  const raw = Array.from({ length: SAMPLES }, (_, i) => {
    const minute = (i * STEP_MS) / 60_000;
    const heating = isOn(heatingBoundaries, minute);
    const cooling = isOn(AC_BOUNDARIES, minute);
    const { dTemperature, dHumidity } = drift(heating, cooling);
    temperature += dTemperature;
    humidity += dHumidity;
    return {
      at: start + i * STEP_MS,
      temperature: temperature + Math.sin(i / 2) * 0.1,
      humidity,
    };
  });
  const last = raw.at(-1)!;
  const dT = latest.temperature - last.temperature;
  const dH = latest.humidity - last.humidity;
  const series = (
    pick: (r: (typeof raw)[number]) => number,
    d: number,
    dp: number,
  ) =>
    raw.map((r, i) => ({
      state: (
        Math.round((pick(r) + (d * i) / (raw.length - 1)) * 10 ** dp) /
        10 ** dp
      ).toFixed(dp),
      last_changed: stamp(r.at),
    }));
  return {
    temperature: series((r) => r.temperature, dT, 1),
    humidity: series((r) => r.humidity, dH, 0),
  };
};
