export const GaugeIcon = ({
  class: className = 'size-5',
}: {
  class?: string;
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
    <path d="M5 19a9 9 0 1 1 14 0" />
    <path d="M12 14l3.5-4.5" />
    <circle cx="12" cy="14" r="1.2" fill="currentColor" />
  </svg>
);
