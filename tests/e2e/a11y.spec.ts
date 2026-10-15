import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.ts';

test('keine schweren Verstöße (axe)', async ({ page }) => {
  await page.goto('/');
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual(
    [],
  );
});

test('keine schweren Verstöße mit offenem Synth (axe)', async ({ page }) => {
  await page.goto('/');
  const head = page.locator('#dev-head-synth');
  if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual(
    [],
  );
});

test('keine schweren Verstöße mit offenem Sampler (axe)', async ({ page }) => {
  await page.goto('/');
  const head = page.locator('#dev-head-smp');
  if ((await head.getAttribute('role')) === 'tab') await head.click();
  else if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual(
    [],
  );
});

test('keine schweren Verstöße mit offenem Mixer und FX (axe)', async ({ page }) => {
  await page.goto('/');
  for (const id of ['mix', 'fx']) {
    const head = page.locator(`#dev-head-${id}`);
    if ((await head.getAttribute('role')) === 'tab') await head.click();
    else if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
    const r = await new AxeBuilder({ page }).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual(
      [],
    );
  }
});
