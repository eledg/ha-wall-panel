// @vitest-environment happy-dom
import { render } from 'preact';
import { describe, expect, it, vi } from 'vitest';

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
});
