import { expect, test } from '../e2e/fixtures.ts';

const EXPECTED: Record<string, string> = {
  'next-mobile': 'mobile',
  'next-tablet': 'tablet',
  'next-tablet-quer': 'tablet',
  'next-desktop': 'desktop',
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

test('richtiges Layout und kein horizontaler Scroll', async ({ page }, info) => {
  await expect(page.locator('html')).toHaveAttribute(
    'data-layout',
    EXPECTED[info.project.name] ?? '',
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Step setzen bleibt nach Neuladen erhalten', async ({ page }) => {
  const step = page.locator('[data-area=editor] .steps .step').nth(1);
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('[data-area=editor] .steps .step').nth(1)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Start lässt das Lauflicht laufen, Stopp beendet es', async ({ page, pageErrors }) => {
  const play = page.locator('.play');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-area=editor] .step.now')).toHaveCount(1, { timeout: 3000 });
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.step.now')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('Pattern wählen und Spur wählen', async ({ page }) => {
  await page.getByRole('button', { name: 'Pattern C' }).click();
  await expect(page.getByRole('button', { name: 'Pattern C' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Snare Drum wählen und anhören' }).click();
  await expect(page.locator('[data-area=editor] h2')).toContainText('SD');
});
