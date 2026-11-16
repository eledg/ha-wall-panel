export const DoorIcon = ({
  class: className = 'size-8',
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
    <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16" />
    <circle cx="14.5" cy="12" r="0.8" fill="currentColor" />
  </svg>
);
