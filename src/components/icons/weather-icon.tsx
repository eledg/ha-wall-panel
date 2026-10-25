import type { ComponentChildren } from 'preact';

import type { IconCondition } from '@/lib/weather-model.ts';

export type { IconCondition };

const Svg = ({
  class: className,
  children,
}: {
  class: string;
  children: ComponentChildren;
}) => (
  <svg
    viewBox="0 0 24 24"
    class={className}
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const CLOUD = 'M7 15h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 8 3.5 3.5 0 0 0 7 15Z';

/** Bundled inline so the display needs no network for icons. */
export const WeatherIcon = ({
  condition,
  class: className = 'size-8',
}: {
  condition: IconCondition;
  class?: string;
}) => {
  switch (condition) {
    case 'sunny':
      return (
        <Svg class={className}>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </Svg>
      );
    case 'clear-night':
      return (
        <Svg class={className}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        </Svg>
      );
    case 'partlycloudy':
      return (
        <Svg class={className}>
          <path d="M8 5.5a4 4 0 0 1 6.3 2.2M4 9.5h1M8 2.5v1M3.8 5.3l.8.8" />
          <path d="M9 20h8a3.5 3.5 0 0 0 .5-7A5 5 0 0 0 8.2 14 3 3 0 0 0 9 20Z" />
        </Svg>
      );
    case 'cloudy':
      return (
        <Svg class={className}>
          <path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 11 3.5 3.5 0 0 0 7 18Z" />
        </Svg>
      );
    case 'rainy':
      return (
        <Svg class={className}>
          <path d={CLOUD} />
          <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
        </Svg>
      );
    case 'snowy':
      return (
        <Svg class={className}>
          <path d={CLOUD} />
          <path
            d="M8 19v.1M12 20v.1M16 19v.1M10 22v.1M14 22v.1"
            stroke-width="2.6"
          />
        </Svg>
      );
    case 'fog':
      return (
        <Svg class={className}>
          <path d="M4 9h16M3 13h18M5 17h14M8 21h8" />
        </Svg>
      );
    case 'lightning':
      return (
        <Svg class={className}>
          <path d={CLOUD} />
          <path d="m13 14-3 4h4l-3 4" />
        </Svg>
      );
  }
};
