import { ConfigWarning } from './config-warning.tsx';
import { Diagnostics } from './diagnostics.tsx';
import { HaDebug } from './ha/debug.tsx';

export const App = () => (
  <>
    <h1>Hello world</h1>
    <ConfigWarning />
    <HaDebug />
    <Diagnostics />
  </>
);
