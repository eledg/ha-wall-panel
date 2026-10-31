import { HISTORY_HOURS } from '@/components/climate/heating-history.tsx';
import {
  bands,
  CHART_H,
  CHART_W,
  extent,
  linePath,
  stepArea,
  targetY,
  tempScale,
} from '@/lib/climate/room-model.ts';
import { formatTime } from '@/lib/format.ts';
import type { Interval, Sample } from '@/services/ha/history.ts';

/**
 * A run of heating or AC history, with the target to draw while it is on. A
 * `power` series (percent) is drawn as a stepped area in place of the runs.
 */
export type Demand = {
  intervals: Interval[];
  power?: Sample[];
  target?: number;
};

const GRID = [0.25, 0.5, 0.75];

const Swatch = ({ tone, label }: { tone: string; label: string }) => (
  <span class="flex items-center gap-1">
    <span class={`size-3 rounded-sm ${tone}`} />
    <span>{label}</span>
  </span>
);

/**
 * Temperature (solid) and humidity (dashed) over the history window, with the
 * stretches the heating or AC ran shaded behind (heating as steps of its power
 * in percent when it has that) and, while one is on, its
 * target as a dashed line. `undefined` means still loading; no temperature
 * samples shows the empty state. Drawn as plain SVG stretched to fit, with
 * non-scaling strokes.
 */
export const RoomChart = ({
  temps,
  humidity,
  heating,
  ac,
  start,
  end,
}: {
  temps: Sample[] | undefined;
  humidity: Sample[] | undefined;
  heating?: Demand;
  ac?: Demand;
  start?: number;
  end?: number;
}) => {
  const range = extent(temps);
  const scale = range && tempScale(range.min, range.max);
  const ready =
    temps !== undefined &&
    scale !== undefined &&
    start !== undefined &&
    end !== undefined;
  const labels =
    start === undefined || end === undefined
      ? []
      : [0, 1 / 3, 2 / 3, 1].map((f) => start + f * (end - start));

  return (
    <section
      class="flex min-w-0 flex-col rounded-xl border border-line bg-surface-2 p-3"
      aria-label={`Climate over the last ${HISTORY_HOURS} hours`}
    >
      <div class="mb-2 flex items-center justify-between text-xs text-fg-dim">
        <h3>Last {HISTORY_HOURS} hours</h3>
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <span class="h-0.5 w-4 bg-fg" />
            <span>Temp</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="w-4 border-t-2 border-dashed border-humidity" />
            <span>Humidity</span>
          </span>
          {heating && <Swatch tone="bg-accent-soft" label="Heating" />}
          {ac && <Swatch tone="bg-cool-soft" label="AC" />}
        </div>
      </div>
      {ready ? (
        <>
          <div class="flex min-h-24 flex-1 gap-2">
            <div class="tnum flex flex-col justify-between text-xs text-fg-dim">
              <span>{scale.max}°</span>
              <span>{(scale.min + scale.max) / 2}°</span>
              <span>{scale.min}°</span>
            </div>
            <div class="relative min-w-0 flex-1">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="none"
                class="absolute inset-0 size-full overflow-visible"
                role="img"
                aria-label="Temperature and humidity chart"
              >
                {heating?.power && heating.power.length > 0 && (
                  <path
                    d={stepArea(heating.power, start, end)}
                    class="fill-accent-soft"
                  />
                )}
                {[
                  {
                    demand: heating?.power?.length ? undefined : heating,
                    tone: 'fill-accent-soft',
                  },
                  { demand: ac, tone: 'fill-cool-soft' },
                ].flatMap(({ demand, tone }) =>
                  demand
                    ? bands(demand.intervals, start, end).map((band) => (
                        <rect
                          key={`${tone}${band.x}`}
                          x={band.x}
                          y={0}
                          width={band.width}
                          height={CHART_H}
                          class={tone}
                        />
                      ))
                    : [],
                )}
                {GRID.map((f) => (
                  <line
                    key={f}
                    x1={0}
                    x2={CHART_W}
                    y1={CHART_H * f}
                    y2={CHART_H * f}
                    class="stroke-line"
                    vector-effect="non-scaling-stroke"
                  />
                ))}
                {[
                  { demand: heating, tone: 'stroke-accent' },
                  { demand: ac, tone: 'stroke-cool' },
                ].map(({ demand, tone }) => {
                  const at = targetY(demand?.target, scale.min, scale.max);
                  return at === undefined ? null : (
                    <line
                      key={tone}
                      x1={0}
                      x2={CHART_W}
                      y1={at}
                      y2={at}
                      class={tone}
                      stroke-width={1.5}
                      stroke-dasharray="4 4"
                      vector-effect="non-scaling-stroke"
                    />
                  );
                })}
                {humidity && humidity.length > 0 && (
                  <path
                    d={linePath(humidity, start, end, 0, 100)}
                    fill="none"
                    class="stroke-humidity"
                    stroke-width={2}
                    stroke-dasharray="5 4"
                    vector-effect="non-scaling-stroke"
                  />
                )}
                <path
                  d={linePath(temps, start, end, scale.min, scale.max)}
                  fill="none"
                  class="stroke-fg"
                  stroke-width={2.5}
                  stroke-linejoin="round"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div class="tnum flex flex-col justify-between text-xs text-humidity">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
          </div>
          <div class="tnum mt-1 flex justify-between pr-9 pl-7 text-xs text-fg-dim">
            {labels.map((at) => (
              <span key={at}>{formatTime(at)}</span>
            ))}
          </div>
        </>
      ) : (
        <div class="grid min-h-24 flex-1 place-items-center text-xs text-fg-dim">
          {temps === undefined ? 'Loading…' : 'No climate history available'}
        </div>
      )}
    </section>
  );
};
