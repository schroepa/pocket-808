import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  closeSheet,
  horizontalOverflow,
  openMode,
  openPage,
  openPattern,
  rightOverhang,
  selectPattern,
  targets,
} from './nav.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

/** Modus Mixer mit der Seite Kanäle bzw. FX */
async function openMixer(page: Page, name: 'Kanäle' | 'FX') {
  await openMode(page, 'Mixer');
  await openPage(page, name);
}

/** gespeicherter Stand (das Speichern ist entprellt: mit expect.poll lesen) */
const saved = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('pocket808.v1') ?? '{}') as {
        tape?: number;
        warm?: boolean;
        drumDrive?: number;
        tempo?: number;
      },
  );

test('Mixer: Mute, Solo, Fader; Marken am Kanalzug', async ({ page }) => {
  await openMixer(page, 'Kanäle');
  await page.getByRole('button', { name: 'Kanal Snare Drum wählen' }).click();
  const mute = page.getByRole('button', { name: 'Snare Drum stumm' });
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Kanal Cowbell wählen' }).click();
  await page.getByRole('button', { name: 'Cowbell solo' }).click();
  // statt der früheren Zusammenfassung („1 stumm · Solo CB“) zeigen die Züge, was gilt
  const strip = (name: string) =>
    page.locator('.ch-strip', {
      has: page.getByRole('button', { name: `Kanal ${name} wählen`, exact: true }),
    });
  await expect(page.locator('.ch-strip.muted')).toHaveCount(1);
  await expect(strip('Snare Drum')).toHaveClass(/muted/);
  await expect(page.locator('.ch-strip.solo')).toHaveCount(1);
  await expect(strip('Cowbell')).toHaveClass(/solo/);
  const fader = page.getByRole('slider', { name: 'Lautstärke Bass Drum' });
  await fader.press('Home');
  await expect(fader).toHaveAttribute('aria-valuenow', '0');
  for (const key of ['Shift+ArrowUp', 'Shift+ArrowUp', 'ArrowUp', 'ArrowUp'])
    await fader.press(key);
  await expect(fader).toHaveAttribute('aria-valuenow', '24');
});

test('FX: Stutter halten und loslassen; Filter-Regler', async ({ page }) => {
  await openMixer(page, 'FX');
  const st = page.getByRole('button', { name: 'Stutter 1/16 halten' });
  await st.hover();
  await page.mouse.down();
  await expect(st).toHaveClass(/on/);
  await page.mouse.up();
  await expect(st).not.toHaveClass(/on/);
  const filter = page.getByRole('slider', { name: 'Filter', exact: true });
  await filter.press('Home');
  await expect(filter).toHaveAttribute('aria-valuetext', 'Tiefpass 100%');
  await expect(page.locator('.lcd-sub')).toHaveText('DJ Filter Tiefpass 100%');
});

test('FX: Warm und Tape ein- und ausschalten; bleibt nach Neuladen', async ({ page }) => {
  await openMixer(page, 'FX');
  const warm = page.getByRole('button', { name: 'Warmer, analoger Klang' });
  const tape = page.getByRole('slider', { name: 'Tape', exact: true });
  await expect(warm).toHaveAttribute('aria-pressed', 'false');
  await expect(tape).toHaveAttribute('aria-valuenow', '0');
  await warm.click();
  await expect(warm).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lcd-sub')).toHaveText('WARM AN');
  await tape.press('End');
  await expect(tape).toHaveAttribute('aria-valuenow', '100');
  await expect.poll(async () => (await saved(page)).tape).toBe(1);
  expect((await saved(page)).warm).toBe(true);
  await page.reload();
  await openMixer(page, 'FX');
  await expect(warm).toHaveAttribute('aria-pressed', 'true');
  await expect(tape).toHaveAttribute('aria-valuenow', '100');
  await warm.click();
  await expect(warm).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.lcd-sub')).toHaveText('WARM AUS');
  await tape.press('Home');
  await expect(tape).toHaveAttribute('aria-valuenow', '0');
  // aus heißt: die Felder fehlen wieder im Speicherstand
  await expect.poll(async () => 'tape' in (await saved(page))).toBe(false);
  await expect.poll(async () => 'warm' in (await saved(page))).toBe(false);
});

test('FX: Drum Drive einstellen; bleibt nach Neuladen', async ({ page }) => {
  await openMixer(page, 'FX');
  const drive = page.getByRole('slider', { name: 'Drum Drive', exact: true });
  await expect(drive).toHaveAttribute('aria-valuenow', '0');
  await drive.press('End');
  await expect(drive).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('.lcd-sub')).toHaveText('Drum Drive 100%');
  await expect.poll(async () => (await saved(page)).drumDrive).toBe(1);
  await page.reload();
  await openMixer(page, 'FX');
  await expect(drive).toHaveAttribute('aria-valuenow', '100');
  await drive.press('Home');
  await expect(drive).toHaveAttribute('aria-valuenow', '0');
  // aus heißt: das Feld fehlt wieder im Speicherstand
  await expect.poll(async () => 'drumDrive' in (await saved(page))).toBe(false);
});

test('Song: anhängen, Wiederholung, verschieben, entfernen, leeren; bleibt nach Neuladen', async ({
  page,
}) => {
  await openMode(page, 'Song');
  await page.locator('.song .chip', { hasText: 'Leeren' }).click();
  const add = page.getByRole('button', { name: 'Aktuelles Pattern an den Song anhängen' });
  await add.click();
  await selectPattern(page, 'B');
  await add.click();
  await page.getByRole('button', { name: 'Wiederholungen erhöhen' }).click();
  await page.getByRole('button', { name: 'Nach vorne schieben' }).click();
  await expect(page.locator('.blk').first()).toHaveAttribute(
    'aria-label',
    'Position 1: Pattern B, 2 mal',
  );
  await page.waitForTimeout(400);
  await page.reload();
  await openMode(page, 'Song');
  await expect(page.locator('.blk')).toHaveCount(2);
  await page.locator('.blk').first().click();
  await page.getByRole('button', { name: 'Position entfernen' }).click();
  await expect(page.locator('.blk')).toHaveCount(1);
});

test('Vorlage laden und zurück; Kopieren und Einfügen', async ({ page }) => {
  await openMode(page, 'Sound');
  await openPage(page, 'Basis-Muster');
  const house = page.locator('.library-basis .chip', { hasText: 'House' });
  await house.click();
  await expect(house).toHaveAttribute('aria-pressed', 'true');
  const back = page.getByRole('button', { name: 'Zurück', exact: true });
  await back.click();
  await expect(house).toHaveAttribute('aria-pressed', 'false');
  let sheet = await openPattern(page);
  await sheet.getByRole('button', { name: 'Kopieren' }).click();
  await selectPattern(page, 'D');
  sheet = await openPattern(page);
  await sheet.getByRole('button', { name: 'Einfügen' }).click();
  await expect(page.locator('.lcd-sub')).toHaveText('EINGEFÜGT IN D');
  await closeSheet(sheet);
});

test('Mixer und FX: im Fenster, Touch-Ziele ≥ 44 px', async ({ page }, info) => {
  await openMode(page, 'Mixer');
  for (const name of ['Kanäle', 'Szenen', 'FX']) {
    await openPage(page, name);
    const section = `section[data-mode=mixer] section[data-page]`;
    expect(await horizontalOverflow(page), name).toEqual([]);
    expect(
      await rightOverhang(
        page,
        `section[data-mode=mixer], ${section}, ${section} :is(button, input, [role=slider])`,
      ),
      name,
    ).toBeLessThanOrEqual(0);
    if (info.project.name === 'desktop') continue;
    const found = await targets(page, 'section[data-mode=mixer] :is(button, input, [role=slider])');
    expect(found.count, name).toBeGreaterThan(5);
    expect(found.small, name).toEqual([]);
  }
});

test('Vorlagen-Browser: Stil wählen, Vorlage laden, Warm und Tape an; bleibt nach Neuladen', async ({
  page,
}) => {
  await openMode(page, 'Sound');
  await openPage(page, 'Vorlagen');
  await page.locator('.library-genres .chip', { hasText: 'Lo-Fi' }).click();
  const tpl = page.locator('.library-templates .chip', { hasText: 'Dusty Tape' });
  await tpl.click();
  await expect(tpl).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('section[data-page=vorlagen] .tpl-hint')).toContainText('78 BPM');
  await openPage(page, 'Kits');
  await expect(page.locator('.library-kits .chip', { hasText: 'Lo-Fi' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(async () => (await saved(page)).tape).toBe(0.6);
  expect((await saved(page)).warm).toBe(true);
  expect((await saved(page)).tempo).toBe(78);
  await page.reload();
  // nach dem Neuladen öffnet der Browser beim Stil der geladenen Vorlage
  await openMode(page, 'Sound');
  await openPage(page, 'Vorlagen');
  await expect(page.locator('.library-templates .chip', { hasText: 'Dusty Tape' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Zurück gibt es nach dem Neuladen nicht mehr; eine andere Vorlage ersetzt den Klang wieder
  await page.locator('.library-genres .chip', { hasText: 'Techno' }).click();
  await page.locator('.library-templates .chip', { hasText: 'Peak Techno' }).click();
  await expect.poll(async () => (await saved(page)).tape).toBeUndefined();
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect.poll(async () => (await saved(page)).tape).toBe(0.6);
});

test('Stil Berlin: Vorlage laden setzt Drum Drive; eine ohne löscht ihn; Zurück', async ({
  page,
}) => {
  await openMode(page, 'Sound');
  await openPage(page, 'Vorlagen');
  await page.locator('.library-genres .chip', { hasText: 'Berlin' }).click();
  await page.locator('.library-templates .chip', { hasText: 'Westwerk' }).click();
  await expect.poll(async () => (await saved(page)).drumDrive).toBe(0.45);
  expect((await saved(page)).tempo).toBe(135);
  await page.locator('.tpl-scope [role=radio]', { hasText: 'Drums' }).click();
  await page.locator('.library-templates .chip', { hasText: 'Kajal' }).click();
  await expect.poll(async () => 'drumDrive' in (await saved(page))).toBe(false);
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect.poll(async () => (await saved(page)).drumDrive).toBe(0.45);
});

test('Vorlagen-Browser: im Fenster, Touch-Ziele ≥ 44 px', async ({ page }, info) => {
  await openMode(page, 'Sound');
  await openPage(page, 'Vorlagen');
  await page.locator('.library-genres .chip', { hasText: 'Trap' }).click();
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
  for (const [name, sel] of [
    ['Vorlagen', '.library-genres .chip'],
    ['Vorlagen', '.library-templates .chip'],
    ['Vorlagen', '.tpl-scope [role=radio]'],
    ['Basis-Muster', '.library-basis .chip'],
    ['Kits', '.library-kits .chip'],
  ] as const) {
    await openPage(page, name);
    expect(await horizontalOverflow(page), name).toEqual([]);
    const all = await page.locator(sel).all();
    expect(all.length, sel).toBeGreaterThan(1);
    for (const el of all) {
      const box = await el.boundingBox();
      expect(box, sel).not.toBeNull();
      // am Desktop (Maus) dürfen die Ziele kleiner sein
      if (info.project.name !== 'desktop') expect(box?.height ?? 0, sel).toBeGreaterThanOrEqual(44);
      expect((box?.x ?? 0) + (box?.width ?? 0), sel).toBeLessThanOrEqual(width + 1);
    }
  }
});
