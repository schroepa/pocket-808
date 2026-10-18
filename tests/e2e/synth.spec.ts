import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

/** Synth sichtbar machen: Mobile aufklappen, Tablet ist Standard-Tab, Desktop immer sichtbar */
async function openSynth(page: Page) {
  const head = page.locator('#dev-head-synth');
  if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
  await expect(page.locator('#dev-synth')).toBeVisible();
}

test('Note setzen, Preset laden, Part wechseln; bleibt nach Neuladen', async ({ page }) => {
  await openSynth(page);
  await page.locator('#dev-synth [role=radio]', { hasText: 'Lead' }).click();
  const preset = page.locator('#dev-synth .syn-presets .chip').first();
  await preset.click();
  await expect(preset).toHaveAttribute('aria-pressed', 'true');
  const cell = page.locator('#dev-synth .rr:not(.hd)').nth(11).locator('.pc').nth(2);
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  await page.reload();
  // Mobile: der aufgeklappte Synth bleibt nach dem Neuladen offen (open.synth wird gespeichert)
  const head = page.locator('#dev-head-synth');
  if ((await head.getAttribute('aria-expanded')) !== null) {
    await expect(head).toHaveAttribute('aria-expanded', 'true');
  }
  await openSynth(page);
  await expect(
    page.locator('#dev-synth .rr:not(.hd)').nth(11).locator('.pc').nth(2),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('#dev-synth [role=radio][aria-checked=true]', { hasText: 'Lead' }),
  ).toBeVisible();
});

test('kein horizontaler Scroll mit offenem Synth', async ({ page }) => {
  await openSynth(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Lauflicht in der Roll beim Spielen', async ({ page }) => {
  await openSynth(page);
  await page.locator('.play').click();
  await expect(page.locator('#dev-synth .pc.now').first()).toBeVisible({ timeout: 3000 });
  await page.locator('.play').click();
});

test('Touch-Ziele im Synth mindestens 44 × 44 px (außer dem dichten Roll-Raster)', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'desktop', 'nur Touch-Layouts');
  await openSynth(page);
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '#dev-synth :is(button, select, [role=slider]):not(.pc, .rl)',
      ),
    ]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: el.getAttribute('aria-label') ?? el.textContent,
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter((x) => x.w < 44 || x.h < 44),
  );
  expect(small).toEqual([]);
});

test('Auswahllisten mit mindestens 16 px Schrift (iOS zoomt sonst beim Antippen)', async ({
  page,
}) => {
  await openSynth(page);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('#dev-synth select')].map((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    ),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const px of sizes) expect(px).toBeGreaterThanOrEqual(16);
});

test('Werkzeug: Akkord und Akzent setzen, bleibt nach Neuladen', async ({ page }) => {
  await openSynth(page);
  const syn = page.locator('#dev-synth');
  const cell = syn.locator('.rr:not(.hd)').nth(8).locator('.pc').nth(1);
  await syn.locator('[aria-label="Notenlänge 1/16"]').click();
  await cell.click();
  await syn.locator('[aria-label="Werkzeug Akkord"]').click();
  await cell.click();
  await expect(cell).toHaveText('3');
  await expect(page.locator('.lcd')).toContainText('Dreiklang');
  await syn.locator('[aria-label="Werkzeug Akzent"]').click();
  await cell.click();
  await expect(cell).toHaveClass(/acc/);
  await page.waitForTimeout(400);
  await page.reload();
  await openSynth(page);
  const again = page.locator('#dev-synth .rr:not(.hd)').nth(8).locator('.pc').nth(1);
  await expect(again).toHaveText('3');
  await expect(again).toHaveClass(/acc/);
  await expect(page.locator('#dev-synth [aria-label="Werkzeug Note"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Arp und LFO setzen, bleibt nach Neuladen', async ({ page }) => {
  await openSynth(page);
  const syn = page.locator('#dev-synth');
  await syn.locator('[aria-label="Arp"] [role=radio]', { hasText: 'Auf-Ab' }).click();
  await syn.locator('[aria-label="Arp-Rate"] [role=radio]', { hasText: '1/32' }).click();
  const depth = syn.locator('[role=slider][aria-label="Depth"]');
  await depth.focus();
  await page.keyboard.press('End');
  await syn.locator('[aria-label="LFO-Ziel"] [role=radio]', { hasText: 'Pitch' }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await openSynth(page);
  const again = page.locator('#dev-synth');
  await expect(again.locator('[aria-label="Arp"] [role=radio][aria-checked=true]')).toHaveText(
    'Auf-Ab',
  );
  await expect(again.locator('[aria-label="Arp-Rate"] [role=radio][aria-checked=true]')).toHaveText(
    '1/32',
  );
  await expect(again.locator('[role=slider][aria-label="Depth"]')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(again.locator('[aria-label="LFO-Ziel"] [role=radio][aria-checked=true]')).toHaveText(
    'Pitch',
  );
});
