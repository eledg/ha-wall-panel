// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Diagnostics } from './diagnostics.tsx';

const click = (label: string) =>
  act(() => {
    [...document.querySelectorAll('button')]
      .find((b) => (b.getAttribute('aria-label') ?? b.textContent) === label)!
      .click();
  });

describe('Diagnostics', () => {
  afterEach(() => {
    vi.useRealTimers();
    render(null, document.body);
  });

  it('shows only the version until tapped', () => {
    render(<Diagnostics />, document.body);

    expect(document.body.textContent).toBe(__BUILD_INFO__.version);
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });

  it('opens a modal with build details and children, and closes it', async () => {
    render(
      <Diagnostics>
        <p>debug content</p>
      </Diagnostics>,
      document.body,
    );

    await click('Diagnostics');
    const dialog = document.querySelector('[role=dialog]')!;
    expect(dialog.textContent).toContain(__BUILD_INFO__.commit.slice(0, 7));
    expect(dialog.textContent).toContain('Home Assistant');
    expect(dialog.textContent).toContain('debug content');

    await click('Close diagnostics');
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });

  it('closes itself after the idle time, restarted by touches', async () => {
    vi.useFakeTimers();
    render(<Diagnostics idleMs={1000} />, document.body);
    await click('Diagnostics');

    await act(() => {
      vi.advanceTimersByTime(800);
    });
    await act(() => {
      document
        .querySelector('[role=dialog]')!
        .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    await act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(document.querySelector('[role=dialog]')).not.toBeNull();

    await act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
