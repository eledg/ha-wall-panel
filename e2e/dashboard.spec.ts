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

test('event details: the next event', async ({ page }) => {
  await page.getByRole('button', { name: /Pick up groceries/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveScreenshot('event-next.png');
});

test('event details: F1 shows the full title', async ({ page }) => {
  await page.getByRole('button', { name: /F1 Singapore - Race/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading')).toContainText(
    'FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Race',
  );
  await expect(page).toHaveScreenshot('event-f1.png');
});
