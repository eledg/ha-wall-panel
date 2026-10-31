import type { HassEntity } from 'home-assistant-js-websocket';

import { isUsable } from '@/services/ha/entity.ts';

export type WeatherAlertSeverity = 'yellow' | 'amber' | 'red';

export type WeatherAlert = {
  id: string;
  severity: WeatherAlertSeverity;
  /** Short hazard name, e.g. "Wind". */
  event: string;
  /** Heading for the details, e.g. "Strong winds". */
  title: string;
  /** ISO timestamps. */
  starts: string;
  ends: string;
  area: string;
  description: string;
  guidance: string;
  source: string;
};

const PRIORITY: Record<WeatherAlertSeverity, number> = {
  yellow: 1,
  amber: 2,
  red: 3,
};

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const isSeverity = (value: unknown): value is WeatherAlertSeverity =>
  typeof value === 'string' && value in PRIORITY;

const readAlert = (raw: unknown, index: number): WeatherAlert | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const item = raw as Record<string, unknown>;
  const severity = text(item.severity).toLowerCase();
  const event = text(item.event);
  if (!isSeverity(severity) || event === '') return undefined;
  return {
    id: text(item.id) || `${severity}-${event}-${index}`,
    severity,
    event,
    title: text(item.title) || event,
    starts: text(item.starts),
    ends: text(item.ends),
    area: text(item.area),
    description: text(item.description),
    guidance: text(item.guidance),
    source: text(item.source),
  };
};

/**
 * The warnings listed in the `warnings` attribute of the alerts sensor. Empty
 * while the sensor is missing or unavailable; malformed items are skipped.
 * Warnings come only from this sensor: they are never inferred from the forecast.
 */
export const readWeatherAlerts = (
  entity: HassEntity | undefined,
): WeatherAlert[] => {
  const raw = isUsable(entity) ? entity?.attributes.warnings : undefined;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => readAlert(item, index) ?? []);
};

/**
 * The warnings that are in force or still to come, most severe first and then
 * earliest start. Expired ones and ones with unusable times are dropped.
 */
export const relevantWeatherAlerts = (
  alerts: WeatherAlert[],
  now: Date,
): WeatherAlert[] =>
  alerts
    .filter((alert) => {
      const start = Date.parse(alert.starts);
      const end = Date.parse(alert.ends);
      return (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start < end &&
        end > now.getTime()
      );
    })
    .sort(
      (a, b) =>
        PRIORITY[b.severity] - PRIORITY[a.severity] ||
        Date.parse(a.starts) - Date.parse(b.starts),
    );

/** "Yellow warning". */
export const severityLabel = (alert: WeatherAlert) =>
  `${alert.severity.charAt(0).toUpperCase()}${alert.severity.slice(1)} warning`;

/** Classes that colour a control or panel by severity. */
export const ALERT_TONE: Record<WeatherAlertSeverity, string> = {
  yellow:
    'text-weather-yellow border-weather-yellow/50! bg-weather-yellow-soft!',
  amber: 'text-weather-amber border-weather-amber/50! bg-weather-amber-soft!',
  red: 'text-weather-red border-weather-red/50! bg-weather-red-soft!',
};
