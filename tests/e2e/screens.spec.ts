import { expect, test } from './fixtures.ts';

test('Startansicht', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page).toHaveScreenshot('start.png', { animations: 'disabled' });
});
