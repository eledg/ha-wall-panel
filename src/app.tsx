import { ConfigWarning } from './config-warning.tsx';
import { Diagnostics } from './diagnostics.tsx';
import { HaDebug } from './ha/debug.tsx';
import { mockHa } from './ha/instance.ts';

export const App = () => (
  <>
    <h1>Hello world</h1>
    <ConfigWarning />
    <HaDebug mock={mockHa?.controls} />
    <Diagnostics />
  </>
);
