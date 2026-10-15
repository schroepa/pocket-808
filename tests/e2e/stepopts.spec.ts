import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

const editor = (page: Page) => page.getByRole('region', { name: 'Step-Editor' });
const panel = (page: Page) => editor(page).getByRole('group', { name: 'Step-Optionen' });

test('Opt-Modus: Step einschalten, Leise, Bedingung 1:2; bleibt nach Neuladen', async ({
  page,
}) => {
  await editor(page).getByRole('button', { name: 'Step-Optionen bearbeiten' }).click();
  await expect(panel(page)).toBeVisible();
  const step = editor(page).getByRole('button', { name: 'Step 3', exact: true });
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
  const again = editor(page).getByRole('button', { name: 'Step 3', exact: true });
  await expect(again).toHaveClass(/opt/);
  await expect(again).toHaveCSS('--vel', '0.35');
});

test('Opt-Panel: im Fenster, Touch-Ziele ≥ 44 px', async ({ page }, info) => {
  await editor(page).getByRole('button', { name: 'Step-Optionen bearbeiten' }).click();
  await editor(page).getByRole('button', { name: 'Step 1', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  const box = await panel(page).boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  if (info.project.name === 'desktop') return;
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.opt-panel :is(button, select, [role=slider])')]
      .filter((el) => el.getClientRects().length > 0)
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
