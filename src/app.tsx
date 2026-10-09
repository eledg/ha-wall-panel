import { ConfigWarning } from './config-warning.tsx';
import { Diagnostics } from './diagnostics.tsx';
import { DisplayProbe } from './display-probe.tsx';
import { HaDebug } from './ha/debug.tsx';
import { mockHa } from './ha/instance.ts';
import { Shell } from './shell.tsx';
import { ToggleTile } from './tiles/toggle-tile.tsx';

export const App = () => (
  <>
    <Shell>
      <ToggleTile entity="officeLight" label="Office" />
    </Shell>
    <ConfigWarning />
    <Diagnostics>
      <HaDebug mock={mockHa?.controls} />
      <DisplayProbe />
    </Diagnostics>
  </>
);
