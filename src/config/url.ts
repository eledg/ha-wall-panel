/**
 * Where `config.json` is served from: beside the app's folder, not inside it,
 * so the deploy that swaps the folder never wipes it. Worked out from the
 * page's own address, so one build works in any folder: `/local/wall/` or
 * `/local/wall/index.html` reads `/local/wall.config.json`. At the root, as
 * under `pnpm dev`, it is `/config.json` (served by `dev-ha.ts`).
 */
export const configUrl = (pathname: string) => {
  const folder = pathname.replace(/[^/]*$/, '').replace(/\/$/, '');
  return folder === '' ? '/config.json' : `${folder}.config.json`;
};
