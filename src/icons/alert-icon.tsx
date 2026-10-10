export const AlertIcon = ({
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
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4M12 17v.5" />
  </svg>
);
