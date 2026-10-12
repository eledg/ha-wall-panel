import { acPanel } from './ac.tsx';
import { calendarPanel } from './calendar.tsx';
import { connectionPanel } from './connection.tsx';
import { lightPanel } from './light.tsx';
import { nightPanel } from './night.tsx';
import type { MockPanel } from './types.ts';
import { weatherPanel } from './weather.tsx';

/** To mock a new tile, add a panel file and list it here. */
export const panels: MockPanel[] = [
  connectionPanel,
  weatherPanel,
  calendarPanel,
  lightPanel,
  acPanel,
  nightPanel,
];
