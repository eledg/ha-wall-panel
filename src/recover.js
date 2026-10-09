/* global __BUILD_INFO__ */
// Recovery copy of the check in auto-reload.ts. The build inlines this file
// into index.html (see build-info.ts), outside the bundle, so a broken bundle
// can still pick up a fix. It is a plain script, not a module, and cannot
// import anything. Keep the two in step.
(() => {
  const POLL_MS = 300000;
  const RETRY_MS = 30000;
  const IDLE_MS = 30000;
  const MIN_GAP_MS = 120000;
  const SAME_TARGET_GAP_MS = 1800000;
  const STORAGE_KEY = 'wall.reload';
  const BLOCKS = '[data-blocks-reload]';

  const keyOf = (build) => `${build.version}@${build.commit}`;
  const running = keyOf(__BUILD_INFO__);
  let lastActivity = Date.now();
  let checking = false;

  for (const name of ['pointerdown', 'touchstart', 'keydown']) {
    window.addEventListener(
      name,
      () => {
        lastActivity = Date.now();
      },
      { capture: true, passive: true },
    );
  }

  const claim = (target) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const last = raw ? JSON.parse(raw) : null;
      if (last) {
        const age = Date.now() - last.at;
        if (age < MIN_GAP_MS) return false;
        if (last.to === target && age < SAME_TARGET_GAP_MS) return false;
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ at: Date.now(), to: target }),
      );
      return true;
    } catch {
      return false;
    }
  };

  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const url = new URL('version.json', window.location.href);
      url.searchParams.set('t', Date.now());
      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) return;
      const remote = await response.json();
      if (!remote || typeof remote.version !== 'string') return;
      if (typeof remote.commit !== 'string') return;
      const target = keyOf(remote);
      if (target === running) return;
      if (
        document.querySelector(BLOCKS) ||
        Date.now() - lastActivity < IDLE_MS
      ) {
        setTimeout(check, RETRY_MS);
        return;
      }
      if (!claim(target)) return;
      const next = new URL('index.html', window.location.href);
      next.searchParams.set('v', target);
      window.location.replace(next.toString());
    } catch {
      // Unreachable or malformed version.json: carry on quietly.
    } finally {
      checking = false;
    }
  };

  setInterval(check, POLL_MS);
  window.addEventListener('focus', check);
  check();
})();
