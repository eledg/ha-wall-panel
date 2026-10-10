export const BulbIcon = ({
  class: className = 'size-8',
  on = false,
}: {
  class?: string;
  on?: boolean;
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
    <path d="M9 18h6M10 21h4" />
    <path
      d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"
      fill={on ? 'currentColor' : 'none'}
      fill-opacity={on ? 0.25 : 0}
    />
  </svg>
);
