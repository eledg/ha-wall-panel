import { readFileSync } from 'node:fs';

import { Ajv } from 'ajv';
import { describe, expect, it } from 'vitest';

import { buildSchema, SCHEMA_PATH } from './scripts/generate-schema.ts';
import {
  COMMON_KEYS,
  EXTRA_KEYS,
  TILE_ROLES,
  TILE_TYPES,
} from './src/config/config.ts';
import { stripJsonComments } from './src/config/jsonc.ts';

type TileSchema = { properties: Record<string, unknown> };

const committed = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as {
  properties: { tiles: { items: { oneOf: TileSchema[] } } };
};
const validate = new Ajv({ strict: false }).compile(committed);

const example = JSON.parse(
  stripJsonComments(readFileSync('config.example.jsonc', 'utf8')),
) as { tiles: Record<string, unknown>[] };

describe('config.schema.json', () => {
  it('is up to date (run `pnpm schema:generate` to regenerate it)', () => {
    expect(committed).toEqual(buildSchema());
  });

  it('describes the same settings as the runtime validator', () => {
    const schemas = committed.properties.tiles.items.oneOf;
    expect(schemas).toHaveLength(TILE_TYPES.length);
    TILE_TYPES.forEach((type, index) => {
      const expected = [
        ...COMMON_KEYS,
        ...Object.keys(TILE_ROLES[type]),
        ...(EXTRA_KEYS[type] ?? []),
      ];
      expect(Object.keys(schemas[index]!.properties).sort()).toEqual(
        expected.sort(),
      );
    });
  });

  it('accepts config.example.jsonc', () => {
    expect(validate(example)).toBe(true);
  });

  it('rejects a misspelled setting, an unknown type and a missing column', () => {
    const [, , , , , heating, ac] = example.tiles as Record<string, unknown>[];
    const { quietFan, ...rest } = ac!;
    expect(validate({ tiles: [{ ...rest, quietfan: quietFan }] })).toBe(false);
    expect(validate({ tiles: [{ ...heating, type: 'fridge' }] })).toBe(false);
    expect(validate({ tiles: [{ ...heating, col: undefined }] })).toBe(false);
  });
});
