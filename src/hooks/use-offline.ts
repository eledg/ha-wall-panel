import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

export const OfflineContext = createContext(false);

/** True while HA is not connected. False outside an `HaConnection`. */
export const useOffline = () => useContext(OfflineContext);
