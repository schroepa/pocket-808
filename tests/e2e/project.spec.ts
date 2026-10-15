import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

test.beforeEach(async ({ page }) => {
  // Teilen-Menü abschalten: Playwright prüft den Download-Weg (Teilen ist per Unit-Test abgedeckt)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Projekt und Export' });
const status = (page: Page) => dialog(page).getByRole('status');

async function openFile(page: Page) {
  await page.getByRole('button', { name: 'Datei', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}
async function closeFile(page: Page) {
  await dialog(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog(page)).toBeHidden();
}
const tempo = (page: Page) => page.getByRole('slider', { name: 'Tempo' });

test('Projekt sichern, ändern, öffnen und ersetzen; bleibt nach Neuladen', async ({ page }) => {
  const before = await tempo(page).getAttribute('aria-valuetext');
  await openFile(page);
  const download = page.waitForEvent('download');
  await dialog(page).getByRole('button', { name: 'Projekt sichern' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^pocket808-\d{4}-\d\d-\d\d\.pocket808\.json$/);
  const text = readFileSync(await file.path(), 'utf8');
  expect((JSON.parse(text) as { format: string }).format).toBe('pocket808');
  await expect(status(page)).toHaveText('Projekt gesichert');
  await closeFile(page);

  await tempo(page).press('End');
  await expect(tempo(page)).toHaveAttribute('aria-valuetext', '200 BPM');

  await openFile(page);
  const chooser = page.waitForEvent('filechooser');
  await dialog(page).getByRole('button', { name: 'Projekt öffnen' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'beat.pocket808.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(dialog(page).getByText('Aktuelles Projekt ersetzen?')).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Ersetzen' }).click();
  await expect(status(page)).toHaveText('Projekt geöffnet');
  await closeFile(page);
  await expect(tempo(page)).toHaveAttribute('aria-valuetext', before ?? '');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(tempo(page)).toHaveAttribute('aria-valuetext', before ?? '');
});

test('fremde Datei: Meldung, nichts ändert sich', async ({ page }) => {
  const before = await tempo(page).getAttribute('aria-valuetext');
  await openFile(page);
  const chooser = page.waitForEvent('filechooser');
  await dialog(page).getByRole('button', { name: 'Projekt öffnen' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'x.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hallo":1}'),
  });
  await expect(status(page)).toHaveText('Keine Pocket-808-Datei');
  await closeFile(page);
  await expect(tempo(page)).toHaveAttribute('aria-valuetext', before ?? '');
});

test('Pattern 1× als WAV: gültiger Kopf und passende Länge', async ({ page }) => {
  const bpm = Number((await tempo(page).getAttribute('aria-valuetext'))?.split(' ')[0]);
  await openFile(page);
  await dialog(page).getByRole('button', { name: 'WAV erzeugen' }).click();
  await expect(status(page)).toHaveText(/^Export fertig/, { timeout: 30_000 });
  const download = page.waitForEvent('download');
  await dialog(page).getByRole('button', { name: 'WAV sichern' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^pocket808-pattern-A-1x-\d{4}-\d\d-\d\d\.wav$/);
  const wav = readFileSync(await file.path());
  expect(wav.subarray(0, 4).toString()).toBe('RIFF');
  expect(wav.subarray(8, 12).toString()).toBe('WAVE');
  const seconds = (16 * 60) / bpm / 4 + 2;
  const expected = 44 + Math.ceil(seconds * 44100) * 4;
  expect(Math.abs(wav.length - expected) / expected).toBeLessThan(0.01);
  // nicht stumm
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
  expect(peak).toBeGreaterThan(1000);
});

test('Datei-Dialog: im Fenster, Touch-Ziele ≥ 44 px', async ({ page }, info) => {
  await openFile(page);
  const box = await dialog(page).boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  if (info.project.name === 'desktop') return;
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.file-dialog button')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.textContent, w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x.w < 44 || x.h < 44),
  );
  expect(small).toEqual([]);
  await expect(page.getByRole('button', { name: 'Datei', exact: true })).toHaveCSS(
    'min-height',
    /^(4[4-9]|[5-9]\d)px$/,
  );
});
