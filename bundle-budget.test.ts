import { describe, expect, it } from 'vitest';

import { BUDGET, overBudget } from './bundle-budget.ts';

describe('overBudget', () => {
  it('passes sizes at or under every limit', () => {
    expect(overBudget({ ...BUDGET })).toEqual([]);
  });

  it('names each limit that is broken', () => {
    const problems = overBudget({
      jsRaw: BUDGET.jsRaw + 1,
      jsGzip: 1,
      cssGzip: BUDGET.cssGzip + 1,
    });

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('jsRaw');
    expect(problems[1]).toContain('cssGzip');
  });
});
