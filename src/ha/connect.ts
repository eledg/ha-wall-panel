import {
  devToken,
  dropTokens,
  hasCallbackParams,
  resolveAuth,
} from './auth.ts';
import type { HaStore } from './store.ts';

/**
 * Connects the store. If HA rejects credentials saved from an earlier visit
 * (revoked, or the user was removed), drops them and reloads once to sign in
 * again. Credentials just issued by this load's sign-in redirect are never
 * dropped, so a persistent refusal can't loop.
 */
export const connectHa = async (
  store: HaStore,
  reload = () => location.replace(location.pathname),
) => {
  const signedInNow = hasCallbackParams();
  await store.start(() => resolveAuth());
  if (store.getSnapshot().rejected && !signedInNow && !devToken()) {
    dropTokens();
    reload();
  }
};
