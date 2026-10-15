import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import { MIX_NAMES, type StereoPrint } from './legacy/scenarios.ts';

// Szenarien aus dem früheren legacy/tests/mix-scn.cjs. 'live' fehlt bewusst: Es automatisiert über DOM-Klicks.
const EXPECTED = [
  'demo',
  'base',
  'mute',
  'solo',
  'faderHalf',
  'master1',
  'reverbWet',
  'reverbDry',
  'hatChoke',
  'liveMix',
  'djLowpass',
  'djHighpass',
  'panRight',
  'stutter',
  'stutterRelease',
];
import { runLegacy } from './run.ts';

describe.concurrent('Referenz: Mix und FX', () => {
  it('deckt die heutigen Mix-Szenarien ab', ({ expect }) => {
    expect([...MIX_NAMES].sort()).toEqual([...EXPECTED].sort());
  });

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
      if (name === 'mute') {
        expect(Math.max(print.L.peak, print.R.peak), 'BD und SD stumm').toBeLessThan(1e-4);
      }
      if (name === 'solo') {
        // BD auf Step 1 (0–0,25 s) ist durch Solo SD stumm, SD auf Step 5 klingt
        expect(Math.max(...print.L.rmsDb.slice(0, 20)), 'BD stumm').toBeLessThan(-80);
        expect(Math.max(...print.L.rmsDb.slice(55, 80)), 'SD klingt').toBeGreaterThan(-30);
      }
      if (name === 'master1') {
        expect(Math.max(print.L.peak, print.R.peak), 'Master 100 % übersteuert nicht').toBeLessThan(
          0.99,
        );
      }
      if (name === 'panRight') {
        expect(Math.max(...print.R.rmsDb)).toBeGreaterThan(Math.max(...print.L.rmsDb) + 6);
      }
    });
  }
});
