import { expect, test } from './fixtures.ts';

test('App lädt ohne Fehler', async ({ page, pageErrors }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Pocket 808');
  await expect(page.locator('#play')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('kein horizontaler Scroll', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Start-Tipp schaltet Wiedergabe ein und aus', async ({ page, pageErrors }) => {
  await page.goto('/');
  const play = page.locator('#play');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#playLabel')).toHaveText('Stopp');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  expect(pageErrors).toEqual([]);
});
