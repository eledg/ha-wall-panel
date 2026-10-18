// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';

import { Tile } from './tile.tsx';

const mount = (ui: preact.ComponentChildren) => render(ui, document.body);

describe('Tile', () => {
  it('places itself in its grid area', () => {
    mount(<Tile area="clock">content</Tile>);
    const el = document.body.firstElementChild as HTMLElement;
    expect(el.style.gridArea).toBe('clock');
    expect(el.tagName).toBe('DIV');
  });

  it('renders a button that taps when given a handler', () => {
    const onTap = vi.fn();
    mount(
      <Tile area="light" onTap={onTap} pressed>
        x
      </Tile>,
    );
    const button = document.querySelector('button')!;
    button.click();
    expect(onTap).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a skeleton instead of content while loading', () => {
    mount(
      <Tile area="light" state="loading">
        secret
      </Tile>,
    );
    expect(document.body.textContent).not.toContain('secret');
  });

  it('badges stale content and warnings', () => {
    mount(
      <Tile area="light" state="stale" warn="entity missing">
        body
      </Tile>,
    );
    expect(document.body.textContent).toContain('stale');
    expect(document.body.textContent).toContain('entity missing');
    expect(document.body.textContent).toContain('body');
  });

  it('goes stale and ignores taps while HA is disconnected', async () => {
    const mock = createMockHa();
    const store = createHaStore(mock.deps);
    const onTap = vi.fn();
    await act(async () => {
      await store.start(mock.getAuth);
      mount(
        <HaConnection store={store}>
          <Tile area="light" onTap={onTap}>
            x
          </Tile>
        </HaConnection>,
      );
    });
    const button = () => document.querySelector('button')!;
    expect(button().disabled).toBe(false);

    await act(() => mock.controls.setConnected(false));
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('stale');
  });
});
