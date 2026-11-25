import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { rightOverhang, targets, trackSteps } from './nav.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

const opt = (page: Page) => page.getByRole('button', { name: 'Step-Optionen bearbeiten' });
const panel = (page: Page) => page.getByRole('group', { name: 'Step-Optionen' });
/** Step 1–16 der gewählten Spur (beim Start die Bass Drum) */
const stepOf = async (page: Page, n: number) => {
  const step = (await trackSteps(page)).nth(n - 1);
  await expect(step).toHaveAttribute('aria-label', new RegExp(`Step ${n}$`));
  return step;
};

test('Opt-Modus: Step einschalten, Leise, Bedingung 1:2; bleibt nach Neuladen', async ({
  page,
}) => {
  await opt(page).click();
  await expect(panel(page)).toBeVisible();
  const step = await stepOf(page, 3);
  await expect(step).toHaveAttribute('aria-pressed', 'false');
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page)).toContainText('BD · Step 3');
  await panel(page).getByRole('button', { name: 'Leise' }).click();
  await panel(page).getByLabel('Bedingung').selectOption({ label: '1:2' });
  await expect(step).toHaveClass(/opt/);
  await expect(step).toHaveCSS('--vel', '0.35');
  await page.waitForTimeout(400);
  await page.reload();
  const again = await stepOf(page, 3);
  await expect(again).toHaveClass(/opt/);
  await expect(again).toHaveCSS('--vel', '0.35');
});

test('Opt-Panel: im Fenster, Touch-Ziele ≥ 44 px', async ({ page }, info) => {
  await opt(page).click();
  await (await stepOf(page, 1)).click();
  await expect(panel(page)).toBeVisible();
  const box = await panel(page).boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  expect(
    await rightOverhang(page, '.opt-panel :is(button, select, [role=slider])'),
  ).toBeLessThanOrEqual(0);
  if (info.project.name === 'desktop') return;
  const found = await targets(page, '.opt-panel :is(button, select, [role=slider])');
  expect(found.count).toBeGreaterThan(5);
  expect(found.small).toEqual([]);
});

test('Fill-Taste: im Fenster, Touch-Ziel, halten und loslassen', async ({ page }) => {
  const fill = page.getByRole('button', { name: 'Fill halten' });
  await expect(fill).toBeVisible();
  const box = await fill.boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await fill.hover();
  await page.mouse.down();
  await expect(fill).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(fill).toHaveAttribute('aria-pressed', 'false');
});

test('Lock setzen: Tune-Lock bleibt nach Neuladen', async ({ page }) => {
  await opt(page).click();
  await (await stepOf(page, 1)).click();
  const tune = panel(page).getByRole('slider', { name: 'Lock Tune' });
  await tune.press('End');
  await expect(tune).toHaveAttribute('aria-valuenow', '100');
  await page.waitForTimeout(400);
  await page.reload();
  await opt(page).click();
  await (await stepOf(page, 1)).click();
  await expect(panel(page).getByRole('slider', { name: 'Lock Tune' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
});
