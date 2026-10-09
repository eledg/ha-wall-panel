export const buildId = () =>
  `${__BUILD_INFO__.version} (${__BUILD_INFO__.commit.slice(0, 7)})`;

export const Diagnostics = () => (
  <footer class="diagnostics" title={`Built ${__BUILD_INFO__.builtAt}`}>
    {buildId()}
  </footer>
);
