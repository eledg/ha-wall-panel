// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';

import { HaConnection } from '@/components/layout/ha-connection.tsx';
import type { RuntimeConfig } from '@/config/config.ts';
import { mockConfig } from '@/dev/mock/config.ts';
import { createMockHa } from '@/dev/mock/engine.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { tileOf } from '@/tests/ids.ts';

import { renderTile } from './render-tile.tsx';
import { ToggleTile } from './toggle-tile.tsx';

describe('renderTile', () => {
  it('renders a tile for every configured tile, each placed on the grid', async () => {
    await act(() => {
      render(<>{mockConfig.tiles.map(renderTile)}</>, document.body);
    });

    const placed = [...document.querySelectorAll<HTMLElement>('.tile-place')];

    expect(placed).toHaveLength(mockConfig.tiles.length);
    expect(placed.map((el) => el.style.getPropertyValue('--col'))).toEqual(
      mockConfig.tiles.map((tile) => String(tile.col)),
    );
  });
});

describe('two tiles of one type', () => {
  it('each follow their own entity', async () => {
    const porch = {
      ...tileOf('toggle'),
      id: 'porch',
      label: 'Porch',
      col: 6,
      w: 1,
      entities: { entity: 'switch.porch' },
    };
    const cfg: RuntimeConfig = {
      ...mockConfig,
      tiles: [...mockConfig.tiles, porch],
    };
    const mock = createMockHa(cfg);
    const store = createHaStore(mock.deps, cfg);
    await act(async () => {
      await store.start(mock.getAuth);
      render(
        <HaConnection store={store}>
          <ToggleTile tile={tileOf('toggle')} store={store} />
          <ToggleTile tile={porch} store={store} />
        </HaConnection>,
        document.body,
      );
    });
    const [light, porchButton] = [...document.querySelectorAll('button')];

    await act(() => porchButton!.click());

    await act(async () => {
      await Promise.resolve();
    });
    expect(mock.controls.getState('switch.porch')?.state).toBe('on');
    expect(mock.controls.getState('switch.wall_light')?.state).toBe('off');
    expect(light!.getAttribute('aria-pressed')).toBe('false');
    expect(porchButton!.getAttribute('aria-pressed')).toBe('true');
  });
});
