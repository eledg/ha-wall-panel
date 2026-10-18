import type { Auth } from 'home-assistant-js-websocket';

import {
  dropTokens,
  hasCallbackParams,
  resolveAuth,
  usesDevAuth,
} from './auth.ts';
import type { HaStore } from './store.ts';

/**
 * Connects the store. If HA rejects credentials saved from an earlier visit
 * (revoked, or the user was removed), at start or on a later reconnect, drops
 * them and reloads once to sign in again. Credentials just issued by this
 * load's sign-in redirect are never dropped, so a persistent refusal can't loop.
 */
export const connectHa = async (
  store: HaStore,
  getAuth: () => Promise<Auth> = () => resolveAuth(),
  reload = () => location.replace(location.pathname),
) => {
  const signedInNow = hasCallbackParams();
  let handled = false;
  const reauthIfRejected = () => {
    if (handled || !store.getSnapshot().rejected) return;
    handled = true;
    unsubscribe();
    if (!signedInNow && !usesDevAuth()) {
      dropTokens();
      reload();
    }
  };
  const unsubscribe = store.subscribe(reauthIfRejected);
  await store.start(getAuth);
  reauthIfRejected();
};
