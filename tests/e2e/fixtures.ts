import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // Google Fonts immer blockieren: gleiche Darstellung online wie offline
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
      // Fester Zufalls-Seed (mulberry32), damit z. B. erzeugte Samples und Wellenformen gleich bleiben
      await page.addInitScript(() => {
        let a = 1;
        Math.random = () => {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      });
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) {
          errors.push(m.text());
        }
      });
      await use(errors);
    },
    { auto: true },
  ],
});

export { expect };
