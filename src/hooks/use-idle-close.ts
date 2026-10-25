import { useEffect, useState } from 'preact/hooks';

/**
 * Closes a sheet on Escape or after `idleMs` without a touch. Returns the
 * callback to run on every touch inside the sheet, which restarts the timer.
 */
export const useIdleClose = (onClose: () => void, idleMs: number) => {
  // Bumped by every touch inside the sheet to restart the idle timer.
  const [activity, setActivity] = useState(0);
  useEffect(() => {
    const timer = setTimeout(onClose, idleMs);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, activity, idleMs]);
  return () => setActivity((n) => n + 1);
};
