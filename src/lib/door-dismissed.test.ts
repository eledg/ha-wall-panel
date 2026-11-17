// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDoorDismissals } from './door-dismissed.ts';

afterEach(() => localStorage.clear());

describe('createDoorDismissals', () => {
  it('is empty until a ring is dismissed', () => {
    expect(createDoorDismissals().get('door')).toBeUndefined();
  });

  it('keeps a dismissal across instances, as after a reload', () => {
    createDoorDismissals().dismiss('door', 1000);

    expect(createDoorDismissals().get('door')).toBe(1000);
    expect(createDoorDismissals().get('other')).toBeUndefined();
  });

  it('tells listeners, until they unsubscribe', () => {
    const d = createDoorDismissals();
    const listener = vi.fn();
    const off = d.subscribe(listener);

    d.dismiss('door', 1);
    off();
    d.dismiss('door', 2);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem('ha-wall-panel:door-dismissed:door', 'x');

    expect(createDoorDismissals().get('door')).toBeUndefined();
  });

  it('still holds for the session when storage throws', () => {
    const broken = () => {
      throw new Error('denied');
    };
    const d = createDoorDismissals(broken);

    expect(d.get('door')).toBeUndefined();
    d.dismiss('door', 5000);
    expect(d.get('door')).toBe(5000);
  });
});
