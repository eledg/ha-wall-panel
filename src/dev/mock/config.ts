import {
  DEFAULT_NIGHT,
  DEFAULT_WEATHER_DETAILS,
  DEFAULT_WEATHER_METRIC,
} from '@/config/config.ts';
import type { RuntimeConfig } from '@/config/config.ts';

/**
 * Fixture tiles, standing in for a real `config.json` in the mock and in tests.
 * The layout matches the one the dashboard shipped with, and the e2e baselines
 * depend on it. The mock's controls act on the first tile of each type.
 */
export const mockConfig: RuntimeConfig = {
  tiles: [
    {
      id: 'clock',
      type: 'clock',
      label: '',
      col: 1,
      row: 1,
      w: 3,
      h: 1,
      entities: {},
    },
    {
      id: 'weather',
      type: 'weather',
      label: 'Weather',
      col: 1,
      row: 2,
      w: 3,
      h: 1,
      entities: { entity: 'weather.home', sun: 'sun.sun' },
      details: DEFAULT_WEATHER_DETAILS,
      metric: DEFAULT_WEATHER_METRIC,
    },
    {
      id: 'calendar',
      type: 'calendar',
      label: 'Calendar',
      col: 4,
      row: 1,
      w: 3,
      h: 2,
      entities: {},
      calendars: [
        { entity: 'calendar.family', label: 'Family', color: 'yellow' },
        {
          entity: 'calendar.birthdays',
          label: 'Birthdays',
          color: 'blue',
          showYears: true,
        },
        {
          entity: 'calendar.f1',
          label: 'F1',
          color: 'green',
          hideNotes: true,
          title: {
            match: String.raw`^(\S+)\s+FORMULA 1\s.*\s-\s(.+)$`,
            replace: '$1 F1 {location} - $2',
          },
        },
      ],
    },
    {
      id: 'light',
      type: 'toggle',
      label: 'Office light',
      col: 1,
      row: 3,
      w: 2,
      h: 1,
      entities: { entity: 'switch.wall_light' },
    },
    {
      id: 'room',
      type: 'temperature',
      label: 'Office',
      col: 3,
      row: 3,
      w: 1,
      h: 1,
      entities: {
        temperature: 'sensor.room_temperature',
        humidity: 'sensor.room_humidity',
        battery: 'sensor.room_battery',
      },
    },
    {
      id: 'heating',
      type: 'heating',
      label: 'Heating',
      roomLabel: 'Living room',
      col: 4,
      row: 3,
      w: 1,
      h: 1,
      entities: {
        climate: 'climate.heating',
        schedule: 'switch.heating_schedule',
        demand: 'binary_sensor.heating_demand',
        power: 'sensor.heating_power',
        cloud: 'binary_sensor.heating_cloud_connection',
        resume: 'button.heating_resume_schedule',
        boost: 'button.heating_boost',
      },
    },
    {
      id: 'ac',
      type: 'ac',
      label: 'AC',
      roomLabel: 'Room',
      col: 5,
      row: 3,
      w: 1,
      h: 1,
      entities: {
        climate: 'climate.ac',
        powerful: 'switch.ac_powerful',
        economy: 'switch.ac_economy',
        quietFan: 'switch.ac_quiet_fan',
        room: 'sensor.room_temperature',
      },
    },
  ],
  night: { ...DEFAULT_NIGHT, overrideSwitch: 'switch.night_override' },
  // Pinned so the e2e baselines look the same on any machine.
  locale: 'en-GB',
  timeZone: 'Europe/London',
};
