import { createLongLivedTokenAuth, getAuth } from 'home-assistant-js-websocket';
import type { Auth, AuthData } from 'home-assistant-js-websocket';

export const TOKENS_KEY = 'ha-wall-dashboard:auth';

/** Query parameters HA's sign-in redirect leaves on the URL. */
const CALLBACK_PARAMS = ['auth_callback', 'code', 'state', 'storeToken'];

type Env = { DEV: boolean; VITE_HA_URL?: string; VITE_HA_TOKEN?: string };

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

/** Dev only: a long-lived token from `.env.local`; never read in a release. */
export const devToken = (env: Env = import.meta.env) =>
  (env.DEV && env.VITE_HA_TOKEN) || undefined;

/**
 * Credentials for the HA websocket.
 *
 * Deployed, the display is on a `trusted_networks` address (see
 * `docs/deploy.md`), so HA signs it in with no input and the library returns
 * an access token plus a refresh token kept in `localStorage`. The page is
 * served by HA, so HA's own origin is the host. If the display has no tokens
 * this navigates to HA and back, and never settles.
 *
 * Dev uses a long-lived token instead, since a laptop isn't a trusted network.
 */
export const resolveAuth = async (
  env: Env = import.meta.env,
): Promise<Auth> => {
  const token = devToken(env);
  if (token) {
    return createLongLivedTokenAuth(env.VITE_HA_URL || location.origin, token);
  }
  if (env.DEV) {
    throw new Error('Set VITE_HA_URL and VITE_HA_TOKEN in .env.local');
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
