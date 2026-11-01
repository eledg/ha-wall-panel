import { readFileSync } from 'node:fs';

import type { ViteDevServer } from 'vite';
import { describe, expect, it } from 'vitest';

import { buildInfoPlugin } from './build-info.ts';

const info = { version: 'v1.2.3', commit: 'abc123', builtAt: 'now' };

describe('build info plugin', () => {
  it('inlines the recovery script into index.html with the build identity', () => {
    const transform = buildInfoPlugin(info).transformIndexHtml as (
      html: string,
    ) => string;
    const html = readFileSync('index.html', 'utf8');

    const out = transform(html);

    expect(out).not.toContain('<!-- inline:recover -->');
    expect(out).toContain('<script>');
    expect(out).toContain(`keyOf(${JSON.stringify(info)})`);
    expect(out).not.toContain('keyOf(__BUILD_INFO__)');
  });

  it('serves version.json from the dev server', () => {
    let handler: ((req: unknown, res: unknown) => void) | undefined;
    let path: string | undefined;
    const server = {
      middlewares: {
        use: (p: string, h: typeof handler) => {
          path = p;
          handler = h;
        },
      },
    } as unknown as ViteDevServer;
    const headers: Record<string, string> = {};
    let body = '';

    (buildInfoPlugin(info).configureServer as (s: ViteDevServer) => void)(
      server,
    );
    handler!(
      {},
      {
        setHeader: (k: string, v: string) => (headers[k] = v),
        end: (b: string) => (body = b),
      },
    );

    expect(path).toBe('/version.json');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(body)).toEqual(info);
  });
});
