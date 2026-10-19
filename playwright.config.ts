import { defineConfig } from '@playwright/test';

// The Shelly Wall Display X2i (docs/display.md): 944 x 459 CSS px at a pixel
// ratio of 1.5, so screenshots are 1416 x 688.5 device px.
const PORT = 5199;

export default defineConfig({
  testDir: 'e2e',
  // Baselines are per-OS because font rasterisation differs. CI (Linux) is the
  // source of truth: update them with `pnpm test:e2e:update` on Linux.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 944, height: 459 },
    deviceScaleFactor: 1.5,
    hasTouch: true,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide' },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `pnpm exec vite --mode mock --port ${PORT}`,
    url: `http://localhost:${PORT}/local/wall-dashboard/`,
    reuseExistingServer: !process.env.CI,
  },
});
