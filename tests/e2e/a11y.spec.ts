import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  closeSheet,
  eachView,
  layoutOf,
  openAllTracks,
  openMode,
  openPattern,
  openRoll,
  openTempo,
  pickTrack,
  trackSteps,
} from './nav.ts';

/** doppelte Namen von Landmarken meldet axe nur als „moderate“; sie zählen hier mit */
const ALWAYS = ['landmark-unique'];

async function expectAccessible(page: Page, where = 'Seite') {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical' || ALWAYS.includes(v.id),
  );
  expect(
    bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    where,
  ).toEqual([]);
}

test('keine schweren Verstöße (axe)', async ({ page }) => {
  await page.goto('/');
  await eachView(page, (view) => expectAccessible(page, view));
  if ((await layoutOf(page)) === 'tablet') {
    await openAllTracks(page);
    await expectAccessible(page, 'Alle Spuren');
  }
});

test('keine schweren Verstöße mit offenem Synth (axe)', async ({ page }) => {
  await page.goto('/');
  await pickTrack(page, 'Bass');
  await eachView(page, (view) => expectAccessible(page, view));
  await openRoll(page);
  await expectAccessible(page, 'Rolle');
});

test('keine schweren Verstöße mit offenem Sampler (axe)', async ({ page }) => {
  await page.goto('/');
  await pickTrack(page, 'Sampler');
  await eachView(page, (view) => expectAccessible(page, view));
});

test('keine schweren Verstöße mit offenem Mixer und FX (axe)', async ({ page }) => {
  await page.goto('/');
  await openMode(page, 'Mixer');
  await eachView(page, (view) => expectAccessible(page, view));
});

test('keine schweren Verstöße in der Plattenkiste (axe)', async ({ page }) => {
  await page.goto('/');
  await openMode(page, 'Sound');
  await eachView(page, (view) => expectAccessible(page, view));
});

test('keine schweren Verstöße mit offenem Song (axe)', async ({ page }) => {
  await page.goto('/');
  await openMode(page, 'Song');
  await expectAccessible(page);
});

test('keine schweren Verstöße mit offener Pattern- und Tempo-Fläche (axe)', async ({ page }) => {
  await page.goto('/');
  const pattern = await openPattern(page);
  await expectAccessible(page, 'Pattern');
  await closeSheet(pattern);
  await openTempo(page);
  await expectAccessible(page, 'Tempo');
});

test('keine schweren Verstöße mit offenem Pad-Feld (axe)', async ({ page }) => {
  await page.goto('/');
  // das Pad-Feld gibt es nur auf dem Telefon; sonst stehen die Spurtasten immer da (Startansicht)
  if ((await layoutOf(page)) !== 'mobile') {
    await expect(page.getByRole('button', { name: 'Spur wählen', exact: true })).toBeHidden();
    return;
  }
  await page.getByRole('button', { name: 'Spur wählen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pad-Feld' })).toBeVisible();
  await expectAccessible(page, 'Pad-Feld');
});

test('keine schweren Verstöße mit offenem Datei-Dialog (axe)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Datei', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Projekt und Export' })).toBeVisible();
  await expectAccessible(page);
});

test('keine schweren Verstöße mit offenen Step-Optionen (axe)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Step-Optionen bearbeiten' }).click();
  await (await trackSteps(page)).first().click();
  await expect(page.getByRole('group', { name: 'Step-Optionen' })).toBeVisible();
  await expectAccessible(page, 'Opt');
  await page.getByRole('button', { name: 'Sub-Steps bearbeiten' }).click();
  await expect(page.locator('.sub-ed:visible')).toBeVisible();
  await expectAccessible(page, 'Sub');
});

test('keine schweren Verstöße mit offenem Punch (axe)', async ({ page }) => {
  await page.goto('/');
  await openMode(page, 'Punch');
  await expectAccessible(page);
});
