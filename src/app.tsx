import { ConfigWarning } from './config-warning.tsx';
import { Diagnostics } from './diagnostics.tsx';
import { HaDebug } from './ha/debug.tsx';
import { mockHa } from './ha/instance.ts';
import { Shell } from './shell.tsx';

export const App = () => (
  <>
    <Shell />
    <ConfigWarning />
    <Diagnostics>
      <HaDebug mock={mockHa?.controls} />
    </Diagnostics>
  </>
);
