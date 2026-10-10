/** Resolves `done` after `ms`, or straight away if `cancel()` is called first. */
export const cancellableDelay = (ms: number) => {
  let cancel!: () => void;
  const done = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    cancel = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  return { done, cancel };
};
