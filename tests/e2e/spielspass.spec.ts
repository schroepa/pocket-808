import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

async function openMixer(page: Page) {
  const head = page.locator('#dev-head-mix');
  if ((await head.getAttribute('role')) === 'tab') await head.click();
  else if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
  await expect(page.locator('#dev-mix')).toBeVisible();
}
const steps = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.tracks .cell')]
      .map((c) => c.getAttribute('aria-pressed'))
      .join(''),
  );

test('Würfeln verändert das Pattern; Zurück stellt es wieder her', async ({ page }) => {
  const before = await steps(page);
  const dice = page.getByRole('button', { name: 'Variation würfeln' });
  // bis eine Variation entsteht (in seltenen Würfen ändert sich nichts)
  for (let i = 0; i < 5 && (await steps(page)) === before; i++) await dice.click();
  expect(await steps(page)).not.toBe(before);
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  expect(await steps(page)).toBe(before);
});

test('Szene sichern und abrufen; bleibt nach Neuladen', async ({ page }) => {
  await openMixer(page);
  const mute = page.getByRole('button', { name: 'Snare Drum stumm' });
  await page.getByRole('button', { name: 'Szene 3', exact: true }).click();
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Szene 3', exact: true }).click();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(400);
  await page.reload();
  await openMixer(page);
  await expect(page.getByRole('button', { name: 'Szene 3', exact: true })).toHaveClass(/has/);
});

test('LCD-Streifen im Fenster', async ({ page }) => {
  const box = await page.locator('.lcd-scope').boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(20);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});

test('Szenen-Tasten mindestens 44 px', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'Touch-Ziele nur auf Touch-Layouts');
  await openMixer(page);
  for (const b of await page
    .locator('.scene-row .chip')
    .evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height })),
    )) {
    expect(b.w).toBeGreaterThanOrEqual(44);
    expect(b.h).toBeGreaterThanOrEqual(44);
  }
});
