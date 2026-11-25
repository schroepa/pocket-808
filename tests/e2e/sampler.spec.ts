import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  eachView,
  expectTrack,
  horizontalOverflow,
  openPage,
  pickTrack,
  rightOverhang,
  targets,
  trackSteps,
} from './nav.ts';

/** Kurzer 440-Hz-Ton als 16-Bit-WAV (0,2 s, 22,05 kHz) */
function toneWav(): Buffer {
  const rate = 22050;
  const n = Math.round(rate * 0.2);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return b;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

/** Sampler zeigen: Spur wählen (Modus Spur ist der Startmodus) */
async function openSampler(page: Page) {
  await pickTrack(page, 'Sampler');
  await expect(page.locator('.smp-head')).toBeVisible();
}

const pad = (page: Page, n: number) =>
  page.locator('.smp-head').getByRole('button', { name: `Pad ${n}`, exact: true });

test('Pad wählen, Step setzen, Datei laden; bleibt nach Neuladen', async ({ page }) => {
  await openSampler(page);
  await pad(page, 6).click();
  await expect(pad(page, 6)).toHaveClass(/sel/);
  await openPage(page, 'Klang');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.smp-tools .chip', { hasText: 'Laden' }).click();
  await (await chooser).setFiles({ name: 'ton.wav', mimeType: 'audio/wav', buffer: toneWav() });
  await expect(page.locator('.smp-head [role=status]')).toHaveText('Pad 6 geladen');
  await expect(pad(page, 6).locator('small')).toHaveText('ton');
  await openPage(page, 'Trig');
  const step = (await trackSteps(page)).nth(2);
  // Telefon und Tablet: „Sampler Step 3“, Desktop: die Zeile des Pads in „Alle Spuren“
  await expect(step).toHaveAttribute('aria-label', /^(Sampler|Pad 6) Step 3$/);
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  await page.reload();
  await openSampler(page);
  await expect(pad(page, 6).locator('small')).toHaveText('ton');
  // das gewählte Pad bleibt gewählt, und sein Step bleibt gesetzt
  await expect(pad(page, 6)).toHaveAttribute('aria-pressed', 'true');
  await expectTrack(page, 'SM', 'Pad 6');
  await expect((await trackSteps(page)).nth(2)).toHaveAttribute('aria-pressed', 'true');
});

test('Rev und Leeren', async ({ page }) => {
  await openSampler(page);
  await openPage(page, 'Klang');
  const rev = page.getByRole('button', { name: 'Rückwärts abspielen' });
  await rev.click();
  await expect(rev).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.smp-tools .chip', { hasText: 'Leeren' }).click();
  await expect(pad(page, 1).locator('small')).toHaveText('leer');
  await expect(rev).toHaveAttribute('aria-pressed', 'false');
});

test('kein horizontaler Scroll, Touch-Ziele ≥ 44 px (außer dem dichten Step-Raster)', async ({
  page,
}, info) => {
  await openSampler(page);
  await eachView(page, async (view) => {
    expect(await horizontalOverflow(page), view).toEqual([]);
  });
  test.skip(info.project.name === 'desktop', 'Touch-Ziele nur auf Touch-Layouts');
  await eachView(page, async (view) => {
    const found = await targets(
      page,
      ':is([data-area=tracks], [data-area=work], [data-area=steps]) :is(button, [role=slider]):not(.ss)',
    );
    expect(found.count, view).toBeGreaterThan(8);
    expect(found.small, view).toEqual([]);
  });
});

test('Geräte bleiben im Fenster, mit Synth und mit Sampler', async ({ page }) => {
  const inside = async (view: string) => {
    expect(
      await rightOverhang(
        page,
        '[data-area=work] > section, .track-pages > section, [data-area=work] :is(button, select, [role=slider], canvas)',
      ),
      view,
    ).toBeLessThanOrEqual(0);
  };
  await pickTrack(page, 'Bass');
  await eachView(page, inside);
  await openSampler(page);
  await eachView(page, inside);
});

test('Chop wählen, Pitch am Step setzen, bleibt nach Neuladen; Tastatur mit großen Zielen', async ({
  page,
}, info) => {
  await openSampler(page);
  const smp = page.locator('[data-area=work]');
  await openPage(page, 'Chop');
  await smp.locator('.smp-chop [role=radio]', { hasText: '4' }).click();
  await openPage(page, 'Trig');
  await smp.locator('[aria-label="Step-Optionen bearbeiten"]:visible').click();
  await (await trackSteps(page)).nth(2).click();
  await smp.locator('[aria-label="Pitch höher"]:visible').click();
  await smp.locator('[aria-label="Pitch höher"]:visible').click();
  await expect(smp.locator('[aria-label^="Pitch zurücksetzen"]:visible')).toHaveText('+2 ST');
  await page.waitForTimeout(400);
  await page.reload();
  await openSampler(page);
  const again = page.locator('[data-area=work]');
  await openPage(page, 'Chop');
  await expect(again.locator('.smp-chop [role=radio][aria-checked=true]')).toHaveText('4');
  await openPage(page, 'Trig');
  await again.locator('[aria-label="Step-Optionen bearbeiten"]:visible').click();
  await (await trackSteps(page)).nth(2).click();
  await expect(again.locator('[aria-label^="Pitch zurücksetzen"]:visible')).toHaveText('+2 ST');
  if (info.project.name !== 'desktop') {
    for (const [name, selector] of [
      ['Tasten', '.smp-keys button'],
      ['Chop', '.smp-chop button'],
    ] as const) {
      await openPage(page, name);
      const found = await targets(page, `[data-area=work] ${selector}`);
      expect(found.count, name).toBeGreaterThan(4);
      expect(found.small, name).toEqual([]);
    }
  }
});
