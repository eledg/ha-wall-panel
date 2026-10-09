import { execSync } from 'node:child_process';

import type { Plugin } from 'vite';

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

// Embeds the build info in the bundle (as __BUILD_INFO__) and emits the same
// data as version.json next to index.html.
export const buildInfoPlugin = (info: BuildInfo): Plugin => ({
  name: 'build-info',
  config: () => ({ define: { __BUILD_INFO__: JSON.stringify(info) } }),
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify(info, null, 2)}\n`,
    });
  },
});
