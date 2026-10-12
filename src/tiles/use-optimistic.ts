import { useEffect, useState } from 'preact/hooks';

/** Safety net: drop the guess if HA never reports the change. */
export const SETTLE_MS = 5000;

/**
 * HA's value, except for a guess made at a tap. The guess lasts until HA
 * reports a change, `clear` is called (a failed call), or `SETTLE_MS` passes.
 */
export const useOptimistic = <T>(actual: T) => {
  const [guess, setGuess] = useState<{ value: T }>();

  useEffect(() => setGuess(undefined), [actual]);
  useEffect(() => {
    if (!guess) return;
    const timer = setTimeout(() => setGuess(undefined), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [guess]);

  return {
    value: guess ? guess.value : actual,
    guess: (value: T) => setGuess({ value }),
    clear: () => setGuess(undefined),
  };
};
