import { render } from 'preact';

import { createMockHa } from './engine.ts';
import { Overlay } from './overlay.tsx';

const mock = createMockHa();

export const { deps, getAuth } = mock;

/** Renders the overlay on its own root, so the app tree never sees it. */
export const mountOverlay = () => {
  const root = document.createElement('div');
  root.id = 'mock-overlay';
  document.body.append(root);
  render(<Overlay mock={mock.controls} />, root);
};
