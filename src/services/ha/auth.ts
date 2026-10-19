import { createLongLivedTokenAuth, getAuth } from 'home-assistant-js-websocket';
import type { Auth, AuthData } from 'home-assistant-js-websocket';

export const TOKENS_KEY = 'ha-wall-panel:auth';

/** Query parameters HA's sign-in redirect leaves on the URL. */
const CALLBACK_PARAMS = ['auth_callback', 'code', 'state', 'storeToken'];

type DevSettings = { url?: string; token?: string };

const storage = () => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

const saveTokens = (data: AuthData | null) => {
  try {
    if (data) storage()?.setItem(TOKENS_KEY, JSON.stringify(data));
    else storage()?.removeItem(TOKENS_KEY);
  } catch {
    // Storage unavailable: the display signs in again on the next load.
  }
};

const loadTokens = async (): Promise<AuthData | null> => {
  try {
    return JSON.parse(storage()?.getItem(TOKENS_KEY) ?? 'null') as AuthData;
  } catch {
    return null;
  }
};

export const dropTokens = () => saveTokens(null);

export const hasCallbackParams = (search = location.search) =>
  CALLBACK_PARAMS.some((name) => new URLSearchParams(search).has(name));

/** Removes the sign-in redirect's parameters so a reload doesn't replay them. */
const cleanUrl = () => {
  const url = new URL(location.href);
  CALLBACK_PARAMS.forEach((name) => url.searchParams.delete(name));
  history.replaceState(history.state, '', url);
};

/** True under the dev server, where a long-lived token replaces sign-in. */
export const usesDevAuth = (dev: DevSettings | undefined = __HA_DEV__) =>
  dev !== undefined;

/**
 * Credentials for the HA websocket.
 *
 * Deployed, the display is on a `trusted_networks` address (see
 * `docs/deploy.md`), so HA signs it in with no input and the library returns
 * an access token plus a refresh token kept in `localStorage`. The page is
 * served by HA, so HA's own origin is the host. If the display has no tokens
 * this navigates to HA and back, and never settles.
 *
 * The dev server uses a long-lived token from `.env.local` instead, since a
 * laptop isn't a trusted network. `__HA_DEV__` is undefined in builds, so the
 * token can't reach a release (see `dev-ha.ts`).
 */
export const resolveAuth = async (
  dev: DevSettings | undefined = __HA_DEV__,
): Promise<Auth> => {
  if (dev) {
    if (!dev.token) {
      throw new Error('Set HA_DEV_URL and HA_DEV_TOKEN in .env.local');
    }
    return createLongLivedTokenAuth(dev.url || location.origin, dev.token);
  }

  const options = { hassUrl: location.origin, saveTokens, loadTokens };
  let auth: Auth;
  try {
    auth = await getAuth(options);
  } catch (err) {
    // A reloaded or replayed callback URL carries a spent code. Drop it and
    // sign in afresh.
    if (!hasCallbackParams()) throw err;
    cleanUrl();
    auth = await getAuth(options);
  }
  cleanUrl();
  return auth;
};
