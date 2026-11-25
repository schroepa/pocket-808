import { expect, test } from './fixtures.ts';
import { openMode, openPage, pickTrack, rightOverhang } from './nav.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

test('Punch: acht Haltetasten im Fenster, halten und loslassen', async ({ page }, info) => {
  await openMode(page, 'Punch');
  const pads = page.locator('[data-mode=punch] .punch-pad');
  await expect(pads).toHaveCount(8);
  expect(
    await rightOverhang(page, '[data-mode=punch], [data-mode=punch] .punch-pad'),
  ).toBeLessThanOrEqual(0);
  const tape = page.getByRole('button', { name: 'Tape halten' });
  await tape.hover();
  await page.mouse.down();
  await expect(tape).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(tape).toHaveAttribute('aria-pressed', 'false');
  if (info.project.name === 'desktop') return;
  for (const box of await pads.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  )) {
    expect(box.w).toBeGreaterThanOrEqual(44);
    expect(box.h).toBeGreaterThanOrEqual(44);
  }
});

test('Bounce ins leere Pad 5: Name „Bounce“, bleibt nach Neuladen', async ({ page }) => {
  await pickTrack(page, 'Sampler');
  const pad = page.locator('.smp-head').getByRole('button', { name: 'Pad 5', exact: true });
  await pad.click();
  await openPage(page, 'Klang');
  await page.getByRole('button', { name: 'Pattern auf dieses Pad bouncen' }).click();
  await expect(page.locator('.smp-head [role=status]')).toHaveText('Pad 5: Bounce', {
    timeout: 20_000,
  });
  await expect(pad.locator('small')).toHaveText('Bounce');
  await page.waitForTimeout(400);
  await page.reload();
  await pickTrack(page, 'Sampler');
  await expect(pad.locator('small')).toHaveText('Bounce');
});
