import type { ComponentType } from 'preact';

import type { MockControls } from '@/dev/mock/engine.ts';

/** One tile's (or concern's) mock controls, shown as groups in the overlay. */
export type MockPanel = {
  id: string;
  /** The section heading (level 1); the panel's groups are level 2. */
  title: string;
  Panel: ComponentType<{ mock: MockControls }>;
};
