import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

async function openDevice(page: Page, id: 'punch' | 'smp') {
  const head = page.locator(`#dev-head-${id}`);
  if ((await head.getAttribute('role')) === 'tab') await head.click();
  else if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
  await expect(page.locator(`#dev-${id}`)).toBeVisible();
}

test('Punch: acht Haltetasten im Fenster, halten und loslassen', async ({ page }, info) => {
  await openDevice(page, 'punch');
  const pads = page.locator('#dev-punch .punch-pad');
  await expect(pads).toHaveCount(8);
  const right = await page.evaluate(
    () =>
      Math.round(document.querySelector('#dev-punch')?.getBoundingClientRect().right ?? 0) -
      window.innerWidth,
  );
  expect(right).toBeLessThanOrEqual(0);
  const tape = page.getByRole('button', { name: 'Tape halten' });
  await tape.hover();
  await page.mouse.down();
  await expect(tape).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dev-head-punch')).toContainText('Tape');
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
  await openDevice(page, 'smp');
  await page.getByRole('button', { name: 'Pad 5', exact: true }).click();
  await page.getByRole('button', { name: 'Pattern auf dieses Pad bouncen' }).click();
  await expect(page.locator('#dev-smp [role=status]')).toHaveText('Pad 5: Bounce', {
    timeout: 20_000,
  });
  const pad = page.getByRole('button', { name: 'Pad 5', exact: true }).locator('small');
  await expect(pad).toHaveText('Bounce');
  await page.waitForTimeout(400);
  await page.reload();
  await openDevice(page, 'smp');
  await expect(
    page.getByRole('button', { name: 'Pad 5', exact: true }).locator('small'),
  ).toHaveText('Bounce');
});
