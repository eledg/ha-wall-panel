import { DEFAULT_NIGHT, entitiesFrom } from '@/config/config.ts';
import type { EntityKey, RuntimeConfig } from '@/config/config.ts';

/** Fixture entity IDs, standing in for a real `config.json` in the mock and in tests. */
const IDS: Record<EntityKey, string> = {
  light: 'switch.wall_light',
  weather: 'weather.home',
  calendarFamily: 'calendar.family',
  calendarF1: 'calendar.f1',
  calendarBirthdays: 'calendar.birthdays',
  acClimate: 'climate.ac',
  acPowerful: 'switch.ac_powerful',
  acEconomy: 'switch.ac_economy',
  acQuietFan: 'switch.ac_quiet_fan',
  roomTemperature: 'sensor.room_temperature',
  roomHumidity: 'sensor.room_humidity',
  roomBattery: 'sensor.room_battery',
  heatingClimate: 'climate.heating',
  heatingSchedule: 'switch.heating_schedule',
  heatingDemand: 'binary_sensor.heating_demand',
  heatingCloud: 'binary_sensor.heating_cloud_connection',
  heatingResume: 'button.heating_resume_schedule',
  heatingBoost: 'button.heating_boost',
};

export const mockConfig: RuntimeConfig = {
  entities: entitiesFrom((key) => IDS[key]),
  night: DEFAULT_NIGHT,
  labels: { light: 'Office light', room: 'Office', ac: 'Office AC' },
};
