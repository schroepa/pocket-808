import { expect, test } from '../e2e/fixtures.ts';

test.skip(({ browserName }) => browserName !== 'chromium', 'Long Tasks misst nur Chromium');

test('keine Long Task über 50 ms während 5 s Wiedergabe', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500); // Vorrendern abwarten
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__long.push(e.duration);
    }).observe({ type: 'longtask' });
  });
  await page.locator('.play').click();
  await page.waitForTimeout(5000);
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  expect(long.filter((d) => d > 50)).toEqual([]);
});
