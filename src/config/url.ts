/**
 * Where `config.json` is served from: beside the app's folder, not inside it,
 * so the deploy that swaps the folder never wipes it. Base `/local/wall/`
 * reads `/local/wall.config.json`. Shared with the dev server (see `dev-ha.ts`).
 */
export const configUrl = (base: string) =>
  base === '/' ? '/config.json' : `${base.replace(/\/$/, '')}.config.json`;
