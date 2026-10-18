// @vitest-environment happy-dom
import { render } from 'preact';
import { describe, expect, it } from 'vitest';

import { ConfigWarning } from './config-warning.tsx';

describe('ConfigWarning', () => {
  it('renders nothing when the config is valid', () => {
    render(<ConfigWarning issues={[]} />, document.body);

    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('lists each issue visibly', () => {
    render(
      <ConfigWarning
        issues={[{ key: 'officeLight', message: 'entity ID is missing' }]}
      />,
      document.body,
    );

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'officeLight: entity ID is missing',
    );
  });
});
