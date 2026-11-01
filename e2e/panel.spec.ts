import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// A fixed instant, so the clock, date and forecast hours never drift.
const NOW = new Date('2026-03-14T09:41:00Z');

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
  await page.goto('/');
  // The mock controls are a dev aid, not part of the display. The pixel shift
  // moves the grid by a few px, so hold it still: baselines then never depend
  // on the shift path or step (it has its own test below).
  await page.addStyleTag({
    content:
      '#mock-overlay { display: none !important; } .dash-grid { transform: none !important; }',
  });
  await page.clock.runFor(1000);
});

test('panel against the mock HA', async ({ page }) => {
  await expect(page.getByText('09:41')).toBeVisible();
  await expect(page).toHaveScreenshot('panel.png');
});

test('diagnostics: the version button is tappable', async ({ page }) => {
  // A real click fails if another element (such as <main>) covers the button.
  await page.getByRole('button', { name: 'Diagnostics' }).click();
  await expect(page.getByRole('dialog', { name: 'Diagnostics' })).toBeVisible();
});

test('calendar: all four rows fit inside the tile', async ({ page }) => {
  const row = page.getByRole('button', { name: /Swimming lessons/ });
  await expect(row).toBeVisible();
  const rowBox = await row.boundingBox();
  const tileBox = await page
    .locator('.rounded-tile')
    .filter({ has: row })
    .boundingBox();
  // The tile has 16px of padding, so the row must end above that.
  expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(
    tileBox!.y + tileBox!.height - 16,
  );
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

test('heating: the sheet', async ({ page }) => {
  await page.getByRole('button', { name: /^Heating/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Let the demand history load.
  await expect(
    page.getByRole('img', { name: /Heating power peaked/ }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('heating-sheet.png');
});

test('weather: the sheet', async ({ page }) => {
  await page.getByRole('button', { name: /Sunny/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Let both forecasts load.
  await expect(page.getByLabel('7-day outlook')).toBeVisible();
  await expect(page.getByLabel('Next hours')).toBeVisible();
  await expect(page).toHaveScreenshot('weather-sheet.png');
});

// The mock overlay is hidden for the screenshots, so open it and press its chip
// with a dispatched click, which works on hidden elements.
const setWarnings = async (page: Page, label: string) => {
  const overlay = page.locator('#mock-overlay');
  await overlay.locator('button[aria-expanded]').dispatchEvent('click');
  await overlay
    .locator('button', { hasText: new RegExp(`^${label}$`) })
    .dispatchEvent('click');
};

test('weather: warnings on the tile', async ({ page }) => {
  await setWarnings(page, 'Multiple');
  const badge = page.getByRole('img', { name: /Amber warning: Rain/ });
  await expect(badge).toBeVisible();
  await expect(
    page.locator('.rounded-tile').filter({ has: badge }),
  ).toHaveScreenshot('weather-tile-warnings.png');
});

test('weather: the warning details', async ({ page }) => {
  await setWarnings(page, 'Multiple');
  await page.getByRole('button', { name: /Sunny/ }).click();
  await page.getByRole('button', { name: /View amber warning/ }).click();
  await expect(page.getByText('Weather warnings')).toBeVisible();
  await expect(page).toHaveScreenshot('weather-warnings.png');
});

test('climate: the sheet', async ({ page }) => {
  await page.getByRole('button', { name: /humidity/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Let the history load.
  await expect(page.getByRole('img', { name: /chart/ })).toBeVisible();
  await expect(page).toHaveScreenshot('climate-sheet.png');
});

test('pixel shift: the grid moves every five minutes', async ({ page }) => {
  // The style tag above pins the transform, so read the inline style instead.
  const shift = () =>
    page.locator('.dash-grid').evaluate((el) => el.getAttribute('style'));
  const before = await shift();
  expect(before).toContain('translate(');
  await page.clock.runFor(5 * 60_000);
  expect(await shift()).not.toBe(before);
});
