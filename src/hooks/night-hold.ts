import { createContext } from 'preact';
import { useContext, useEffect } from 'preact/hooks';

/** Keeps the display undimmed until the returned function is called. */
export type NightHold = () => () => void;

/** Outside the shell nothing dims, so there is nothing to hold. */
export const NightHoldContext = createContext<NightHold>(() => () => {});

/** Holds the display undimmed while `active`, and lets it dim again after. */
export const useNightHold = (active: boolean) => {
  const hold = useContext(NightHoldContext);
  useEffect(() => (active ? hold() : undefined), [active, hold]);
};
