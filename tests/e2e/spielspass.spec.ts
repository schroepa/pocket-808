import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { openMode, openPage, openPattern, targets } from './nav.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

const steps = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.all-tracks .at-cell')]
      .map((c) => c.getAttribute('aria-pressed'))
      .join(''),
  );

test('Würfeln verändert das Pattern; Zurück stellt es wieder her', async ({ page }) => {
  const before = await steps(page);
  // Drums, Bass, Lead und mindestens das gewählte Pad
  expect(await page.locator('.all-tracks .at-cell').count()).toBeGreaterThanOrEqual(13 * 16);
  await openPattern(page);
  const dice = page.getByRole('button', { name: 'Variation würfeln' });
  // bis eine Variation entsteht (in seltenen Würfen ändert sich nichts)
  for (let i = 0; i < 5 && (await steps(page)) === before; i++) await dice.click();
  expect(await steps(page)).not.toBe(before);
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  expect(await steps(page)).toBe(before);
});

test('Szene sichern und abrufen; bleibt nach Neuladen', async ({ page }) => {
  await openMode(page, 'Mixer');
  const mute = page.getByRole('button', { name: 'Snare Drum stumm' });
  const scene = page.getByRole('button', { name: 'Szene 3', exact: true });
  const selectSnare = async () => {
    await openPage(page, 'Kanäle');
    await page.getByRole('button', { name: 'Kanal Snare Drum wählen' }).click();
  };
  await openPage(page, 'Szenen');
  await scene.click();
  await selectSnare();
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await openPage(page, 'Szenen');
  await scene.click();
  await openPage(page, 'Kanäle');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(400);
  await page.reload();
  await openMode(page, 'Mixer');
  await openPage(page, 'Szenen');
  await expect(scene).toHaveClass(/has/);
});

test('LCD-Streifen im Fenster', async ({ page }) => {
  const box = await page.locator('.lcd-scope').boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(20);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});

test('Szenen-Tasten mindestens 44 px', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'Touch-Ziele nur auf Touch-Layouts');
  await openMode(page, 'Mixer');
  await openPage(page, 'Szenen');
  const found = await targets(page, '.scene-row .chip');
  expect(found.count).toBe(8);
  expect(found.small).toEqual([]);
});
