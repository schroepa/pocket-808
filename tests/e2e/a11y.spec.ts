import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.ts';

// Bekannte Verstöße der Legacy-App (serious/critical). Ziel bis Ende Schritt 5: leere Listen.
const BASELINE = new URL('./axe-baseline.json', import.meta.url);

test('keine neuen schweren Barrierefreiheits-Verstöße', async ({ page }, info) => {
  await page.goto('/');
  for (const id of ['synHead', 'smpHead', 'mixHead', 'fxHead'])
    await page.locator(`#${id}`).click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const found = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.id} @ ${n.target.join(' ')}`))
    .sort();

  const all = existsSync(BASELINE)
    ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, string[]>)
    : {};
  if (process.env.AXE_UPDATE === '1') {
    all[info.project.name] = found;
    writeFileSync(BASELINE, JSON.stringify(all, null, 2) + '\n');
    return;
  }
  const known = new Set(all[info.project.name] ?? []);
  expect(found.filter((f) => !known.has(f))).toEqual([]);
});
