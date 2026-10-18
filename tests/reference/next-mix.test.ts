import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import { MIX_NAMES, type StereoPrint } from './next/scenarios.ts';

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
import { runNext } from './run.ts';

/*
 * Eigene Fingerabdrücke der neuen Engine (golden/mix-next/), wo die alte App mit Halten plus Rampe
 * ohne Anker arbeitet; node-web-audio-api verrechnet das falsch, die neue Engine setzt einen Anker
 * und klingt wie im Browser:
 * - stutterRelease: das trockene Signal wird nach dem Loslassen eingeblendet
 *   (alt: Gate bis zum Loslassen halb offen).
 * - demo: der monophone Synth schneidet die vorige Note vom berechneten Hüllkurvenpegel ab
 *   (Etappe 6a; alt: ein 10-ms-Fenster weicht um gut 4 dB ab, im Mittel 0,02 dB).
 */
const NEXT_OWN = new Set(['stutterRelease', 'demo']);
const golden = (name: string) => (NEXT_OWN.has(name) ? `mix-next/${name}` : `mix/${name}`);

describe.concurrent('Neue Engine: Mix und FX = Referenz', () => {
  it('deckt die heutigen Mix-Szenarien ab', ({ expect }) => {
    expect([...MIX_NAMES].sort()).toEqual([...EXPECTED].sort());
  });

  for (const name of MIX_NAMES) {
    it(name, async ({ expect }) => {
      const print = await runNext<StereoPrint>('mixScenario', { name });
      expectStereo(expect, golden(name), print);
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

describe.concurrent('WAV-Export (audio/export.ts)', () => {
  it('rendert den Demo-Zustand wie das Mix-Szenario demo', async ({ expect }) => {
    const print = await runNext<StereoPrint>('exportDemo', {});
    expectStereo(expect, golden('demo'), print);
  });

  it('plant genau einen Takt, meldet Fortschritt und lässt sich abbrechen', async ({ expect }) => {
    const r = await runNext<{
      steps: number[];
      firstTime: number;
      progress: number[];
      abortedBefore: boolean;
      abortedDuring: boolean;
    }>('exportBounds', {});
    expect(r.steps).toEqual(Array.from({ length: 16 }, (_, i) => i));
    // der erste Schlag liegt auf Sample 0 (Loop-tauglich für die DAW)
    expect(r.firstTime).toBeCloseTo(0, 6);
    expect(r.progress.length).toBeGreaterThan(1);
    expect(r.progress.every((f, i) => f >= (r.progress[i - 1] ?? 0) && f <= 1)).toBe(true);
    expect(r.abortedBefore).toBe(true);
    expect(r.abortedDuring).toBe(true);
  });
});
