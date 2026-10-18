export const ThermoIcon = ({
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
    <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />
    <path d="M12 10v7" />
  </svg>
);
