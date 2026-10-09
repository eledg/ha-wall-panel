export const buildId = () =>
  `${__BUILD_INFO__.version} (${__BUILD_INFO__.commit.slice(0, 7)})`;

export const Diagnostics = () => (
  <footer
    class="fixed right-2 bottom-2 font-mono text-xs opacity-50"
    title={`Built ${__BUILD_INFO__.builtAt}`}
  >
    {buildId()}
  </footer>
);
