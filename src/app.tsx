import { ConfigWarning } from './config-warning.tsx';
import { Diagnostics } from './diagnostics.tsx';
import { HaConnection } from './ha/connection.tsx';
import { HaDebug } from './ha/debug.tsx';
import { DisconnectedBanner } from './ha/disconnected-banner.tsx';
import { PerfProbe } from './perf/probe.tsx';
import { Shell } from './shell.tsx';
import { CalendarTile } from './tiles/calendar-tile.tsx';
import { ClockTile } from './tiles/clock-tile.tsx';
import { ToggleTile } from './tiles/toggle-tile.tsx';
import { WeatherTile } from './tiles/weather-tile.tsx';

export const App = () => (
  <>
    <Shell>
      <HaConnection>
        <ClockTile area="clock" />
        <WeatherTile area="weather" />
        <CalendarTile area="cal" />
        <ToggleTile entity="officeLight" label="Office light" area="light" />
      </HaConnection>
    </Shell>
    <ConfigWarning />
    <DisconnectedBanner />
    <Diagnostics>
      <PerfProbe />
      <HaDebug />
    </Diagnostics>
  </>
);
