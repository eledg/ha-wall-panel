// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

describe('main', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renders the app into #app', async () => {
    await import('./main.tsx');

    expect(document.querySelector('#app main')).not.toBeNull();
  });
});
