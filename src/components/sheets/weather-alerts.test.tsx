// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WeatherAlert } from '@/lib/weather-alerts.ts';
import { alertFixture } from '@/tests/weather-alerts.ts';

import { WeatherAlertControl, WeatherAlertDetails } from './weather-alerts.tsx';

const now = new Date('2026-03-14T09:41:00Z');
const { iso, alert } = alertFixture(now);

const text = () => document.body.textContent;
const close = () =>
  document.body.querySelector<HTMLButtonElement>(
    '[aria-label="Close warning details"]',
  )!;
const backdrop = () =>
  document.body.querySelector<HTMLButtonElement>('button[aria-hidden="true"]')!;

// A fresh root for every test: rendering straight into the body leaves state
// behind that breaks the focus assertions of later tests.
let root: HTMLDivElement;
beforeEach(() => {
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  render(null, root);
  root.remove();
});

describe('WeatherAlertControl', () => {
  const show = (alerts: WeatherAlert[], onOpen = vi.fn()) => {
    act(() => {
      render(<WeatherAlertControl alerts={alerts} onOpen={onOpen} />, root);
    });
    return onOpen;
  };

  it('renders nothing without warnings', () => {
    show([]);

    expect(document.body.querySelector('button')).toBeNull();
  });

  it('names the top warning and when it ends', () => {
    show([alert({ severity: 'amber', event: 'Rain', ends: iso(5) })]);

    const button = document.body.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('View amber warning: Rain');
    expect(text()).toContain('Amber warning: Rain');
    expect(text()).toMatch(/Until \w{3} \d{2}:\d{2}/);
    expect(text()).not.toContain('+');
  });

  it('counts the other warnings', () => {
    show([alert(), alert({ id: 'b' }), alert({ id: 'c' })]);

    expect(text()).toContain('Yellow warning: Wind +2');
  });

  it('opens on tap', () => {
    const onOpen = show([alert()]);

    act(() => document.body.querySelector('button')!.click());

    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe('WeatherAlertDetails', () => {
  const show = (alerts: WeatherAlert[], onClose = vi.fn()) => {
    act(() => {
      render(
        <WeatherAlertDetails alerts={alerts} now={now} onClose={onClose} />,
        root,
      );
    });
    return onClose;
  };
  const press = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    act(() => {
      document.activeElement?.dispatchEvent(event);
    });
    return event;
  };

  it('shows every warning in full', () => {
    show([
      alert(),
      alert({
        id: 'rain',
        severity: 'red',
        event: 'Rain',
        title: 'Heavy rain',
      }),
    ]);

    expect(text()).toContain('Weather warnings');
    expect(text()).toContain('Yellow warning: Strong winds');
    expect(text()).toContain('Red warning: Heavy rain');
    expect(text()).toContain('Berkhamsted');
    expect(text()).toContain('Gusts may cause disruption.');
    expect(text()).toContain('Secure loose items.');
    expect(text()).toContain('Sample warning');
  });

  it('says Active once a warning has started and Upcoming before', () => {
    show([
      alert({ id: 'now' }),
      alert({ id: 'later', starts: iso(2), ends: iso(6) }),
    ]);

    const sections = [...document.body.querySelectorAll('section')];
    expect(sections[0]?.textContent).toContain('Active');
    expect(sections[1]?.textContent).toContain('Upcoming');
  });

  it('leaves out the text a warning does not have', () => {
    show([alert({ area: '', description: '', guidance: '', source: '' })]);

    expect(document.body.querySelectorAll('section p')).toHaveLength(1);
  });

  it('is a labelled dialog that holds back reloads', () => {
    show([alert()]);

    const dialog = document.body.querySelector('dialog')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe('weather-alert-title');
    expect(document.getElementById('weather-alert-title')?.textContent).toBe(
      'Weather warnings',
    );
    expect(document.body.querySelector('[data-blocks-reload]')).not.toBeNull();
  });

  // Returning focus to the opener is covered in weather-sheet.test.tsx, where
  // the real header control is the opener.
  it('moves focus to Close when it opens', () => {
    show([alert()]);

    expect(document.activeElement).toBe(close());
  });

  it('closes on the Close button and on a tap outside, not inside', () => {
    const onClose = show([alert()]);

    act(() => document.body.querySelector('section')!.click());
    expect(onClose).not.toHaveBeenCalled();

    act(() => close().click());
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => backdrop().click());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape without letting the sheet behind it see the key', () => {
    const onClose = show([alert()]);
    const reachedWindow = vi.fn();
    window.addEventListener('keydown', reachedWindow);

    press('Escape');

    expect(onClose).toHaveBeenCalledOnce();
    expect(reachedWindow).not.toHaveBeenCalled();
    window.removeEventListener('keydown', reachedWindow);
  });

  it('keeps Tab and Shift+Tab inside the dialog', () => {
    show([alert()]);
    expect(document.activeElement).toBe(close());

    // Close is both the first and last control, so either direction wraps to it.
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(press('Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close());
  });

  it('ignores other keys', () => {
    const onClose = show([alert()]);

    const event = press('a');

    expect(onClose).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
