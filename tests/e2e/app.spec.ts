import { expect, test } from './fixtures.ts';
import {
  closeSheet,
  expectPattern,
  expectTrack,
  horizontalOverflow,
  openMode,
  openPage,
  openPattern,
  openTempo,
  pickTrack,
  playheads,
  rightOverhang,
  selectPattern,
  targets,
  trackButton,
  trackSteps,
} from './nav.ts';

const EXPECTED: Record<string, string> = {
  mobile: 'mobile',
  'mobile-quer': 'mobile',
  tablet: 'tablet',
  'tablet-quer': 'tablet',
  desktop: 'desktop',
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
  expect(await horizontalOverflow(page)).toEqual([]);
});

test('Step, Spur, Pattern und Tempo bleiben nach Neuladen erhalten', async ({ page }) => {
  await selectPattern(page, 'C');
  await pickTrack(page, 'Snare Drum');
  const step = (await trackSteps(page)).nth(1);
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
  const tempo = await openTempo(page);
  await tempo.getByRole('slider', { name: 'Tempo' }).press('End');
  await page.waitForTimeout(400);
  await page.reload();
  await expect((await trackSteps(page)).nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expectPattern(page, 'C');
  await expectTrack(page, 'SD', 'Snare Drum');
  await expect(page.locator('.lcd-digits')).toHaveText('200');
});

test('Änderung wird beim Wechsel in den Hintergrund sofort gespeichert', async ({ page }) => {
  await (await trackSteps(page)).nth(2).click();
  const saved = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const s = JSON.parse(localStorage.getItem('pocket808.v1') ?? '{}') as {
      patterns?: { A?: { BD?: number[] } };
    };
    return s.patterns?.A?.BD?.[2];
  });
  expect(saved).toBe(1);
});

test('Start lässt das Lauflicht laufen, Stopp beendet es', async ({ page, pageErrors }) => {
  const play = page.locator('.play');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect((await trackSteps(page)).and(page.locator('.now'))).toHaveCount(1, {
    timeout: 3000,
  });
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expect(playheads(page)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('Pattern wählen und Spur wählen', async ({ page }) => {
  await selectPattern(page, 'C');
  await expectPattern(page, 'C');
  await pickTrack(page, 'Snare Drum');
  await expectTrack(page, 'SD', 'Snare Drum');
});

test('Tap-Tempo setzt das Tempo, mehrstufiges Zurück nimmt zwei Änderungen nacheinander zurück', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  const tempo = await openTempo(page);
  const tap = tempo.getByRole('button', { name: 'Tempo antippen' });
  const box = await tap.boundingBox();
  if (info.project.name !== 'desktop')
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  await tap.click();
  await page.waitForTimeout(500);
  await tap.click();
  const bpm = Number(await page.locator('.lcd-digits').textContent());
  expect(bpm).toBeGreaterThanOrEqual(60);
  expect(bpm).toBeLessThanOrEqual(200);
  expect(bpm).not.toBe(90);
  await closeSheet(tempo);

  // zwei Änderungen mit Zurück, dann zweimal zurück bis der Knopf leer ist
  const pattern = await openPattern(page);
  await pattern.getByRole('button', { name: 'Pattern leeren' }).click();
  await closeSheet(pattern);
  await openMode(page, 'Sound');
  await openPage(page, 'Basis-Muster');
  await page.locator('.library-basis .chip', { hasText: 'House' }).click();
  const back = page.getByRole('button', { name: 'Zurück', exact: true });
  await expect(back).toBeEnabled();
  await back.click();
  await expect(back).toBeEnabled();
  await back.click();
  await expect(back).toBeDisabled();
});

test('Live-Aufnahme: Rec scharf, Start, Spurname tippen setzt einen Step; Zurück nimmt den Take zurück', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  const rec = page.getByRole('button', { name: 'Live-Aufnahme scharf schalten' });
  const box = await rec.boundingBox();
  if (info.project.name !== 'desktop')
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  const pattern = await openPattern(page);
  await pattern.getByRole('button', { name: 'Pattern leeren' }).click();
  await closeSheet(pattern);
  await rec.click();
  await expect(rec).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.play').click(); // zählt einen Takt vor (bei 90 BPM ≈ 2,7 s)
  await page.waitForTimeout(3300);
  const lab = await trackButton(page, 'Snare Drum');
  await lab.click();
  await lab.click(); // Telefon: das Pad-Feld bleibt bei scharfer Aufnahme offen
  await page.locator('.play').click(); // Stopp
  const sheet = page.getByRole('dialog', { name: 'Pad-Feld' });
  if (await sheet.isVisible()) await closeSheet(sheet);
  await expectTrack(page, 'SD', 'Snare Drum');
  const sd = (await trackSteps(page)).and(page.locator('.on'));
  await expect(sd.first()).toBeVisible();
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(sd).toHaveCount(0);
});

// Telefone hoch und quer, auch das kleinste quer (iPhone SE); Schriften sind hier die Ersatzschriften
test('Transport bleibt auf allen Telefonbreiten im Fenster, gestoppt und spielend', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'setzt die Größen selbst, einmal genügt');
  for (const [width, height] of [
    [375, 667],
    [430, 932],
    [667, 375],
    [844, 390],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const playing of ['true', 'false']) {
      await page.locator('.play').click();
      await expect(page.locator('.play')).toHaveAttribute('aria-pressed', playing);
      const size = `${width} × ${height}, spielt: ${playing}`;
      expect(await horizontalOverflow(page), size).toEqual([]);
      const buttons = await targets(page, '[data-area=transport] button');
      expect(buttons.count, size).toBe(5);
      expect(buttons.small, size).toEqual([]);
      expect(await rightOverhang(page, '[data-area=transport] button'), size).toBeLessThanOrEqual(
        0,
      );
    }
  }
});
