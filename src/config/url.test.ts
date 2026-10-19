import { describe, expect, it } from 'vitest';

import { configUrl } from './url.ts';

describe('configUrl', () => {
  it('sits beside the base folder, not inside it', () => {
    expect(configUrl('/local/wall-panel/')).toBe(
      '/local/wall-panel.config.json',
    );
  });

  it('copes with a base without a trailing slash', () => {
    expect(configUrl('/local/wall')).toBe('/local/wall.config.json');
  });

  it('uses config.json at the root', () => {
    expect(configUrl('/')).toBe('/config.json');
  });
});
