import type { Page } from '@playwright/test';
import { expect, test } from '../e2e/fixtures.ts';

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

/** Sampler sichtbar machen: Mobile aufklappen, Tablet Tab wählen, Desktop immer sichtbar */
async function openSampler(page: Page) {
  const head = page.locator('#dev-head-smp');
  const role = await head.getAttribute('role');
  if (role === 'tab') await head.click();
  else if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
  await expect(page.locator('#dev-smp')).toBeVisible();
}

test('Pad wählen, Step setzen, Datei laden; bleibt nach Neuladen', async ({ page }) => {
  await openSampler(page);
  await page.getByRole('button', { name: 'Pad 6', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pad 6', exact: true })).toHaveClass(/sel/);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#dev-smp .smp-tools .chip', { hasText: 'Laden' }).click();
  await (await chooser).setFiles({ name: 'ton.wav', mimeType: 'audio/wav', buffer: toneWav() });
  await expect(page.locator('#dev-smp [role=status]')).toHaveText('Pad 6 geladen');
  await expect(
    page.getByRole('button', { name: 'Pad 6', exact: true }).locator('small'),
  ).toHaveText('ton');
  const step = page.getByRole('button', { name: 'Sampler Step 3' });
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  await page.reload();
  await openSampler(page);
  await expect(
    page.getByRole('button', { name: 'Pad 6', exact: true }).locator('small'),
  ).toHaveText('ton');
  await expect(page.locator('#dev-head-smp')).toContainText('Pad 6 · ton');
});

test('Rev und Leeren', async ({ page }) => {
  await openSampler(page);
  const rev = page.getByRole('button', { name: 'Rückwärts abspielen' });
  await rev.click();
  await expect(rev).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#dev-smp .smp-tools .chip', { hasText: 'Leeren' }).click();
  await expect(
    page.getByRole('button', { name: 'Pad 1', exact: true }).locator('small'),
  ).toHaveText('leer');
  await expect(rev).toHaveAttribute('aria-pressed', 'false');
});

test('kein horizontaler Scroll, Touch-Ziele ≥ 44 px (außer dem dichten Step-Raster)', async ({
  page,
}, info) => {
  await openSampler(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  test.skip(info.project.name === 'next-desktop', 'Touch-Ziele nur auf Touch-Layouts');
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('#dev-smp :is(button, [role=slider]):not(.ss)')]
      .filter((el) => el.offsetParent !== null)
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

test('Geräte bleiben im Fenster, mit Synth und mit Sampler', async ({ page }) => {
  const right = () =>
    page.evaluate(() => {
      const els = [...document.querySelectorAll<HTMLElement>('#dev-synth, #dev-smp')].filter(
        (e) => !e.hidden && e.offsetParent !== null,
      );
      return Math.max(
        0,
        ...els.map((e) => Math.round(e.getBoundingClientRect().right - window.innerWidth)),
      );
    });
  const synthHead = page.locator('#dev-head-synth');
  if ((await synthHead.getAttribute('aria-expanded')) === 'false') await synthHead.click();
  expect(await right()).toBe(0);
  await openSampler(page);
  expect(await right()).toBe(0);
});
