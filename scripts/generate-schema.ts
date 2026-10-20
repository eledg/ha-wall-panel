import { writeFileSync } from 'node:fs';

import {
  CALENDAR_COLORS,
  CALENDAR_KINDS,
  DEFAULT_NIGHT,
  EXTRA_KEYS,
  TILE_ROLES,
  TILE_TYPES,
} from '../src/config/config.ts';
import type { TileType } from '../src/config/config.ts';

/**
 * Writes `config.schema.json` from the same tables the runtime validator reads,
 * so editor hints cannot drift from it. Structure only: grid bounds, overlap,
 * duplicate ids and entity domains stay in `validateConfig`.
 */

type Json = Record<string, unknown>;

const whole = (description: string): Json => ({
  type: 'integer',
  minimum: 1,
  description,
});

const text = (description: string): Json => ({
  type: 'string',
  minLength: 1,
  description,
});

const calendar: Json = {
  type: 'object',
  additionalProperties: false,
  required: ['entity'],
  properties: {
    entity: text('A calendar.* entity ID.'),
    label: { type: 'string', description: 'The name in the legend.' },
    color: {
      enum: [...CALENDAR_COLORS],
      description: 'By default the colours are used in turn.',
    },
    kind: {
      enum: [...CALENDAR_KINDS],
      description:
        '"f1" shortens race titles and hides their notes; "birthdays" adds the age from a "Born 1977" note.',
    },
  },
};

const extras: Json = {
  calendars: {
    type: 'array',
    minItems: 1,
    items: calendar,
    description: 'The calendars merged into the agenda.',
  },
  roomLabel: text('The room named in the "<room> now" caption.'),
};

const common: Json = {
  id: text('A name unique across the file. Default: the type and a count.'),
  label: text('The name shown on the tile.'),
  col: whole('Left column, 1 to 6.'),
  row: whole('Top row, 1 to 3.'),
  w: whole('Columns spanned. Default 1.'),
  h: whole('Rows spanned. Default 1.'),
};

const tile = (type: TileType): Json => {
  const roles = Object.entries(
    TILE_ROLES[type] as Record<string, { domain: string; optional?: true }>,
  );
  const own = EXTRA_KEYS[type] ?? [];
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'type',
      'col',
      'row',
      ...roles.filter(([, spec]) => !spec.optional).map(([role]) => role),
      ...own.filter((key) => key === 'calendars'),
    ],
    properties: {
      type: { const: type },
      ...common,
      ...Object.fromEntries(
        roles.map(([role, spec]) => [
          role,
          text(`A ${spec.domain}.* entity ID.`),
        ]),
      ),
      ...Object.fromEntries(own.map((key) => [key, extras[key]])),
    },
  };
};

export const buildSchema = (): Json => ({
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'ha-wall-panel config.json',
  type: 'object',
  additionalProperties: false,
  required: ['tiles'],
  properties: {
    $schema: { type: 'string' },
    tiles: {
      type: 'array',
      description: 'The tiles on the display, each with its position.',
      items: { oneOf: TILE_TYPES.map(tile) },
    },
    night: {
      type: 'object',
      additionalProperties: false,
      description: 'Dim warm palette between startHour and endHour.',
      properties: Object.fromEntries(
        Object.entries(DEFAULT_NIGHT).map(([key, value]) => [
          key,
          { type: 'number', default: value },
        ]),
      ),
    },
    locale: text('A language tag such as "en-GB".'),
    timeZone: text('An IANA time zone name such as "Europe/London".'),
  },
});

export const SCHEMA_PATH = 'config.schema.json';

if (import.meta.main) {
  writeFileSync(SCHEMA_PATH, `${JSON.stringify(buildSchema(), null, 2)}\n`);
}
