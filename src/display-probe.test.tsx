// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { DisplayProbe } from './display-probe.tsx';

describe('DisplayProbe', () => {
  afterEach(() => render(null, document.body));

  it('reports computed styles and handles missing elements', async () => {
    await act(() => render(<DisplayProbe />, document.body));

    expect(document.body.textContent).toContain('Viewport:');
    expect(document.body.textContent).toContain('version button: not found');
  });
});
