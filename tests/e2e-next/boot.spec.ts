import { expect, test } from '../e2e/fixtures.ts';

test('die neue App startet ohne Fehler', async ({ page, pageErrors }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Pocket 808');
  await expect(page.locator('#app')).not.toBeEmpty();
  expect(pageErrors).toEqual([]);
});
