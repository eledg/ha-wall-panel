import { firstTile } from '@/config/config.ts';
import type { TileEntities, TileType } from '@/config/config.ts';

/**
 * The entities of the first tile of `type`, which the mock's panels act on.
 * The mock cannot run without the tile, so its absence is an error.
 */
export const entitiesOf = <T extends TileType>(type: T): TileEntities<T> => {
  const tile = firstTile(type);
  if (!tile) throw new Error(`The mock needs a ${type} tile in its config`);
  return tile.entities as TileEntities<T>;
};
