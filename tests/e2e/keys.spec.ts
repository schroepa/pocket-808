import { expect, test } from './fixtures.ts';
import { expectPattern, expectTrack, trackSteps } from './nav.ts';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'Kürzel nur auf dem Desktop');
});

test('Leertaste, Ziffern, Pfeile, Zurück und Kürzel-Dialog', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.keyboard.press('Space');
  await expect(page.locator('.play')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(page.locator('.play')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('2');
  await expectPattern(page, 'B');
  await page.keyboard.press('ArrowDown');
  await expectTrack(page, 'SD', 'Snare Drum');
  const on = (await trackSteps(page)).and(page.locator('[aria-pressed=true]'));
  const before = await on.count();
  expect(before).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Spur leeren' }).click();
  await expect(on).toHaveCount(0);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(on).toHaveCount(before);
  await page.getByRole('button', { name: 'Tastaturkürzel' }).click();
  await expect(page.locator('dialog.keys-help')).toBeVisible();
  await page.locator('dialog.keys-help').getByRole('button', { name: 'Schließen' }).click();
  await expect(page.locator('dialog.keys-help')).toBeHidden();
});
