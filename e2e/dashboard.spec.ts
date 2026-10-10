import { expect, test } from '@playwright/test';

// A fixed instant, so the clock, date and forecast hours never drift.
const NOW = new Date('2026-03-14T09:41:00Z');

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
  await page.goto('/local/office-wall-display/');
  // The mock controls are a dev aid, not part of the display.
  await page.addStyleTag({
    content: '#mock-overlay { display: none !important; }',
  });
  await page.clock.runFor(1000);
});

test('dashboard against the mock HA', async ({ page }) => {
  await expect(page.getByText('09:41')).toBeVisible();
  await expect(page).toHaveScreenshot('dashboard.png');
});
