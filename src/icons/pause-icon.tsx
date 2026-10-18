export const PauseIcon = ({
  class: className = 'size-3',
}: {
  class?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    class={className}
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
