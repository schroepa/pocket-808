import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

/** Gerät sichtbar machen: Mobile aufklappen, Tablet Tab wählen, Desktop immer sichtbar */
async function openDevice(page: Page, id: 'mix' | 'fx') {
  const head = page.locator(`#dev-head-${id}`);
  if ((await head.getAttribute('role')) === 'tab') await head.click();
  else if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
  await expect(page.locator(`#dev-${id}`)).toBeVisible();
}

test('Mixer: Mute, Solo, Fader; Zusammenfassung', async ({ page }) => {
  await openDevice(page, 'mix');
  const mute = page.getByRole('button', { name: 'Snare Drum stumm' });
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Cowbell solo' }).click();
  await expect(page.locator('#dev-head-mix')).toContainText('1 stumm · Solo CB');
  const fader = page.getByRole('slider', { name: 'Lautstärke Bass Drum' });
  await fader.fill('25');
  await expect(fader).toHaveValue('25');
});

test('FX: Stutter halten und loslassen; Filter-Regler', async ({ page }) => {
  await openDevice(page, 'fx');
  const st = page.getByRole('button', { name: 'Stutter 1/16 halten' });
  await st.hover();
  await page.mouse.down();
  await expect(st).toHaveClass(/on/);
  await page.mouse.up();
  await expect(st).not.toHaveClass(/on/);
  await page.getByRole('slider', { name: 'Filter', exact: true }).press('Home');
  await expect(page.locator('#dev-head-fx')).toContainText('Filter LP 100%');
});

test('Song: anhängen, Wiederholung, verschieben, entfernen, leeren; bleibt nach Neuladen', async ({
  page,
}) => {
  await page.locator('[data-area=song] .chip', { hasText: 'Leeren' }).click();
  const add = page.getByRole('button', { name: 'Aktuelles Pattern an den Song anhängen' });
  await add.click();
  await page.getByRole('button', { name: 'Pattern B', exact: true }).click();
  await add.click();
  await page.getByRole('button', { name: 'Wiederholungen erhöhen' }).click();
  await page.getByRole('button', { name: 'Nach vorne schieben' }).click();
  await expect(page.locator('.blk').first()).toHaveAttribute(
    'aria-label',
    'Position 1: Pattern B, 2 mal',
  );
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('.blk')).toHaveCount(2);
  await page.locator('.blk').first().click();
  await page.getByRole('button', { name: 'Position entfernen' }).click();
  await expect(page.locator('.blk')).toHaveCount(1);
});

test('Vorlage laden und zurück; Kopieren und Einfügen', async ({ page }) => {
  const house = page.locator('.presets .chip', { hasText: 'House' });
  await house.click();
  await expect(house).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.tools .chip', { hasText: 'Zurück' }).click();
  await expect(house).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.tools .chip', { hasText: 'Kopieren' }).click();
  await page.getByRole('button', { name: 'Pattern D', exact: true }).click();
  await page.locator('.tools .chip', { hasText: 'Einfügen' }).click();
  await expect(page.locator('.lcd-sub')).toHaveText('EINGEFÜGT IN D');
});

test('Mixer und FX: im Fenster, Touch-Ziele ≥ 44 px', async ({ page }, info) => {
  for (const id of ['mix', 'fx'] as const) {
    await openDevice(page, id);
    const right = await page.evaluate(
      (sel) =>
        Math.round(document.querySelector(sel)?.getBoundingClientRect().right ?? 0) -
        window.innerWidth,
      `#dev-${id}`,
    );
    expect(right).toBeLessThanOrEqual(0);
    if (info.project.name === 'desktop') continue;
    const small = await page.evaluate(
      (sel) =>
        [...document.querySelectorAll<HTMLElement>(`${sel} :is(button, input, [role=slider])`)]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              name: el.getAttribute('aria-label') ?? el.textContent,
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })
          .filter((x) => x.w < 44 || x.h < 44),
      `#dev-${id}`,
    );
    expect(small).toEqual([]);
  }
});

test('Vorlagen-Browser: Stil wählen, Vorlage laden, Warm und Tape an; bleibt nach Neuladen', async ({
  page,
}) => {
  await page.locator('.genres .chip', { hasText: 'Lo-Fi' }).click();
  const tpl = page.locator('.presets .chip', { hasText: 'Dusty Tape' });
  await tpl.click();
  await expect(tpl).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tpl-hint')).toContainText('78 BPM');
  await expect(page.locator('.kits .chip', { hasText: 'Lo-Fi' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const saved = async () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('pocket808.v1') ?? '{}') as {
          tape?: number;
          warm?: boolean;
          tempo?: number;
        },
    );
  await expect.poll(async () => (await saved()).tape).toBe(0.6);
  expect((await saved()).warm).toBe(true);
  expect((await saved()).tempo).toBe(78);
  await page.reload();
  // nach dem Neuladen öffnet der Browser beim Stil der geladenen Vorlage
  await expect(page.locator('.presets .chip', { hasText: 'Dusty Tape' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Zurück gibt es nach dem Neuladen nicht mehr; eine andere Vorlage ersetzt den Klang wieder
  await page.locator('.genres .chip', { hasText: 'Techno' }).click();
  await page.locator('.presets .chip', { hasText: 'Peak Techno' }).click();
  await expect.poll(async () => (await saved()).tape).toBeUndefined();
  await page.locator('.tools .chip', { hasText: 'Zurück' }).click();
  await expect.poll(async () => (await saved()).tape).toBe(0.6);
});

test('Vorlagen-Browser: im Fenster, Touch-Ziele ≥ 44 px', async ({ page }, info) => {
  await page.locator('.genres .chip', { hasText: 'Trap' }).click();
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
  for (const sel of ['.genres .chip', '.presets .chip', '.kits .chip', '.tpl-scope [role=radio]']) {
    for (const el of await page.locator(sel).all()) {
      const box = await el.boundingBox();
      // am Desktop (Maus) dürfen die Ziele kleiner sein
      if (info.project.name !== 'desktop') expect(box?.height ?? 0, sel).toBeGreaterThanOrEqual(44);
      expect((box?.x ?? 0) + (box?.width ?? 0), sel).toBeLessThanOrEqual(width + 1);
    }
  }
});
