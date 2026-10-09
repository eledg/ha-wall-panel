import { readFileSync } from 'node:fs';

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
});
