import { expect, test } from './fixtures.ts';

test('window.claude.hot: Startzustand vom Host, Schnappschuss zurück', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.claude = {
      hot: {
        snapshot: (fn: () => unknown) => {
          w.__snap = fn;
        },
        ready: (fn: (d: unknown) => void) => {
          setTimeout(() => {
            fn({ state: { tempo: 141 } });
          }, 0);
        },
      },
    };
  });
  await page.goto('/');
  await expect(page.locator('.lcd-digits')).toHaveText('141');
  const tempo = await page.evaluate(
    () =>
      (window as unknown as { __snap: () => { state: { tempo: number } } }).__snap().state.tempo,
  );
  expect(tempo).toBe(141);
});
