import { Diagnostics } from '@/components/diagnostics/diagnostics.tsx';
import { HaDebug } from '@/components/diagnostics/ha-debug.tsx';
import { PerfProbe } from '@/components/diagnostics/perf-probe.tsx';
import { ConfigWarning } from '@/components/layout/config-warning.tsx';
import { DisconnectedBanner } from '@/components/layout/disconnected-banner.tsx';
import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { Shell } from '@/components/layout/shell.tsx';
import { AcTile } from '@/components/tiles/ac-tile.tsx';
import { CalendarTile } from '@/components/tiles/calendar-tile.tsx';
import { ClockTile } from '@/components/tiles/clock-tile.tsx';
import { HeatingTile } from '@/components/tiles/heating-tile.tsx';
import { TemperatureTile } from '@/components/tiles/temperature-tile.tsx';
import { ToggleTile } from '@/components/tiles/toggle-tile.tsx';
import { WeatherTile } from '@/components/tiles/weather-tile.tsx';

export const App = () => (
  <>
    <Shell>
      <HaConnection>
        <ClockTile area="clock" />
        <WeatherTile area="weather" />
        <CalendarTile area="cal" />
        <ToggleTile entity="officeLight" label="Office light" area="light" />
        <TemperatureTile area="temp" />
        <HeatingTile area="heat" />
        <AcTile area="ac" />
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
