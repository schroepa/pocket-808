import { expect, test } from './fixtures.ts';

// Referenz des heutigen Layouts bei 390 × 844. Schritt 5 muss genau so aussehen.
test.describe('Layout-Referenz', () => {
  test.skip(({ viewport }) => viewport?.width !== 390, 'Referenz nur für Mobile');

  test('eingeklappt', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('legacy-eingeklappt.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('alle Module ausgeklappt', async ({ page }) => {
    await page.goto('/');
    for (const id of ['synHead', 'smpHead', 'mixHead', 'fxHead']) {
      await page.locator(`#${id}`).click();
    }
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('legacy-ausgeklappt.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
