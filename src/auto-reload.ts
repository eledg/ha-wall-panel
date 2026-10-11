// Polls version.json and reloads the page when the published build differs
// from the running one. index.html carries a small copy of this check that
// runs outside the bundle (see index.html); keep the two in step.

export const POLL_MS = 5 * 60_000;
// When a new build is waiting for the page to go idle, look again this soon.
export const RETRY_MS = 30_000;
export const IDLE_MS = 30_000;
// Reloads closer together than this are refused, whatever the cause.
export const MIN_RELOAD_GAP_MS = 2 * 60_000;
// After reloading to a build that still differs (e.g. a stale cache), wait
// this long before trying that same build again.
export const SAME_TARGET_GAP_MS = 30 * 60_000;
export const STORAGE_KEY = 'wall.reload';
// Overlays (such as the doorbell) set this attribute while open so the
// page is not reloaded underneath them.
export const BLOCKS_RELOAD_ATTR = 'data-blocks-reload';

type BuildFields = { version: string; commit: string };

export const buildKey = ({ version, commit }: BuildFields) =>
  `${version}@${commit}`;

const parseBuild = (value: unknown): BuildFields | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const { version, commit } = value as Partial<BuildFields>;
  return typeof version === 'string' && typeof commit === 'string'
    ? { version, commit }
    : undefined;
};

export type CheckNowResult =
  | { status: 'reloading' }
  | { status: 'current'; at: number }
  | { status: 'failed' };

export type AutoReloadDeps = {
  runningKey: string;
  versionUrl: string;
  indexUrl: string;
  fetchImpl: typeof fetch;
  now: () => number;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  isBlocked: () => boolean;
  reload: (url: string) => void;
  idleMs?: number;
};

export const createAutoReload = (deps: AutoReloadDeps) => {
  const idleMs = deps.idleMs ?? IDLE_MS;
  let lastActivity = deps.now();
  let checking = false;

  const touch = () => {
    lastActivity = deps.now();
  };

  // Records the attempt before reloading. If storage is unavailable the
  // rate limit can't be kept, so the reload is refused.
  const claimReload = (key: string) => {
    try {
      const raw = deps.storage.getItem(STORAGE_KEY);
      const last = raw ? (JSON.parse(raw) as { at: number; to: string }) : null;
      if (last) {
        const age = deps.now() - last.at;
        if (age < MIN_RELOAD_GAP_MS) return false;
        if (last.to === key && age < SAME_TARGET_GAP_MS) return false;
      }
      deps.storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ at: deps.now(), to: key }),
      );
      return true;
    } catch {
      return false;
    }
  };

  // Fetches version.json and returns the published build's key. Throws if
  // it is unreachable or malformed.
  const fetchPublishedKey = async () => {
    const response = await deps.fetchImpl(
      `${deps.versionUrl}?t=${deps.now()}`,
      {
        cache: 'no-store',
      },
    );
    if (!response.ok) throw new Error(`version.json: ${response.status}`);
    const remote = parseBuild(await response.json());
    if (!remote) throw new Error('version.json: malformed');
    return buildKey(remote);
  };

  const reloadTo = (v: string) => {
    const target = new URL(deps.indexUrl);
    target.searchParams.set('v', v);
    deps.reload(target.toString());
  };

  // Resolves to 'waiting' when a different build is published but the page
  // is not idle yet.
  const run = async (): Promise<'waiting' | undefined> => {
    try {
      const key = await fetchPublishedKey();
      if (key === deps.runningKey) return;
      if (deps.isBlocked() || deps.now() - lastActivity < idleMs) {
        return 'waiting';
      }
      if (!claimReload(key)) return;
      reloadTo(key);
    } catch {
      // Unreachable or malformed version.json: carry on quietly.
    }
  };

  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      return await run();
    } finally {
      checking = false;
    }
  };

  // The user asked, so there is no idle wait and no rate limit: reload as
  // soon as the published build differs from the running one.
  const checkNow = async (): Promise<CheckNowResult> => {
    try {
      const key = await fetchPublishedKey();
      if (key === deps.runningKey) return { status: 'current', at: deps.now() };
      reloadTo(key);
      return { status: 'reloading' };
    } catch {
      return { status: 'failed' };
    }
  };

  return { check, checkNow, touch };
};

const browserDeps = (info: BuildFields): AutoReloadDeps => ({
  runningKey: buildKey(info),
  versionUrl: new URL('version.json', location.href).toString(),
  indexUrl: new URL('index.html', location.href).toString(),
  fetchImpl: fetch.bind(globalThis),
  now: Date.now,
  storage: localStorage,
  isBlocked: () => document.querySelector(`[${BLOCKS_RELOAD_ATTR}]`) !== null,
  reload: (url) => location.replace(url),
});

/** Manual check for the diagnostics modal; works in dev and mock too. */
export const createManualUpdate = (info: BuildFields) => {
  const { checkNow } = createAutoReload(browserDeps(info));
  return { checkNow };
};

export const startAutoReload = (info: BuildFields) => {
  const { check, touch } = createAutoReload(browserDeps(info));

  for (const name of ['pointerdown', 'touchstart', 'keydown']) {
    window.addEventListener(name, touch, { capture: true, passive: true });
  }
  // The display only fires blur and focus on wake (see docs/display.md), but
  // visibilitychange costs nothing and covers other browsers.
  const poll = async () => {
    if ((await check()) === 'waiting') setTimeout(() => void poll(), RETRY_MS);
  };
  window.addEventListener('focus', () => void poll());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void poll();
  });
  const timer = setInterval(() => void poll(), POLL_MS);
  void poll();

  return () => clearInterval(timer);
};
