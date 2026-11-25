import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  eachView,
  expectTrack,
  horizontalOverflow,
  openMode,
  openPage,
  openRoll,
  pickTrack,
  rollCell,
  targets,
} from './nav.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

/** Synth zeigen: Bass wählen, Modus Spur (Startmodus) */
async function openSynth(page: Page) {
  await pickTrack(page, 'Bass');
  await expect(
    page.locator('.track-pages > section[data-kind=synth]:visible').first(),
  ).toBeVisible();
}

test('Note setzen, Preset laden, Part wechseln; bleibt nach Neuladen', async ({ page }) => {
  await pickTrack(page, 'Lead');
  await openMode(page, 'Sound');
  await openPage(page, 'Synth-Sound');
  const preset = page.locator('.syn-presets .chip').first();
  await preset.click();
  await expect(preset).toHaveAttribute('aria-pressed', 'true');
  await openMode(page, 'Spur');
  await openRoll(page);
  const cell = rollCell(page, 11, 2);
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  await page.reload();
  // der gewählte Part wird gespeichert: die Plattenkiste zeigt wieder Lead
  await openMode(page, 'Sound');
  await openPage(page, 'Synth-Sound');
  await expect(
    page.locator('[data-mode=sound] [role=radio][aria-checked=true]', { hasText: 'Lead' }),
  ).toBeVisible();
  await openMode(page, 'Spur');
  await pickTrack(page, 'Lead');
  await expectTrack(page, 'LD', 'Lead');
  await openRoll(page);
  await expect(rollCell(page, 11, 2)).toHaveAttribute('aria-pressed', 'true');
});

test('kein horizontaler Scroll mit offenem Synth', async ({ page }) => {
  await openSynth(page);
  await eachView(page, async (view) => {
    expect(await horizontalOverflow(page), view).toEqual([]);
  });
  await openRoll(page);
  expect(await horizontalOverflow(page), 'Rolle').toEqual([]);
});

test('Lauflicht in der Roll beim Spielen', async ({ page }) => {
  await openSynth(page);
  await openRoll(page);
  await page.locator('.play').click();
  await expect(page.locator('.roll .pc.now').first()).toBeVisible({ timeout: 3000 });
  await page.locator('.play').click();
});

test('Touch-Ziele im Synth mindestens 44 × 44 px (außer den dichten Rastern Roll und Steps)', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'desktop', 'nur Touch-Layouts');
  await openSynth(page);
  const check = async (view: string) => {
    const found = await targets(
      page,
      ':is([data-area=tracks], [data-area=work], [data-area=steps]) :is(button, select, [role=slider]):not(.pc, .rl, .ns)',
    );
    expect(found.count, view).toBeGreaterThan(3);
    expect(found.small, view).toEqual([]);
  };
  await eachView(page, check);
  // die Preset-Liste liegt in der Plattenkiste
  await openMode(page, 'Sound');
  await openPage(page, 'Synth-Sound');
  await expect(page.locator('.syn-presets .chip').first()).toBeVisible();
  await check('Synth-Sound');
});

test('Auswahllisten mit mindestens 16 px Schrift (iOS zoomt sonst beim Antippen)', async ({
  page,
}) => {
  await openSynth(page);
  await openPage(page, 'Noten');
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-area=work] select')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => parseFloat(getComputedStyle(el).fontSize)),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const px of sizes) expect(px).toBeGreaterThanOrEqual(16);
});

test('Werkzeug: Akkord und Akzent setzen, bleibt nach Neuladen', async ({ page }) => {
  await openSynth(page);
  await openRoll(page);
  const syn = page.locator('[data-area=work]');
  const cell = rollCell(page, 8, 1);
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
  await openRoll(page);
  const again = rollCell(page, 8, 1);
  await expect(again).toHaveText('3');
  await expect(again).toHaveClass(/acc/);
  await expect(page.locator('[aria-label="Werkzeug Note"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Arp und LFO setzen, bleibt nach Neuladen', async ({ page }) => {
  await openSynth(page);
  await openPage(page, 'Bewegung');
  const syn = page.locator('[data-area=work]');
  await syn.locator('[aria-label="Arp"] [role=radio]', { hasText: 'Auf-Ab' }).click();
  await syn.locator('[aria-label="Arp-Rate"] [role=radio]', { hasText: '1/32' }).click();
  const depth = syn.locator('[role=slider][aria-label="Depth"]');
  await depth.focus();
  await page.keyboard.press('End');
  await syn.locator('[aria-label="LFO-Ziel"] [role=radio]', { hasText: 'Pitch' }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await openSynth(page);
  await openPage(page, 'Bewegung');
  const again = page.locator('[data-area=work]');
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

test('Drive und Chorus: setzen, Preset laden, bleibt nach Neuladen', async ({ page }) => {
  await openSynth(page);
  await openMode(page, 'Sound');
  await openPage(page, 'Synth-Sound');
  await page.locator('.syn-presets .chip', { hasText: 'Reese' }).click();
  await openMode(page, 'Spur');
  await openPage(page, 'Klang');
  const syn = page.locator('[data-area=work]');
  const chorus = syn.locator('[role=slider][aria-label="Chorus"]');
  await expect(chorus).toHaveAttribute('aria-valuenow', '45');
  const drive = syn.locator('[role=slider][aria-label="Drive"]');
  await drive.focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(400);
  await page.reload();
  await openSynth(page);
  await openPage(page, 'Klang');
  const again = page.locator('[data-area=work]');
  await expect(again.locator('[role=slider][aria-label="Drive"]')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(again.locator('[role=slider][aria-label="Chorus"]')).toHaveAttribute(
    'aria-valuenow',
    '45',
  );
});
