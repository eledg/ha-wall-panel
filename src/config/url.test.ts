import { describe, expect, it } from 'vitest';

import { configUrl } from './url.ts';

describe('configUrl', () => {
  it('sits beside the app folder, not inside it', () => {
    expect(configUrl('/local/wall-panel/index.html')).toBe(
      '/local/wall-panel.config.json',
    );
  });

  it('copes with the folder URL without index.html', () => {
    expect(configUrl('/local/wall-panel/')).toBe(
      '/local/wall-panel.config.json',
    );
  });

  it('follows whatever folder the app is served from', () => {
    expect(configUrl('/local/kitchen/index.html')).toBe(
      '/local/kitchen.config.json',
    );
  });

  it('uses config.json at the root', () => {
    expect(configUrl('/')).toBe('/config.json');
    expect(configUrl('/index.html')).toBe('/config.json');
  });
});
