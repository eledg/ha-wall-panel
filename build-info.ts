import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import type { Plugin } from 'vite';

const recoverPath = new URL('./src/lib/recover.js', import.meta.url);

export type BuildInfo = {
  version: string;
  commit: string;
  builtAt: string;
};

const gitCommit = () => {
  try {
    return execSync('git rev-parse HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
};

// The workflow passes the release tag as BUILD_VERSION; local builds get "dev".
export const resolveBuildInfo = (env: Record<string, string>): BuildInfo => ({
  version: env.BUILD_VERSION || 'dev',
  commit: env.GITHUB_SHA || gitCommit(),
  builtAt: new Date().toISOString(),
});

const versionJson = (info: BuildInfo) => `${JSON.stringify(info, null, 2)}\n`;

// Embeds the build info in the bundle (as __BUILD_INFO__) and emits the same
// data as version.json next to index.html.
export const buildInfoPlugin = (info: BuildInfo): Plugin => ({
  name: 'build-info',
  config: () => ({ define: { __BUILD_INFO__: JSON.stringify(info) } }),
  // Inlines src/lib/recover.js into index.html, with the running build's identity.
  transformIndexHtml: (html) =>
    html.replace(
      '<!-- inline:recover -->',
      () =>
        `<script>\n${readFileSync(recoverPath, 'utf8').replace(/(?<!global )__BUILD_INFO__/, () => JSON.stringify(info))}</script>`,
    ),
  // Serves the same file under `pnpm dev`, so the diagnostics "Get latest
  // version" check runs there like in a deployed build.
  configureServer: (server) => {
    server.middlewares.use('/version.json', (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(versionJson(info));
    });
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: versionJson(info),
    });
  },
});
