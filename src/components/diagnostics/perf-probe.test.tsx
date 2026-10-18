// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PerfProbe } from './perf-probe.tsx';

describe('PerfProbe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    render(null, document.body);
  });

  it('runs the frame loop only while mounted', async () => {
    const request = vi.fn(() => 7);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);

    await act(() => render(<PerfProbe />, document.body));
    expect(request).toHaveBeenCalled();
    expect(document.body.textContent).toContain('Performance');
    expect(document.body.textContent).toContain('sampling');

    await act(() => render(null, document.body));
    expect(cancel).toHaveBeenCalledWith(7);
  });
});
