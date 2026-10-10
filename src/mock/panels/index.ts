import { calendarPanel } from './calendar.tsx';
import { connectionPanel } from './connection.tsx';
import { lightPanel } from './light.tsx';
import type { MockPanel } from './types.ts';
import { weatherPanel } from './weather.tsx';

/** To mock a new tile, add a panel file and list it here. */
export const panels: MockPanel[] = [
  connectionPanel,
  weatherPanel,
  calendarPanel,
  lightPanel,
];
