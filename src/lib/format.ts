const time = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** 24h `HH:MM`, as the clock shows it. */
export const formatTime = (value: Date | number) => time.format(value);

/** One decimal, as the design shows it (`21.4`). */
export const formatTemp = (value: number) => value.toFixed(1);

/** Whole percent, as the design shows it (`51%`). */
export const formatHumidity = (value: number) => `${Math.round(value)}%`;
