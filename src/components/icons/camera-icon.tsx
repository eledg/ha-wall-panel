export const CameraIcon = ({
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
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m16 10 5-3v10l-5-3" />
  </svg>
);
