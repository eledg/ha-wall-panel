import { Diagnostics } from '@/components/diagnostics/diagnostics.tsx';
import { HaDebug } from '@/components/diagnostics/ha-debug.tsx';
import { PerfProbe } from '@/components/diagnostics/perf-probe.tsx';
import { DoorbellOverlay } from '@/components/doorbell/doorbell-overlay.tsx';
import { ConfigWarning } from '@/components/layout/config-warning.tsx';
import { DisconnectedBanner } from '@/components/layout/disconnected-banner.tsx';
import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { Shell } from '@/components/layout/shell.tsx';
import { renderTile } from '@/components/tiles/render-tile.tsx';
import { getConfig } from '@/config/config.ts';

export const App = () => (
  <>
    <Shell overlay={<DoorbellOverlay />}>
      <HaConnection>{getConfig().tiles.map(renderTile)}</HaConnection>
    </Shell>
    <ConfigWarning />
    <DisconnectedBanner />
    <Diagnostics>
      <PerfProbe />
      <HaDebug />
    </Diagnostics>
  </>
);
