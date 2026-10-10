import { ConfigWarning } from './config-warning.tsx';
import { Diagnostics } from './diagnostics.tsx';
import { HaDebug } from './ha/debug.tsx';
import { Shell } from './shell.tsx';
import { ClockTile } from './tiles/clock-tile.tsx';
import { ToggleTile } from './tiles/toggle-tile.tsx';
import { WeatherTile } from './tiles/weather-tile.tsx';

export const App = () => (
  <>
    <Shell>
      <ClockTile area="clock" />
      <WeatherTile area="weather" />
      <ToggleTile entity="officeLight" label="Office light" area="light" />
    </Shell>
    <ConfigWarning />
    <Diagnostics>
      <HaDebug />
    </Diagnostics>
  </>
);
