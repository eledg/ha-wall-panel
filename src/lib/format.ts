import { dateFormat } from '@/config/datetime.ts';

/** `09:41` or `09:41 AM`: the configured locale decides, as the clock shows it. */
export const formatTime = (value: Date | number) =>
  dateFormat({ hour: '2-digit', minute: '2-digit' }).format(value);

/** One decimal, as the design shows it (`21.4`). */
export const formatTemp = (value: number) => value.toFixed(1);

/** Whole percent (`51%`). */
export const formatPercent = (value: number) => `${Math.round(value)}%`;

/** Whole percent, as the design shows it (`51%`). */
export const formatHumidity = formatPercent;
