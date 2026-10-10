const time = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** 24h `HH:MM`, as the clock shows it. */
export const formatTime = (value: Date | number) => time.format(value);
