import { firstTile } from '@/config/config.ts';
import type { TileType } from '@/config/config.ts';
import { mockConfig } from '@/dev/mock/config.ts';

/** The first fixture tile of `type`: what a tile test renders. */
export const tileOf = <T extends TileType>(type: T) => {
  const tile = firstTile(type, mockConfig);
  if (!tile) throw new Error(`The fixture config has no ${type} tile`);
  return tile;
};

const toggle = tileOf('toggle').entities;
const weather = tileOf('weather').entities;
const [family, birthdays, f1] = tileOf('calendar').calendars;
const ac = tileOf('ac').entities;
const room = tileOf('temperature').entities;
const heating = tileOf('heating').entities;

/** Fixture entity IDs by short name, for tests that read one entity. */
export const IDS = {
  light: toggle.entity,
  weather: weather.entity,
  calendarFamily: family!.entity,
  calendarBirthdays: birthdays!.entity,
  calendarF1: f1!.entity,
  acClimate: ac.climate,
  acPowerful: ac.powerful,
  acEconomy: ac.economy,
  acQuietFan: ac.quietFan,
  roomTemperature: room.temperature,
  roomHumidity: room.humidity,
  roomBattery: room.battery!,
  heatingClimate: heating.climate,
  heatingSchedule: heating.schedule,
  heatingDemand: heating.demand,
  heatingCloud: heating.cloud,
  heatingResume: heating.resume,
  heatingBoost: heating.boost,
} as const;

export const entityId = (key: keyof typeof IDS) => IDS[key];

/** Any placement, for tests of a tile that doesn't care where it sits. */
export const PLACE = { col: 1, row: 1, w: 1, h: 1 };
