import { expect, test } from './fixtures.ts';
import { expectTrack, trackSteps } from './nav.ts';

test('alter Speicherstand lädt (Tempo, Auswahl, Steps)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'pocket808.v1',
      JSON.stringify({
        tempo: 123,
        sel: 1,
        cur: 'A',
        patterns: { A: { SD: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] } },
      }),
    );
  });
  await page.goto('/');
  await expect(page.locator('.lcd-digits')).toHaveText('123');
  await expectTrack(page, 'SD', 'Snare Drum');
  await expect((await trackSteps(page)).nth(4)).toHaveAttribute('aria-pressed', 'true');
});
