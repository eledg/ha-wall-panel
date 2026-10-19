// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CheckNowResult } from '@/lib/auto-reload.ts';

import { Diagnostics } from './diagnostics.tsx';

// Async so that state set after an awaited promise (the update check) is flushed.
const click = (label: string) =>
  act(async () => {
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
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('opens a modal with build details and children, and closes it', async () => {
    render(
      <Diagnostics>
        <p>debug content</p>
      </Diagnostics>,
      document.body,
    );

    await click('Diagnostics');
    const dialog = document.querySelector('dialog')!;
    expect(dialog.textContent).toContain(__BUILD_INFO__.commit.slice(0, 7));
    expect(dialog.textContent).toContain('Home Assistant');
    expect(dialog.textContent).toContain('debug content');

    await click('Close diagnostics');
    expect(document.querySelector('dialog')).toBeNull();
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
        .querySelector('dialog')!
        .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    await act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(document.querySelector('dialog')).not.toBeNull();

    await act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(document.querySelector('dialog')).toBeNull();
  });

  describe('update buttons', () => {
    const open = async (check: () => Promise<CheckNowResult>) => {
      const update = { checkNow: vi.fn(check) };
      render(<Diagnostics update={update} />, document.body);
      await click('Diagnostics');
      return update;
    };
    const status = () =>
      document.querySelector('[aria-live=polite]')!.textContent;

    it('shows Up to date with the build and time', async () => {
      await open(() =>
        Promise.resolve({
          status: 'current',
          at: Date.UTC(2026, 0, 5, 14, 32),
        }),
      );

      await click('Get latest version');

      expect(status()).toBe(
        `Up to date — ${__BUILD_INFO__.version} (${__BUILD_INFO__.commit.slice(0, 7)}) · checked 14:32`,
      );
    });

    it("shows Couldn't check when the check fails", async () => {
      await open(() => Promise.resolve({ status: 'failed' }));

      await click('Get latest version');

      expect(status()).toBe("Couldn't check");
    });

    it('shows Checking and disables the button while the fetch runs', async () => {
      let finish!: (r: CheckNowResult) => void;
      await open(() => new Promise((resolve) => (finish = resolve)));
      const button = () =>
        [...document.querySelectorAll('button')].find(
          (b) => b.textContent === 'Get latest version',
        )!;

      await click('Get latest version');
      expect(status()).toBe('Checking for updates…');
      expect(button().disabled).toBe(true);

      await act(async () => finish({ status: 'failed' }));
      expect(button().disabled).toBe(false);
    });

    it('says Reloading when a newer build is found', async () => {
      await open(() => Promise.resolve({ status: 'reloading' }));

      await click('Get latest version');

      expect(status()).toBe('Update found. Reloading…');
    });

    it('keeps the idle timer running, restarted by taps on the buttons', async () => {
      vi.useFakeTimers();
      const update = { checkNow: vi.fn() };
      render(<Diagnostics idleMs={1000} update={update} />, document.body);
      await click('Diagnostics');

      await act(() => {
        vi.advanceTimersByTime(800);
      });
      await act(() => {
        [...document.querySelectorAll('button')]
          .find((b) => b.textContent === 'Get latest version')!
          .dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      await act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(document.querySelector('dialog')).not.toBeNull();

      await act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(document.querySelector('dialog')).toBeNull();
    });
  });
});
