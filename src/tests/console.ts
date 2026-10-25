type Method = 'error' | 'warn';

const methods: Method[] = ['error', 'warn'];
const original = { error: console.error, warn: console.warn };
let calls: Record<Method, unknown[][]> = { error: [], warn: [] };
let expected = new Set<Method>();

/** Starts recording `console.error` and `console.warn` instead of printing them. */
export const captureConsole = () => {
  calls = { error: [], warn: [] };
  expected = new Set();
  for (const method of methods) {
    console[method] = (...args: unknown[]) => void calls[method].push(args);
  }
};

/** Restores the console and throws if a test logged something it did not expect. */
export const releaseConsole = () => {
  Object.assign(console, original);
  const unexpected = methods.flatMap((method) =>
    expected.has(method)
      ? []
      : calls[method].map(
          (args) => `console.${method}: ${args.map(String).join(' ')}`,
        ),
  );
  if (unexpected.length > 0) {
    throw new Error(`Unexpected console output:\n${unexpected.join('\n')}`);
  }
};

/**
 * Declares that this test expects the app to log with `console[method]`, and
 * returns the calls so far (live) for asserting on. Anything else logged still
 * fails the test.
 */
export const expectConsole = (method: Method = 'error') => {
  expected.add(method);
  return calls[method];
};
