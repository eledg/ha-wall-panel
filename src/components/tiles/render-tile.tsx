import type { TileConfig } from '@/config/config.ts';

import { AcTile } from './ac-tile.tsx';
import { CalendarTile } from './calendar-tile.tsx';
import { ClockTile } from './clock-tile.tsx';
import { HeatingTile } from './heating-tile.tsx';
import { TemperatureTile } from './temperature-tile.tsx';
import { ToggleTile } from './toggle-tile.tsx';
import { WeatherTile } from './weather-tile.tsx';

/**
 * The component for one configured tile. Every tile type in `TILE_ROLES` needs
 * a case here; the compiler checks that none is missed.
 */
export const renderTile = (tile: TileConfig) => {
  switch (tile.type) {
    case 'clock':
      return <ClockTile key={tile.id} place={tile} />;
    case 'weather':
      return <WeatherTile key={tile.id} tile={tile} />;
    case 'calendar':
      return <CalendarTile key={tile.id} tile={tile} />;
    case 'toggle':
      return <ToggleTile key={tile.id} tile={tile} />;
    case 'temperature':
      return <TemperatureTile key={tile.id} tile={tile} />;
    case 'heating':
      return <HeatingTile key={tile.id} tile={tile} />;
    case 'ac':
      return <AcTile key={tile.id} tile={tile} />;
  }
};
