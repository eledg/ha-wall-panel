// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClimateButton, ClimateSheet } from './climate-controls.tsx';

afterEach(() => render(null, document.body));

describe('ClimateSheet', () => {
  const setup = (onClose = vi.fn(), onActivity = vi.fn()) => {
    render(
      <ClimateSheet
        title="Office AC"
        titleId="t"
        status="Cooling"
        onClose={onClose}
        onActivity={onActivity}
      >
        <ClimateButton>Inside</ClimateButton>
      </ClimateSheet>,
      document.body,
    );
    return { onClose, onActivity };
  };

  it('is a labelled dialog with a live status that holds back reload', () => {
    setup();
    const dialog = document.querySelector('[role="dialog"]')!;

    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
    expect(dialog.hasAttribute('data-blocks-reload')).toBe(true);
    expect(document.querySelector('h2')?.textContent).toBe('Office AC');
    expect(document.querySelector('[aria-live]')?.textContent).toBe('Cooling');
  });

  it('closes with the button and reports touches', async () => {
    const { onClose, onActivity } = setup();

    await act(() => {
      document
        .querySelector('[role="dialog"]')!
        .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    await act(() =>
      (document.querySelector('[aria-label="Close"]') as HTMLElement).click(),
    );

    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives buttons an opaque background', () => {
    setup();

    expect(document.querySelector('button')?.className).toContain(
      'bg-surface-2',
    );
  });
});
