import { useEffect, useState } from 'preact/hooks';

const PROPS = [
  'appearance',
  'backgroundColor',
  'backgroundImage',
  'borderRadius',
  'overflow',
  'position',
] as const;

const describe = (name: string, el: Element | null | undefined) => {
  if (!el) return `${name}: not found`;
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const props = PROPS.map((p) => `${p}=${style[p] || '(unsupported)'}`);
  return `${name} ${Math.round(rect.width)}x${Math.round(rect.height)}: ${props.join(' ')}`;
};

const collect = () => {
  const buttons = [...document.querySelectorAll('button')];
  return [
    `UA: ${navigator.userAgent}`,
    `Viewport: ${innerWidth}x${innerHeight} @${devicePixelRatio}x`,
    `color-mix: ${CSS.supports('color', 'color-mix(in srgb, red, blue)')}`,
    `@layer: ${typeof CSSLayerBlockRule !== 'undefined'}`,
    describe('body', document.body),
    describe(
      'version button',
      buttons.find((b) => b.textContent === __BUILD_INFO__.version),
    ),
    describe('close button', document.querySelector('[aria-label=Close]')),
    describe('tile', document.querySelector('[data-domain]')),
    describe('dialog', document.querySelector('[role=dialog]')),
  ];
};

/**
 * Temporary: the computed styles the display's browser actually applies, to
 * diagnose rendering that differs from dev. Remove once understood.
 */
export const DisplayProbe = () => {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => setLines(collect()), []);

  return (
    <section class="mt-4 space-y-1 font-mono text-small break-all text-text-muted">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
};
