import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import { MIX_NAMES, type StereoPrint } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

describe.concurrent('Referenz: Mix und FX', () => {
  for (const name of MIX_NAMES) {
    it(name, async ({ expect }) => {
      const print = await runLegacy<StereoPrint>('mixScenario', { name });
      expectStereo(expect, `mix/${name}`, print);
      if (name === 'demo') {
        // CLAUDE.md: Master-Pegel ist auf Spitze ≈ 0,77 abgestimmt
        const peak = Math.max(print.L.peak, print.R.peak);
        expect(peak, `Master-Spitze ${peak}`).toBeGreaterThan(0.72);
        expect(peak, `Master-Spitze ${peak}`).toBeLessThan(0.82);
      }
      if (name === 'panRight') {
        expect(Math.max(...print.R.rmsDb)).toBeGreaterThan(Math.max(...print.L.rmsDb) + 6);
      }
    });
  }
});
