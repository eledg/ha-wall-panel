// @vitest-environment happy-dom
import type { Auth } from 'home-assistant-js-websocket';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_NIGHT } from '@/config/config.ts';
import { mockConfig } from '@/dev/mock/config.ts';
import { createHaStore } from '@/services/ha/store.ts';
import { fakeHaDeps } from '@/tests/ha-deps.ts';

import { useNight } from './use-night.ts';

const LIGHT = 'switch.night_override';
const night = { ...DEFAULT_NIGHT, overrideSwitch: LIGHT };
const at22 = () => new Date(2026, 2, 14, 22, 0, 0);
const at12 = () => new Date(2026, 2, 14, 12, 0, 0);

const setup = async () => {
  const { deps, push } = fakeHaDeps();
  const store = createHaStore(deps, {
    ...mockConfig,
    night,
  });
  await act(async () => {
    await store.start(() => Promise.resolve({} as Auth));
  });
  return {
    store,
    set: (state?: string) =>
      act(() => push(state ? { [LIGHT]: { state, attributes: {} } } : {})),
  };
};

const probe = (
  now: () => Date,
  store: Awaited<ReturnType<typeof setup>>['store'],
) => {
  const seen: { night: boolean; dimmed: boolean }[] = [];
  const Probe = () => {
    const { night: n, dimmed } = useNight(now, night, store);
    seen.push({ night: n, dimmed });
    return null;
  };
  act(() => render(<Probe />, document.body));
  return () => seen.at(-1);
};

describe('useNight overrideSwitch', () => {
  afterEach(() => render(null, document.body));

  it('is night at night while the light is off or has no state', async () => {
    const { store, set } = await setup();
    const last = probe(at22, store);
    expect(last()).toEqual({ night: true, dimmed: true });
    await set('off');
    expect(last()?.night).toBe(true);
  });

  it('is day while the light is on, and night again when it goes off', async () => {
    const { store, set } = await setup();
    const last = probe(at22, store);
    await set('on');
    expect(last()).toEqual({ night: false, dimmed: false });
    await set('off');
    expect(last()).toEqual({ night: true, dimmed: true });
  });

  it.each(['unavailable', 'unknown'])('ignores a %s light', async (state) => {
    const { store, set } = await setup();
    const last = probe(at22, store);
    await set(state);
    expect(last()?.night).toBe(true);
  });

  it('changes nothing outside the night hours', async () => {
    const { store, set } = await setup();
    const last = probe(at12, store);
    await set('on');
    expect(last()?.night).toBe(false);
    await set('off');
    expect(last()?.night).toBe(false);
  });
});
