import { expect, test } from './fixtures.ts';

test.skip(({ browserName }) => browserName !== 'chromium', 'Long Tasks misst nur Chromium');

test('keine Long Task über 50 ms während 5 s Wiedergabe', async ({ page }) => {
  await page.goto('/');
  // Vorrendern abwarten: erst messen, wenn die Seite 1 s lang ohne Long Task war (unter Last dauert
  // das Vorrendern länger als die früher festen 1,5 s; gemessen werden soll nur die Wiedergabe)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = performance.now();
        new PerformanceObserver(() => {
          last = performance.now();
        }).observe({ type: 'longtask' });
        const check = (): void => {
          if (performance.now() - last > 1000) resolve();
          else setTimeout(check, 100);
        };
        setTimeout(check, 1500);
      }),
  );
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
