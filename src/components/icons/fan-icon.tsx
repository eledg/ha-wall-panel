export const FanIcon = ({
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
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10c0-4 1-7 4-7s2 5-4 7ZM14 12c4 0 7 1 7 4s-5 2-7-4ZM12 14c0 4-1 7-4 7s-2-5 4-7ZM10 12c-4 0-7-1-7-4s5-2 7 4Z" />
  </svg>
);
