export const SunsetIcon = ({
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
    <path d="M12 6V3M5.6 7.6l2 2M18.4 7.6l-2 2M4 18h16M8 18a4 4 0 0 1 8 0M12 13l-2.5 2.5M12 13l2.5 2.5" />
  </svg>
);
