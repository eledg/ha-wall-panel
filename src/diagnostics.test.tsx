// @vitest-environment happy-dom
import { render } from 'preact';
import { describe, expect, it } from 'vitest';

import { buildId, Diagnostics } from './diagnostics.tsx';

describe('Diagnostics', () => {
  it('shows the embedded build id', () => {
    render(<Diagnostics />, document.body);

    expect(document.querySelector('footer')?.textContent).toBe(buildId());
  });
});
