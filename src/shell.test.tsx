// @vitest-environment happy-dom
import { render } from 'preact';
import { describe, expect, it } from 'vitest';

import { Shell } from './shell.tsx';

describe('Shell', () => {
  it('renders its tiles inside the padded grid', () => {
    render(
      <Shell>
        <p>tile</p>
      </Shell>,
      document.body,
    );

    const main = document.querySelector('main')!;
    expect(main.className).toContain('p-edge');
    expect(main.querySelector('.dash-grid')).not.toBeNull();
    expect(main.querySelector('.dash-grid p')?.textContent).toBe('tile');
  });
});
