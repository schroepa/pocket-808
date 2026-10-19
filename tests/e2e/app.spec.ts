import { expect, test } from './fixtures.ts';

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
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Step, Spur, Pattern und Tempo bleiben nach Neuladen erhalten', async ({ page }) => {
  await page.getByRole('button', { name: 'Pattern C' }).click();
  await page.getByRole('button', { name: 'Snare Drum wählen und anhören' }).click();
  const step = page.locator('[data-area=editor] .steps .step').nth(1);
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('slider', { name: 'Tempo' }).press('End');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('[data-area=editor] .steps .step').nth(1)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Pattern C' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-area=editor] h2')).toContainText('SD');
  await expect(page.locator('.lcd-digits')).toHaveText('200');
});

test('Änderung wird beim Wechsel in den Hintergrund sofort gespeichert', async ({ page }) => {
  await page.locator('[data-area=editor] .steps .step').nth(2).click();
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
  await expect(page.locator('[data-area=editor] .step.now')).toHaveCount(1, { timeout: 3000 });
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.step.now')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('Pattern wählen und Spur wählen', async ({ page }) => {
  await page.getByRole('button', { name: 'Pattern C' }).click();
  await expect(page.getByRole('button', { name: 'Pattern C' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Snare Drum wählen und anhören' }).click();
  await expect(page.locator('[data-area=editor] h2')).toContainText('SD');
});

test('Tap-Tempo setzt das Tempo, mehrstufiges Zurück nimmt zwei Änderungen nacheinander zurück', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  const tap = page.getByRole('button', { name: 'Tempo antippen' });
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

  // zwei Änderungen mit Zurück, dann zweimal zurück bis der Knopf leer ist
  await page.getByRole('button', { name: 'Pattern leeren' }).click();
  await page.getByRole('button', { name: 'House' }).click();
  const back = page.getByRole('button', { name: 'Zurück', exact: true });
  await expect(back).toBeEnabled();
  await back.click();
  await expect(back).toBeEnabled();
  await back.click();
  await expect(back).toBeDisabled();
});
