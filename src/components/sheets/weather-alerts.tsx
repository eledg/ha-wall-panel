import { useEffect, useRef } from 'preact/hooks';

import { ClimateButton } from '@/components/climate/climate-controls.tsx';
import { AlertIcon } from '@/components/icons/alert-icon.tsx';
import { XIcon } from '@/components/icons/x-icon.tsx';
import { formatDayTime } from '@/lib/format.ts';
import {
  ALERT_TONE,
  severityLabel,
  type WeatherAlert,
} from '@/lib/weather-alerts.ts';

/** The weather sheet's header control: the top warning, tapped to read them all. */
export const WeatherAlertControl = ({
  alerts,
  onOpen,
}: {
  alerts: WeatherAlert[];
  onOpen: () => void;
}) => {
  const [alert] = alerts;
  if (!alert) return null;
  return (
    <ClimateButton
      onClick={onOpen}
      aria-label={`View ${severityLabel(alert).toLowerCase()}: ${alert.event}`}
      class={`flex min-w-0 items-center gap-2 px-3 text-left ${ALERT_TONE[alert.severity]}`}
    >
      <AlertIcon class="size-5 shrink-0" />
      <span class="min-w-0">
        <span class="block truncate text-sm font-semibold">
          {severityLabel(alert)}: {alert.event}
          {alerts.length > 1 ? ` +${alerts.length - 1}` : ''}
        </span>
        <span class="tnum hidden text-xs min-[700px]:block">
          Until {formatDayTime(Date.parse(alert.ends))}
        </span>
      </span>
    </ClimateButton>
  );
};

/**
 * Every warning in full, over the weather sheet. Escape and the backdrop close
 * only this dialog; Tab stays inside it, and focus returns to the opener.
 */
export const WeatherAlertDetails = ({
  alerts,
  now,
  onClose,
}: {
  alerts: WeatherAlert[];
  now: Date;
  onClose: () => void;
}) => {
  const panel = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector('button')?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);

  const trapFocus = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      const buttons = panel.current?.querySelectorAll('button');
      const first = buttons?.[0];
      const last = buttons?.[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return (
    <div
      data-blocks-reload
      class="absolute inset-0 z-30 flex items-center justify-center p-6"
    >
      {/* Tapping outside closes; keyboard users have Escape and the Close button. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        class="absolute inset-0 bg-bg opacity-90"
        onClick={onClose}
      />
      <dialog
        open
        ref={panel}
        aria-modal="true"
        aria-labelledby="weather-alert-title"
        class="relative m-0 flex max-h-full w-full max-w-2xl flex-col rounded-lg border border-line bg-surface p-5 text-fg"
        onKeyDown={trapFocus}
      >
        <header class="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 id="weather-alert-title" class="text-xl font-semibold">
            Weather warnings
          </h2>
          <ClimateButton
            aria-label="Close warning details"
            onClick={onClose}
            class="grid size-14 shrink-0 place-items-center rounded-full"
          >
            <XIcon class="size-6" />
          </ClimateButton>
        </header>
        <div class="min-h-0 space-y-4 overflow-y-auto">
          {alerts.map((alert) => (
            <section
              key={alert.id}
              class={`rounded-lg border p-4 ${ALERT_TONE[alert.severity]}`}
            >
              <h3 class="flex items-center gap-2 text-lg font-semibold">
                <AlertIcon class="size-5 shrink-0" />
                {severityLabel(alert)}: {alert.title}
              </h3>
              <p class="tnum mt-1 text-sm">
                {Date.parse(alert.starts) > now.getTime()
                  ? 'Upcoming'
                  : 'Active'}{' '}
                · {formatDayTime(Date.parse(alert.starts))} –{' '}
                {formatDayTime(Date.parse(alert.ends))}
              </p>
              {alert.area && (
                <p class="mt-1 text-sm text-fg-dim">{alert.area}</p>
              )}
              {alert.description && (
                <p class="mt-3 text-base text-fg">{alert.description}</p>
              )}
              {alert.guidance && (
                <p class="mt-2 text-sm text-fg">{alert.guidance}</p>
              )}
              {alert.source && (
                <p class="mt-3 text-xs text-fg-dim">{alert.source}</p>
              )}
            </section>
          ))}
        </div>
      </dialog>
    </div>
  );
};
