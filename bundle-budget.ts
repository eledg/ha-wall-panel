import { gzipSync } from 'node:zlib';

import type { Plugin } from 'vite';

/**
 * Size limits for the build, in bytes. They are the bundle part of the
 * performance budget in docs/performance.md; about 50% above the size when the
 * budget was set, so growth is noticed before the A35 feels it.
 */
export const BUDGET = {
  /** JS as served, which sets the parse and compile time on the display. */
  jsRaw: 150 * 1024,
  jsGzip: 32 * 1024,
  cssGzip: 12 * 1024,
} as const;

export type BundleSizes = { jsRaw: number; jsGzip: number; cssGzip: number };

/** The limits a build breaks, one message each; empty when within budget. */
export const overBudget = (sizes: BundleSizes, budget = BUDGET) =>
  (Object.keys(budget) as (keyof BundleSizes)[])
    .filter((key) => sizes[key] > budget[key])
    .map(
      (key) =>
        `${key} is ${sizes[key]} bytes, over the budget of ${budget[key]}`,
    );

const gzipSize = (content: string | Uint8Array) => gzipSync(content).length;

/** Fails the production build when the JS or CSS grows past `BUDGET`. */
export const bundleBudgetPlugin = (budget = BUDGET): Plugin => ({
  name: 'bundle-budget',
  apply: 'build',
  generateBundle(_, bundle) {
    const sizes: BundleSizes = { jsRaw: 0, jsGzip: 0, cssGzip: 0 };
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') {
        sizes.jsRaw += Buffer.byteLength(file.code);
        sizes.jsGzip += gzipSize(file.code);
      } else if (file.fileName.endsWith('.css')) {
        sizes.cssGzip += gzipSize(file.source);
      }
    }
    const problems = overBudget(sizes, budget);
    if (problems.length > 0) {
      this.error(
        `Bundle over budget (docs/performance.md):\n${problems.join('\n')}`,
      );
    }
  },
});
