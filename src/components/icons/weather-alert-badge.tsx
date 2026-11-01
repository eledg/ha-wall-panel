import {
  ALERT_TONE,
  severityLabel,
  type WeatherAlert,
} from '@/lib/weather-alerts.ts';

import { AlertIcon } from './alert-icon.tsx';

/** A small severity-coloured marker for the most severe warning; nothing when there are none. */
export const WeatherAlertBadge = ({ alerts }: { alerts: WeatherAlert[] }) => {
  const [alert] = alerts;
  if (!alert) return null;
  const label = `${severityLabel(alert)}: ${alert.event}${
    alerts.length > 1 ? ` · ${alerts.length} warnings` : ''
  }`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      class={`flex h-7 shrink-0 items-center gap-0.5 rounded-md border px-1 ${ALERT_TONE[alert.severity]}`}
    >
      <AlertIcon class="size-4" />
      {alerts.length > 1 && <span class="text-xs">{alerts.length}</span>}
    </span>
  );
};
