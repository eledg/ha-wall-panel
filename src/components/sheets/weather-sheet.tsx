import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import { ClimateSheet } from '@/components/climate/climate-controls.tsx';
import { ArrowIcon } from '@/components/icons/arrow-icon.tsx';
import { DropletIcon } from '@/components/icons/droplet-icon.tsx';
import { EyeIcon } from '@/components/icons/eye-icon.tsx';
import { GaugeIcon } from '@/components/icons/gauge-icon.tsx';
import { SunriseIcon } from '@/components/icons/sunrise-icon.tsx';
import { SunsetIcon } from '@/components/icons/sunset-icon.tsx';
import { ThermoIcon } from '@/components/icons/thermo-icon.tsx';
import { WeatherIcon } from '@/components/icons/weather-icon.tsx';
import { WindIcon } from '@/components/icons/wind-icon.tsx';
import {
  WeatherAlertControl,
  WeatherAlertDetails,
} from '@/components/sheets/weather-alerts.tsx';
import type { TileConfig, WeatherStat } from '@/config/config.ts';
import { IDLE_CLOSE_MS } from '@/config/constants.ts';
import { useIdleClose } from '@/hooks/use-idle-close.ts';
import { useOffline } from '@/hooks/use-offline.ts';
import { useSnapshot } from '@/hooks/use-snapshot.ts';
import { formatTime } from '@/lib/format.ts';
import {
  readWeatherAlerts,
  relevantWeatherAlerts,
} from '@/lib/weather-alerts.ts';
import {
  dayLabel,
  degrees,
  describe,
  hour,
  percent,
  pickForecast,
  rangeBar,
  readWeather,
  weekRange,
} from '@/lib/weather-model.ts';
import type { Measure } from '@/lib/weather-model.ts';
import { haStore } from '@/services/ha/instance.ts';
import type { ForecastItem, HaStore } from '@/services/ha/store.ts';

/** The forecasts are re-read on open when they are older than this. */
export const WEATHER_MAX_AGE_MS = 10 * 60_000;

/** A rounded reading with its unit set small and dim, so four figures still fit a narrow box. */
const withUnit = ({ value, unit }: Measure) => (
  <span>
    {Math.round(value)}
    {unit && <span class="text-xs font-normal text-fg-dim"> {unit}</span>}
  </span>
);

type StatItem = {
  icon: ComponentChildren;
  label: string;
  value: ComponentChildren;
  /** Spans two of the three columns, for a value that needs the room. */
  wide?: boolean;
};

// The display is 459 px tall and the sheet's header takes most of the rest, so
// the stats are small: they must fit beside the week without scrolling. The
// icon sits on the label line so the value can use the box's whole width.
const Stat = ({ icon, label, value, wide }: StatItem) => (
  <div
    class={`min-w-0 rounded-lg border border-line bg-surface-2 px-2.5 py-1 ${
      wide ? 'col-span-2' : ''
    }`}
  >
    <span class="flex items-center gap-1 text-xs text-fg-dim">
      {icon}
      <span class="truncate">{label}</span>
    </span>
    <span class="tnum block truncate text-sm font-medium">{value}</span>
  </div>
);

/** One decimal for light rain, whole millimetres once it is heavy. */
const millimetres = (amount: number) =>
  amount < 10 ? amount.toFixed(1) : String(Math.round(amount));

/** Rain in mm for one hour: nothing when dry or when the source gave no figure. */
const rainAmount = (item: ForecastItem, unit = 'mm') => {
  const amount = item.precipitation;
  if (typeof amount !== 'number' || amount <= 0) return undefined;
  return `${millimetres(amount)} ${unit}`;
};

/**
 * Full-screen weather detail, as in the design: current conditions and the
 * figures behind them on the left, the next hours and the week on the right.
 * Read-only. Every figure appears only when the entity or its forecast reports
 * it, so an integration with less data gets a shorter sheet, not gaps. The
 * forecasts are refetched on open when they are stale, and the sheet closes
 * after `idleMs` without a touch.
 */
export const WeatherSheet = ({
  tile,
  onClose,
  store = haStore,
  now = () => new Date(),
  idleMs = IDLE_CLOSE_MS,
}: {
  tile: TileConfig<'weather'>;
  onClose: () => void;
  store?: HaStore;
  now?: () => Date;
  idleMs?: number;
}) => {
  const { entity: id, sun: sunId, alerts: alertsId } = tile.entities;
  const { details } = tile;
  const [entity, hourly, daily, sun, alertsEntity] = useSnapshot(
    store,
    (s) =>
      [
        s.entities[id],
        s.forecasts[id],
        s.dailyForecasts[id],
        s.entities[sunId ?? ''],
        s.entities[alertsId ?? ''],
      ] as const,
  );
  const [alertsOpen, setAlertsOpen] = useState(false);
  const offline = useOffline();
  const onActivity = useIdleClose(onClose, idleMs);

  useEffect(() => {
    void store.refreshWeather(id, WEATHER_MAX_AGE_MS);
  }, [store, id]);

  const at = now();
  const view = readWeather(entity, hourly, daily, sun, at);
  const alerts = relevantWeatherAlerts(readWeatherAlerts(alertsEntity), at);
  if (!view.usable || !entity) {
    return (
      <ClimateSheet
        title="Weather"
        titleId="weather-title"
        status="Weather unavailable"
        warning
        onClose={onClose}
        onActivity={onActivity}
      >
        <div class="text-fg-dim">Will retry automatically</div>
      </ClimateSheet>
    );
  }

  const unit = (name: string) => entity.attributes[name] as string | undefined;
  const { wind } = view;
  // What each configured stat shows, or nothing when the source lacks it.
  const available: Record<WeatherStat, StatItem | false | undefined> = {
    wind: wind && {
      wide: true,
      icon: <WindIcon class="size-3.5 shrink-0" />,
      label: 'Wind',
      value: (
        <span class="flex items-center gap-1.5">
          {withUnit(wind.speed)}
          {wind.direction && <span>{wind.direction}</span>}
          {wind.bearing !== undefined && (
            // The bearing is where the wind comes from; the arrow points where it goes.
            <span
              class="inline-block text-fg-dim"
              style={{ transform: `rotate(${wind.bearing + 180}deg)` }}
            >
              <ArrowIcon class="size-4" />
            </span>
          )}
          {wind.gust !== undefined && (
            <span class="text-fg-dim">gusts {Math.round(wind.gust)}</span>
          )}
        </span>
      ),
    },
    feelsLike: view.feelsLike !== undefined && {
      icon: <ThermoIcon class="size-3.5 shrink-0" />,
      label: 'Feels like',
      value: degrees(view.feelsLike),
    },
    humidity: view.humidity !== undefined && {
      icon: <DropletIcon class="size-3.5 shrink-0" />,
      label: 'Humidity',
      value: percent(view.humidity),
    },
    uv: view.uvIndex !== undefined && {
      icon: <WeatherIcon condition="sunny" class="size-3.5 shrink-0" />,
      label: 'UV index',
      value: Math.round(view.uvIndex),
    },
    pressure: view.pressure && {
      icon: <GaugeIcon class="size-3.5 shrink-0" />,
      label: 'Pressure',
      value: withUnit(view.pressure),
    },
    visibility: view.visibility && {
      icon: <EyeIcon class="size-3.5 shrink-0" />,
      label: 'Visibility',
      value: withUnit(view.visibility),
    },
    dewPoint: view.dewPoint !== undefined && {
      icon: <ThermoIcon class="size-3.5 shrink-0" />,
      label: 'Dew point',
      value: degrees(view.dewPoint),
    },
    sunrise: view.sunrise && {
      icon: <SunriseIcon class="size-3.5 shrink-0" />,
      label: 'Sunrise',
      value: formatTime(view.sunrise),
    },
    sunset: view.sunset && {
      icon: <SunsetIcon class="size-3.5 shrink-0" />,
      label: 'Sunset',
      value: formatTime(view.sunset),
    },
  };
  const shown = details.stats.flatMap((stat) => available[stat] || []);

  const hours = pickForecast(
    hourly ?? [],
    at,
    details.hoursStep,
    details.hoursCount,
  );
  const days = (daily ?? []).slice(0, details.days);
  const week = weekRange(days);
  const rainUnit = unit('precipitation_unit');
  const hasForecast = hours.length > 0 || days.length > 0;
  const updated = formatTime(new Date(entity.last_updated));

  return (
    <ClimateSheet
      title="Weather"
      titleId="weather-title"
      status={`${view.label} · ${offline ? 'stale, last updated' : 'updated'} ${updated}`}
      headerAction={
        <WeatherAlertControl
          alerts={alerts}
          onOpen={() => setAlertsOpen(true)}
        />
      }
      onClose={onClose}
      onActivity={onActivity}
    >
      <div
        class={`grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto ${
          hasForecast
            ? 'min-[700px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
            : ''
        } ${offline ? 'opacity-60' : ''}`}
      >
        <div class="flex min-w-0 flex-col gap-2">
          <div class="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
            <WeatherIcon
              condition={view.icon}
              class="size-16 shrink-0 text-fg"
            />
            <div class="min-w-0">
              <div class="tnum text-5xl leading-none font-semibold">
                {degrees(view.temperature)}
              </div>
              <div class="tnum mt-1 truncate text-sm text-fg-dim">
                {view.label}
                {view.high !== undefined && ` · H ${degrees(view.high)}`}
                {view.low !== undefined && ` L ${degrees(view.low)}`}
              </div>
            </div>
          </div>
          {shown.length > 0 && (
            <div class="grid grid-flow-dense grid-cols-3 gap-1.5">
              {shown.map((stat) => (
                <Stat key={stat.label} {...stat} />
              ))}
            </div>
          )}
        </div>

        {hasForecast && (
          <div class="flex min-w-0 flex-col gap-2">
            {hours.length > 0 && (
              <section
                aria-label="Next hours"
                class="rounded-xl border border-line bg-surface-2 px-2 py-1.5"
              >
                <div
                  class="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))`,
                  }}
                >
                  {hours.map((period) => (
                    <div
                      key={period.datetime}
                      class="flex flex-col items-center"
                    >
                      <span class="tnum text-xs text-fg-dim">
                        {hour(period.datetime)}:00
                      </span>
                      <WeatherIcon
                        condition={describe(period.condition)[0]}
                        class="my-0.5 size-6 text-fg"
                      />
                      <span class="tnum text-base leading-tight font-medium">
                        {degrees(period.temperature)}
                      </span>
                      <span class="tnum flex items-center gap-0.5 text-xs text-fg-dim">
                        <DropletIcon class="size-3" />
                        {percent(period.precipitation_probability)}
                      </span>
                      <span class="tnum text-xs text-fg-dim">
                        {rainAmount(period, rainUnit)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {days.length > 0 && (
              <section
                aria-label={`${days.length}-day outlook`}
                class="rounded-xl border border-line bg-surface-2 px-2 py-1"
              >
                <ul class="flex flex-col divide-y divide-line">
                  {days.map((day, i) => {
                    const bar = week && rangeBar(day, week);
                    return (
                      <li
                        key={day.datetime}
                        class="flex items-center gap-3 py-0.5"
                      >
                        <span class="w-12 shrink-0 text-sm font-medium">
                          {dayLabel(day.datetime, i)}
                        </span>
                        <WeatherIcon
                          condition={describe(day.condition)[0]}
                          class="size-5 shrink-0 text-fg-dim"
                        />
                        <span class="tnum flex w-12 shrink-0 items-center gap-0.5 text-xs text-fg-dim">
                          <DropletIcon class="size-3" />
                          {percent(day.precipitation_probability)}
                        </span>
                        <span class="tnum w-8 shrink-0 text-right text-sm text-fg-dim">
                          {degrees(day.templow)}
                        </span>
                        <span class="relative h-1.5 min-w-0 flex-1 rounded-full bg-surface">
                          {bar && (
                            <span
                              class="absolute h-full rounded-full bg-accent"
                              style={{
                                left: `${bar.left}%`,
                                width: `${bar.width}%`,
                              }}
                            />
                          )}
                        </span>
                        <span class="tnum w-8 shrink-0 text-right text-sm font-medium">
                          {degrees(day.temperature)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
      {alertsOpen && alerts.length > 0 && (
        <WeatherAlertDetails
          alerts={alerts}
          now={at}
          onClose={() => setAlertsOpen(false)}
        />
      )}
    </ClimateSheet>
  );
};
