// @vitest-environment happy-dom
import { render } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeviceTile, Temperature } from './device-tile.tsx';

const mount = (ui: preact.ComponentChildren) => render(ui, document.body);

afterEach(() => render(null, document.body));

describe('Temperature', () => {
  it('shows the value with a degree symbol', () => {
    mount(<Temperature value="21.4" />);

    expect(document.body.textContent).toBe('21.4°');
  });

  it('dims the degree symbol unless told to match the digits', () => {
    mount(<Temperature value="21.4" />);
    expect(document.querySelector('span span')?.className).toContain(
      'text-fg-dim',
    );

    mount(<Temperature value="21.4" matchDegree />);
    expect(document.querySelector('span span')?.className).not.toContain(
      'text-fg-dim',
    );
  });
});

describe('DeviceTile', () => {
  it('shows the label, status and value', () => {
    mount(
      <DeviceTile
        area="temp"
        icon={<i />}
        label="Office"
        status={<span>51%</span>}
        value="22.2"
        right="Cool"
      />,
    );

    const text = document.body.textContent;
    expect(text).toContain('Office');
    expect(text).toContain('51%');
    expect(text).toContain('22.2');
    expect(text).toContain('Cool');
  });

  it('lights up with the accent tone', () => {
    mount(<DeviceTile area="ac" icon={<i />} label="AC" tone="accent" />);

    expect(document.body.firstElementChild?.className).toContain(
      'border-accent',
    );
  });

  it('shows unavailable instead of the value', () => {
    mount(
      <DeviceTile
        area="ac"
        icon={<i />}
        label="AC"
        state="unavailable"
        value="secret"
      />,
    );

    expect(document.body.textContent).toContain('Unavailable');
    expect(document.body.textContent).not.toContain('secret');
  });

  it('taps when given a handler', () => {
    const onTap = vi.fn();
    mount(<DeviceTile area="ac" icon={<i />} label="AC" onTap={onTap} />);

    document.querySelector('button')!.click();

    expect(onTap).toHaveBeenCalledOnce();
  });
});
