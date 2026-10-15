import { expect, test } from '../e2e/fixtures.ts';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'next-desktop', 'Kürzel nur auf dem Desktop');
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
  await expect(page.getByRole('button', { name: 'Pattern B', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-area=editor] h2')).toContainText('SD');
  const on = page.locator('[data-area=editor] .steps .step[aria-pressed=true]');
  const before = await on.count();
  expect(before).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Spur leeren' }).click();
  await expect(on).toHaveCount(0);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(on).toHaveCount(before);
  await page.getByRole('button', { name: 'Tastaturkürzel' }).click();
  await expect(page.locator('dialog.keys-help')).toBeVisible();
});
