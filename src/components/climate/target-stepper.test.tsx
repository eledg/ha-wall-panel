// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TargetStepper } from './target-stepper.tsx';

afterEach(() => render(null, document.body));

const setup = (props: Partial<Parameters<typeof TargetStepper>[0]> = {}) => {
  const onStep = vi.fn();
  render(
    <TargetStepper
      currentLabel="Living room now"
      targetLabel="Heating target"
      current={19.9}
      target={20}
      min={5}
      max={30}
      step={0.5}
      locked={false}
      busy={false}
      pending={false}
      skeleton={false}
      flashing={false}
      onStep={onStep}
      {...props}
    />,
    document.body,
  );
  const button = (name: string) =>
    document.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
  return { onStep, button };
};

describe('TargetStepper', () => {
  it("shows the caller's labels, the room temperature and the target", () => {
    setup();

    expect(document.body.textContent).toContain('Living room now');
    expect(document.body.textContent).toContain('19.9°');
    expect(
      document.querySelector('[aria-label="Heating target"]')?.textContent,
    ).toContain('20.0°');
  });

  it('steps up and down', () => {
    const { button, onStep } = setup();

    act(() => button('Raise').click());
    act(() => button('Lower').click());

    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it('disables a button at its limit, and both while locked or busy', () => {
    expect(setup({ target: 30 }).button('Raise').disabled).toBe(true);
    expect(setup({ target: 5 }).button('Lower').disabled).toBe(true);
    expect(setup({ locked: true }).button('Raise').disabled).toBe(true);
    expect(setup({ busy: true }).button('Lower').disabled).toBe(true);
  });

  it('shows dashes for a missing reading or target', () => {
    setup({ current: undefined, target: undefined });

    expect(document.body.textContent?.match(/—/g)).toHaveLength(2);
  });
});
